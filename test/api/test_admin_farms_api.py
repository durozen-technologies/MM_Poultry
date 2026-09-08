import pytest
from httpx import AsyncClient
import uuid

from test.factories import auth_headers, create_org_with_admin

@pytest.mark.asyncio
async def test_admin_farms_list_pagination(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farms_list")
    headers = auth_headers(admin["access_token"])

    # Create 3 farms
    for i in range(3):
        resp = await client.post(
            "/admin/farms",
            json={"name": f"List Farm {i}", "contact_phone": "9000000000"},
            headers=headers,
        )
        assert resp.status_code == 200

    # Test limit and offset
    list_resp = await client.get("/admin/farms?limit=2&offset=0", headers=headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert len(data) == 2

    list_resp_2 = await client.get("/admin/farms?limit=2&offset=2", headers=headers)
    assert list_resp_2.status_code == 200
    data_2 = list_resp_2.json()
    assert len(data_2) == 1

@pytest.mark.asyncio
async def test_admin_farms_get(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farms_get")
    headers = auth_headers(admin["access_token"])

    farm = await client.post(
        "/admin/farms",
        json={"name": "Get Farm", "contact_phone": "9000000000"},
        headers=headers,
    )
    assert farm.status_code == 200
    farm_id = farm.json()["id"]

    get_resp = await client.get(f"/admin/farms/{farm_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Get Farm"

@pytest.mark.asyncio
async def test_admin_farms_get_not_found(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farms_get_404")
    headers = auth_headers(admin["access_token"])
    
    fake_id = str(uuid.uuid4())
    get_resp = await client.get(f"/admin/farms/{fake_id}", headers=headers)
    assert get_resp.status_code == 404

@pytest.mark.asyncio
async def test_admin_farms_update_partial(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farms_patch")
    headers = auth_headers(admin["access_token"])

    farm = await client.post(
        "/admin/farms",
        json={"name": "Patch Farm", "contact_phone": "9000000000"},
        headers=headers,
    )
    assert farm.status_code == 200
    farm_id = farm.json()["id"]

    patch_resp = await client.patch(
        f"/admin/farms/{farm_id}",
        json={"contact_phone": "9999999999"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["name"] == "Patch Farm"  # Preserved
    assert data["contact_phone"] == "9999999999"  # Updated

@pytest.mark.asyncio
async def test_admin_farms_update_not_found(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farms_patch_404")
    headers = auth_headers(admin["access_token"])

    fake_id = str(uuid.uuid4())
    patch_resp = await client.patch(
        f"/admin/farms/{fake_id}",
        json={"name": "New Name"},
        headers=headers,
    )
    assert patch_resp.status_code == 404

@pytest.mark.asyncio
async def test_admin_farms_deactivate(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farms_delete")
    headers = auth_headers(admin["access_token"])

    farm = await client.post(
        "/admin/farms",
        json={"name": "Delete Farm", "contact_phone": "9000000000"},
        headers=headers,
    )
    assert farm.status_code == 200
    farm_id = farm.json()["id"]

    del_resp = await client.delete(f"/admin/farms/{farm_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify it is deactivated
    get_resp = await client.get(f"/admin/farms/{farm_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False

    # Test delete not found
    fake_id = str(uuid.uuid4())
    del_404 = await client.delete(f"/admin/farms/{fake_id}", headers=headers)
    assert del_404.status_code == 404
