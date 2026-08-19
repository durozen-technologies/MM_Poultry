import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin, ensure_superadmin


@pytest.mark.asyncio
async def test_org_crud(client: AsyncClient) -> None:
    sa = await ensure_superadmin(client)
    headers = auth_headers(sa["access_token"])
    created = await client.post(
        "/super-admin/organizations",
        json={"name": "CRUD Org", "slug": "crudorg"},
        headers=headers,
    )
    assert created.status_code == 200
    org_id = created.json()["id"]
    updated = await client.patch(
        f"/super-admin/organizations/{org_id}",
        json={"name": "CRUD Org Updated"},
        headers=headers,
    )
    assert updated.status_code == 200
    listed = await client.get("/super-admin/organizations", headers=headers)
    assert any(o["id"] == org_id for o in listed.json())
