import pytest
from httpx import AsyncClient

from test.factories import create_org_with_admin, ensure_superadmin, login


@pytest.mark.asyncio
async def test_same_username_different_casing_rejected(client: AsyncClient) -> None:
    sa = await ensure_superadmin(client)
    headers = {"Authorization": f"Bearer {sa['access_token']}"}
    org = await client.post(
        "/super-admin/organizations",
        json={"name": "Case Org", "slug": "caseorg"},
        headers=headers,
    )
    assert org.status_code == 200
    org_id = org.json()["id"]
    first = await client.post(
        f"/super-admin/organizations/{org_id}/admins",
        json={"username": "admin", "password": "password123"},
        headers=headers,
    )
    assert first.status_code == 200
    second = await client.post(
        f"/super-admin/organizations/{org_id}/admins",
        json={"username": "Admin", "password": "password123"},
        headers=headers,
    )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_username_collision_across_orgs(client: AsyncClient) -> None:
    await create_org_with_admin(client, slug="orga", admin_username="shareduser")
    sa = await ensure_superadmin(client)
    headers = {"Authorization": f"Bearer {sa['access_token']}"}
    org_b = await client.post(
        "/super-admin/organizations",
        json={"name": "Org B", "slug": "orgb"},
        headers=headers,
    )
    assert org_b.status_code == 200
    conflict = await client.post(
        f"/super-admin/organizations/{org_b.json()['id']}/admins",
        json={"username": "shareduser", "password": "password123"},
        headers=headers,
    )
    assert conflict.status_code == 409
