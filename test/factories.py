from __future__ import annotations

from httpx import AsyncClient


async def login(
    client: AsyncClient,
    *,
    username: str,
    password: str,
    organization_slug: str | None = None,
) -> dict:
    payload = {"username": username, "password": password}
    if organization_slug:
        payload["organization_slug"] = organization_slug
    resp = await client.post("/auth/login", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def ensure_superadmin(client: AsyncClient) -> dict:
    # Fast path: try login first (handles already-created superadmin)
    for _ in range(3):
        existing = await client.post(
            "/auth/login",
            json={"username": "superadmin", "password": "password123"},
        )
        if existing.status_code == 200:
            return existing.json()
        if existing.status_code != 401:
            # Unexpected, retry
            await _sleep(0.2)
            continue
        break

    import asyncio as _asyncio

    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError

    from app.core.security import get_password_hash
    from app.db.database import get_session_factory
    from app.db.tenant_schema import set_search_path
    from app.models.enums import UserRole
    from app.models.user import User
    from app.services.auth import upsert_auth_index

    for attempt in range(5):
        session = get_session_factory()()
        try:
            await set_search_path(session, None)
            user = await session.scalar(select(User).where(User.username == "superadmin"))
            if user is None:
                user = User(
                    username="superadmin",
                    password_hash=get_password_hash("password123"),
                    role=UserRole.SUPER_ADMIN,
                    organization_id=None,
                )
                session.add(user)
                try:
                    await session.flush()
                except IntegrityError:
                    await session.rollback()
                    # Race: another worker inserted concurrently — fetch and retry
                    await _asyncio.sleep(0.2 * (attempt + 1))
                    continue
            else:
                user.password_hash = get_password_hash("password123")
                user.is_active = True
                await session.flush()
            try:
                await upsert_auth_index(
                    session,
                    username=user.username,
                    organization_id=None,
                    schema_name="public",
                    user_id=user.id,
                )
            except IntegrityError:
                await session.rollback()
                await _asyncio.sleep(0.2 * (attempt + 1))
                continue
            await session.commit()
            break
        except IntegrityError:
            await session.rollback()
            await _asyncio.sleep(0.2 * (attempt + 1))
            continue
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
        # Verify login works before returning
        logged = await client.post(
            "/auth/login", json={"username": "superadmin", "password": "password123"}
        )
        if logged.status_code == 200:
            return logged.json()
        await _asyncio.sleep(0.2)

    return await login(client, username="superadmin", password="password123")


async def _sleep(s: float) -> None:
    import asyncio

    await asyncio.sleep(s)


async def create_org_with_admin(
    client: AsyncClient,
    *,
    slug: str,
    admin_username: str | None = None,
) -> tuple[dict, dict]:
    import asyncio as _asyncio

    admin_username = admin_username or f"admin_{slug}"
    # Retry on transient 500/deadlock or race (org already exists)
    for attempt in range(4):
        sa = await ensure_superadmin(client)
        sa_headers = auth_headers(sa["access_token"])
        org_resp = await client.post(
            "/super-admin/organizations",
            json={"name": f"Org {slug}", "slug": slug},
            headers=sa_headers,
        )
        if org_resp.status_code == 200:
            org = org_resp.json()
        elif org_resp.status_code == 409 and "already exists" in org_resp.text.lower():
            # Org created concurrently by another worker — fetch it
            listed = await client.get("/super-admin/organizations", headers=sa_headers)
            org = next((o for o in listed.json() if o["slug"] == slug), None)
            if org is None:
                await _asyncio.sleep(0.3 * (attempt + 1))
                continue
        elif org_resp.status_code in (500, 502, 503) or "deadlock" in org_resp.text.lower():
            await _asyncio.sleep(0.4 * (attempt + 1))
            continue
        else:
            assert org_resp.status_code == 200, org_resp.text
            org = org_resp.json()

        admin_resp = await client.post(
            f"/super-admin/organizations/{org['id']}/admins",
            json={"username": admin_username, "password": "password123"},
            headers=sa_headers,
        )
        if admin_resp.status_code == 200:
            pass
        elif admin_resp.status_code == 409 and "already taken" in admin_resp.text.lower():
            # Admin already exists — proceed to login
            pass
        elif admin_resp.status_code in (500, 502, 503) or "deadlock" in admin_resp.text.lower():
            await _asyncio.sleep(0.4 * (attempt + 1))
            continue
        else:
            assert admin_resp.status_code == 200, admin_resp.text

        # Login retry (handles small consistency window)
        for _ in range(3):
            try:
                admin_login = await login(
                    client,
                    username=admin_username,
                    password="password123",
                    organization_slug=slug,
                )
                return org, admin_login
            except AssertionError as e:
                if "invalid" in str(e).lower() and _ < 2:
                    await _asyncio.sleep(0.3)
                    continue
                raise
        await _asyncio.sleep(0.3)
    # Final attempt (will raise)
    sa = await ensure_superadmin(client)
    sa_headers = auth_headers(sa["access_token"])
    org_resp = await client.post(
        "/super-admin/organizations",
        json={"name": f"Org {slug}", "slug": slug},
        headers=sa_headers,
    )
    assert org_resp.status_code == 200, org_resp.text
    org = org_resp.json()
    admin_resp = await client.post(
        f"/super-admin/organizations/{org['id']}/admins",
        json={"username": admin_username, "password": "password123"},
        headers=sa_headers,
    )
    assert admin_resp.status_code == 200, admin_resp.text
    admin_login = await login(
        client,
        username=admin_username,
        password="password123",
        organization_slug=slug,
    )
    return org, admin_login

async def create_default_item(client: AsyncClient, admin_token: str) -> dict:
    import asyncio as _asyncio

    # Retry on transient auth failures (token propagation) or deadlock
    for attempt in range(4):
        resp = await client.post(
            "/admin/items",
            json={"name": "Live Bird", "default_price": "180.00"},
            headers=auth_headers(admin_token),
        )
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code in (401, 500, 502, 503) or "deadlock" in resp.text.lower():
            await _asyncio.sleep(0.3 * (attempt + 1))
            continue
        # If item already exists (409), fetch it
        if resp.status_code == 409:
            listed = await client.get("/admin/items", headers=auth_headers(admin_token))
            if listed.status_code == 200 and listed.json():
                return listed.json()[0] if isinstance(listed.json(), list) else listed.json()
        assert resp.status_code == 200, resp.text
    assert False, f"create_default_item failed after retries: {resp.text}"
