import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin, create_default_item


@pytest.mark.asyncio
async def test_farm_vehicle_and_delivery_run(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="farmorg")
    item = await create_default_item(client, admin["access_token"])
    headers = auth_headers(admin["access_token"])
    farm = await client.post(
        "/admin/farms",
        json={"name": "Farm One", "contact_phone": "9000000000"},
        headers=headers,
    )
    assert farm.status_code == 200
    vehicle = await client.post(
        "/admin/vehicles",
        json={"number": "TN01AB1234", "driver_name": "Driver"},
        headers=headers,
    )
    assert vehicle.status_code == 200
    retailer = await client.post(
        "/admin/retailers",
        json={"name": "Run Retailer", "username": "runret", "password": "password123"},
        headers=headers,
    )
    assert retailer.status_code == 200
    login = await client.post(
        "/auth/login",
        json={"username": "runret", "password": "password123", "organization_slug": "farmorg"},
    )
    r_headers = auth_headers(login.json()["access_token"])
    order = await client.post(
        "/retailer/orders/today",
        json={"items": [{"item_id": item["id"], "requested_kg": "30.000", "total_boxes": 2}]},
        headers=r_headers,
    )
    assert order.status_code == 200
    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "120.000", "vehicle_number": "TN01AB1234"},
        headers=headers,
    )
    assert load.status_code == 200
    run = await client.post(
        "/admin/delivery-runs",
        json={"farm_load_id": load.json()["id"], "order_ids": [order.json()["id"]]},
        headers=headers,
    )
    assert run.status_code == 200
    assert len(run.json()["stops"]) == 1
