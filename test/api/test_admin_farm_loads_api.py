import pytest
from httpx import AsyncClient
import uuid

from test.factories import auth_headers, create_org_with_admin, create_default_item

@pytest.mark.asyncio
async def test_admin_farm_loads_create(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_create")
    headers = auth_headers(admin["access_token"])

    # Setup farm and item
    farm = await client.post(
        "/admin/farms",
        json={"name": "Farm", "contact_phone": "9000000000"},
        headers=headers,
    )
    farm_id = farm.json()["id"]
    item = await create_default_item(client, admin["access_token"])

    load = await client.post(
        "/admin/farm-loads",
        json={
            "farm_id": farm_id,
            "item_id": item["id"],
            "loaded_weight_kg": "100.550",
            "driver_name": "Driver 1"
        },
        headers=headers,
    )
    assert load.status_code == 200
    assert load.json()["driver_name"] == "Driver 1"
    assert load.json()["loaded_weight_kg"] == "100.550"

@pytest.mark.asyncio
async def test_admin_farm_loads_create_fallback_item(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_create_fallback")
    headers = auth_headers(admin["access_token"])

    farm = await client.post("/admin/farms", json={"name": "Farm", "contact_phone": "9000000000"}, headers=headers)
    farm_id = farm.json()["id"]

    # Don't create any items, just send the load creation without item_id
    load = await client.post(
        "/admin/farm-loads",
        json={"farm_id": farm_id, "loaded_weight_kg": "100.550"},
        headers=headers,
    )
    assert load.status_code == 200
    assert load.json()["item_id"] is not None  # Fallback item should be used or created

@pytest.mark.asyncio
async def test_admin_farm_loads_create_inactive_item_error(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_create_inactive")
    headers = auth_headers(admin["access_token"])

    farm = await client.post("/admin/farms", json={"name": "Farm", "contact_phone": "90"}, headers=headers)
    farm_id = farm.json()["id"]
    item = await create_default_item(client, admin["access_token"])
    
    # Deactivate item
    patch_resp = await client.patch(f"/admin/items/{item['id']}", json={"is_active": False}, headers=headers)
    assert patch_resp.status_code == 200

    load = await client.post(
        "/admin/farm-loads",
        json={"farm_id": farm_id, "item_id": item["id"], "loaded_weight_kg": "100.000"},
        headers=headers,
    )
    assert load.status_code == 400
    assert "inactive" in load.text.lower()

@pytest.mark.asyncio
async def test_admin_farm_loads_list_pagination(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_list")
    headers = auth_headers(admin["access_token"])

    farm = await client.post("/admin/farms", json={"name": "Farm"}, headers=headers)
    farm_id = farm.json()["id"]

    for i in range(3):
        resp = await client.post(
            "/admin/farm-loads",
            json={"farm_id": farm_id, "loaded_weight_kg": str(100 + i)},
            headers=headers,
        )
        assert resp.status_code == 200

    list_resp = await client.get("/admin/farm-loads?limit=2&offset=0", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 2

    list_resp_2 = await client.get("/admin/farm-loads?limit=2&offset=2", headers=headers)
    assert list_resp_2.status_code == 200
    assert len(list_resp_2.json()) == 1

@pytest.mark.asyncio
async def test_admin_farm_loads_get(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_get")
    headers = auth_headers(admin["access_token"])

    farm = await client.post("/admin/farms", json={"name": "Farm"}, headers=headers)
    load = await client.post(
        "/admin/farm-loads",
        json={"farm_id": farm.json()["id"], "loaded_weight_kg": "123.450"},
        headers=headers,
    )
    assert load.status_code == 200
    load_id = load.json()["id"]

    get_resp = await client.get(f"/admin/farm-loads/{load_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["loaded_weight_kg"] == "123.450"

    fake_id = str(uuid.uuid4())
    get_404 = await client.get(f"/admin/farm-loads/{fake_id}", headers=headers)
    assert get_404.status_code == 404

@pytest.mark.asyncio
async def test_admin_farm_loads_update(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_update")
    headers = auth_headers(admin["access_token"])

    farm = await client.post("/admin/farms", json={"name": "Farm"}, headers=headers)
    load = await client.post(
        "/admin/farm-loads",
        json={"farm_id": farm.json()["id"], "loaded_weight_kg": "100.000"},
        headers=headers,
    )
    assert load.status_code == 200
    load_id = load.json()["id"]

    patch_resp = await client.patch(
        f"/admin/farm-loads/{load_id}",
        json={"loaded_weight_kg": "150.750", "driver_name": "New Driver", "load_date": "15/09/2026"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["loaded_weight_kg"] == "150.750"
    assert data["driver_name"] == "New Driver"

    fake_id = str(uuid.uuid4())
    patch_404 = await client.patch(f"/admin/farm-loads/{fake_id}", json={"driver_name": "X"}, headers=headers)
    assert patch_404.status_code == 404

@pytest.mark.asyncio
async def test_admin_farm_loads_delete(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farm_loads_delete")
    headers = auth_headers(admin["access_token"])

    farm = await client.post("/admin/farms", json={"name": "Farm"}, headers=headers)
    load = await client.post(
        "/admin/farm-loads",
        json={"farm_id": farm.json()["id"], "loaded_weight_kg": "100.000"},
        headers=headers,
    )
    assert load.status_code == 200
    load_id = load.json()["id"]

    del_resp = await client.delete(f"/admin/farm-loads/{load_id}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/admin/farm-loads/{load_id}", headers=headers)
    assert get_resp.status_code == 404

    fake_id = str(uuid.uuid4())
    del_404 = await client.delete(f"/admin/farm-loads/{fake_id}", headers=headers)
    assert del_404.status_code == 404
