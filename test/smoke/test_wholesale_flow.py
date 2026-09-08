import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin, create_default_item


@pytest.mark.asyncio
async def test_wholesale_flow(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="smokeorg")
    item = await create_default_item(client, admin["access_token"])
    headers = auth_headers(admin["access_token"])
    await client.put("/admin/rates", json={"rate_per_kg": "180.00", "item_id": item["id"]}, headers=headers)
    retailer = await client.post(
        "/admin/retailers",
        json={"name": "Smoke Retailer", "username": "smokeret", "password": "password123"},
        headers=headers,
    )
    login = await client.post(
        "/auth/login",
        json={"username": "smokeret", "password": "password123", "organization_slug": "smokeorg"},
    )
    r_headers = auth_headers(login.json()["access_token"])
    order = await client.post(
        "/retailer/orders/today",
        json={"items": [{"item_id": item["id"], "requested_kg": "48.000", "total_boxes": 2}]},
        headers=r_headers,
    )
    order_id = order.json()["id"]
    confirm_resp = await client.post(f"/admin/orders/{order_id}/confirm", headers=headers, json={"expected_delivery_date": "08/09/2026"})
    assert confirm_resp.status_code == 200, confirm_resp.text
    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "120.000", "vehicle_number": "TN01AB1234"},
        headers=headers,
    )
    run = await client.post(
        "/admin/delivery-runs",
        json={"farm_load_id": load.json()["id"], "order_ids": [order.json()["id"]]},
        headers=headers,
    )
    assert run.status_code == 200, run.text
    stop_id = run.json()["stops"][0]["id"]
    await client.post(f"/delivery/runs/{run.json()['id']}/start", headers=headers)
    weigh_resp = await client.post(
        f"/delivery/stops/{stop_id}/weigh",
        json={"items": [{"item_id": item["id"], "weight_kg": 48.0, "delivered_boxes": 1}], "scale_device_id": "BLE-1"},
        headers=headers,
    )
    assert weigh_resp.status_code == 200, weigh_resp.text
    await client.post(
        f"/delivery/stops/{stop_id}/bill/preview",
        json={"cash_payment": "1000", "upi_payment": "0"},
        headers=headers,
    )
    bill = await client.post(
        f"/delivery/stops/{stop_id}/bill/commit",
        json={"cash_payment": "1000", "upi_payment": "0", "checkout_id": "chk-smoke"},
        headers=headers,
    )
    assert bill.status_code == 200, bill.text
    dash = await client.get("/admin/dashboard", headers=headers)
    assert dash.status_code == 200
