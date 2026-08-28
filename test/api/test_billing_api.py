import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin, create_default_item


@pytest.mark.asyncio
async def test_weigh_preview_commit_flow(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="billorg")
    item = await create_default_item(client, admin["access_token"])
    headers = auth_headers(admin["access_token"])
    await client.put(
        "/admin/rates",
        json={"rate_per_kg": "180.00", "item_id": item["id"]},
        headers=headers,
    )
    retailer = await client.post(
        "/admin/retailers",
        json={"name": "Bill Retailer", "username": "billret", "password": "password123"},
        headers=headers,
    )
    login = await client.post(
        "/auth/login",
        json={"username": "billret", "password": "password123", "organization_slug": "billorg"},
    )
    r_headers = auth_headers(login.json()["access_token"])
    order = await client.post(
        "/retailer/orders/today",
        json={"items": [{"item_id": item["id"], "requested_kg": "40.000", "total_boxes": 2}]},
        headers=r_headers,
    )
    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "100.000", "vehicle_number": "TN99ZZ9999"},
        headers=headers,
    )
    run = await client.post(
        "/admin/delivery-runs",
        json={"farm_load_id": load.json()["id"], "order_ids": [order.json()["id"]]},
        headers=headers,
    )
    stop_id = run.json()["stops"][0]["id"]
    await client.post(f"/delivery/runs/{run.json()['id']}/start", headers=headers)
    weigh = await client.post(
        f"/delivery/stops/{stop_id}/weigh",
        json={"items": [{"item_id": item["id"], "gross_weight_kg": 40.0, "delivered_boxes": 2, "empty_box_weight_kg": 1.5}], "scale_device_id": "SIM"},
        headers=headers,
    )
    assert weigh.status_code == 200
    preview = await client.post(
        f"/delivery/stops/{stop_id}/bill/preview",
        json={"cash_payment": "1000", "upi_payment": "0"},
        headers=headers,
    )
    assert preview.status_code == 200
    commit = await client.post(
        f"/delivery/stops/{stop_id}/bill/commit",
        json={"cash_payment": "1000", "upi_payment": "0", "checkout_id": "chk-test-1"},
        headers=headers,
    )
    assert commit.status_code == 200
    assert commit.json()["bill_number"]
