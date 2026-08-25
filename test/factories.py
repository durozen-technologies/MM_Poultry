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
    existing = await client.post(
        "/auth/login",
        json={"username": "superadmin", "password": "password123"},
    )
    if existing.status_code == 200:
        return existing.json()

    from app.core.security import get_password_hash
    from app.db.database import dispose_engine, get_session_factory
    from app.db.tenant_schema import set_search_path
    from app.models.enums import UserRole
    from app.models.user import User
    from app.services.auth import upsert_auth_index

    await dispose_engine()
    session = get_session_factory()()
    try:
        await set_search_path(session, None)
        user = User(
            username="superadmin",
            password_hash=get_password_hash("password123"),
            role=UserRole.SUPER_ADMIN,
            organization_id=None,
        )
        session.add(user)
        await session.flush()
        await upsert_auth_index(
            session,
            username=user.username,
            organization_id=None,
            schema_name="public",
            user_id=user.id,
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
        await dispose_engine()
    return await login(client, username="superadmin", password="password123")


async def create_org_with_admin(
    client: AsyncClient,
    *,
    slug: str,
    admin_username: str | None = None,
) -> tuple[dict, dict]:
    admin_username = admin_username or f"admin_{slug}"
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
    resp = await client.post(
        "/admin/items",
        json={"name": "Live Bird", "default_price": "180.00"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()
