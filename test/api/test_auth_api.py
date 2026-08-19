import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin, ensure_superadmin, login


@pytest.mark.asyncio
async def test_login_and_me(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="authme")
    headers = auth_headers(admin["access_token"])
    me = await client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["username"] == "admin_authme"
    assert me.json()["organization_slug"] == "authme"


@pytest.mark.asyncio
async def test_login_case_insensitive(client: AsyncClient) -> None:
    await create_org_with_admin(client, slug="caselogin", admin_username="caseuser")
    lower = await login(
        client, username="caseuser", password="password123", organization_slug="caselogin"
    )
    upper = await login(
        client, username="CaseUser", password="password123", organization_slug="caselogin"
    )
    assert lower["user"]["id"] == upper["user"]["id"]


@pytest.mark.asyncio
async def test_deactivated_user_gets_401(client: AsyncClient) -> None:
    sa = await ensure_superadmin(client)
    sa_headers = auth_headers(sa["access_token"])
    org = await client.post(
        "/super-admin/organizations",
        json={"name": "Inactive Org", "slug": "inactiveorg"},
        headers=sa_headers,
    )
    org_id = org.json()["id"]
    admin_resp = await client.post(
        f"/super-admin/organizations/{org_id}/admins",
        json={"username": "inactiveadmin", "password": "password123"},
        headers=sa_headers,
    )
    user_id = admin_resp.json()["id"]
    await client.patch(
        f"/super-admin/organizations/{org_id}/admins/{user_id}",
        json={"is_active": False},
        headers=sa_headers,
    )
    bad = await client.post(
        "/auth/login",
        json={
            "username": "inactiveadmin",
            "password": "password123",
            "organization_slug": "inactiveorg",
        },
    )
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_password_change_invalidates_old_token(client: AsyncClient) -> None:
    sa = await ensure_superadmin(client)
    sa_headers = auth_headers(sa["access_token"])
    org = await client.post(
        "/super-admin/organizations",
        json={"name": "Perm Org", "slug": "permorg"},
        headers=sa_headers,
    )
    org_id = org.json()["id"]
    admin_resp = await client.post(
        f"/super-admin/organizations/{org_id}/admins",
        json={"username": "permadmin", "password": "password123"},
        headers=sa_headers,
    )
    user_id = admin_resp.json()["id"]
    session = await login(
        client, username="permadmin", password="password123", organization_slug="permorg"
    )
    old_headers = auth_headers(session["access_token"])
    await client.patch(
        f"/super-admin/organizations/{org_id}/admins/{user_id}",
        json={"password": "newpassword123"},
        headers=sa_headers,
    )
    stale = await client.get("/auth/me", headers=old_headers)
    assert stale.status_code == 401


@pytest.mark.asyncio
async def test_check_username_available(client: AsyncClient) -> None:
    ok = await client.get("/auth/check-username", params={"username": "freshuser"})
    assert ok.status_code == 200
    await create_org_with_admin(client, slug="checkuser", admin_username="takenuser")
    taken = await client.get("/auth/check-username", params={"username": "takenuser"})
    assert taken.status_code == 409
