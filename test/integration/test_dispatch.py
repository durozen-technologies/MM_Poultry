"""Dispatch board and guard integration tests."""

from datetime import date
from uuid import uuid4

import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_default_item, create_org_with_admin, login


async def _setup_acknowledged_order(
    client: AsyncClient,
    admin_token: str,
    org_slug: str,
    item_id: str,
) -> str:
    headers = auth_headers(admin_token)
    retailer = await client.post(
        "/admin/retailers",
        json={"name": "Dispatch Shop", "shop_name": "Shop A"},
        headers=headers,
    )
    assert retailer.status_code == 200
    rid = retailer.json()["id"]
    username = f"r_{uuid4().hex[:8]}"
    portal = await client.post(
        f"/admin/retailers/{rid}/portal-user",
        json={"username": username, "password": "password123"},
        headers=headers,
    )
    assert portal.status_code == 200
    ret_login = await login(
        client,
        username=username,
        password="password123",
        organization_slug=org_slug,
    )
    ret_headers = auth_headers(ret_login["access_token"])
    order = await client.post(
        "/retailer/orders/today",
        json={
            "items": [
                {
                    "item_id": item_id,
                    "requested_kg": "40.000",
                    "total_boxes": 2,
                    "bird_size": "MEDIUM",
                }
            ]
        },
        headers=ret_headers,
    )
    assert order.status_code == 200, order.text
    order_id = order.json()["id"]
    confirm = await client.post(
        f"/admin/orders/{order_id}/confirm",
        json={"expected_delivery_date": date.today().strftime("%d/%m/%Y")},
        headers=headers,
    )
    assert confirm.status_code == 200, confirm.text
    return order_id


@pytest.mark.asyncio
async def test_dispatch_today_acknowledged_only(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchorg1")
    headers = auth_headers(admin["access_token"])
    item = await create_default_item(client, admin["access_token"])
    await _setup_acknowledged_order(client, admin["access_token"], org["slug"], item["id"])

    dispatch = await client.get("/admin/dispatch/today", headers=headers)
    assert dispatch.status_code == 200
    body = dispatch.json()
    assert "total_remaining_unassigned_kg" in body
    assert body["routes"]
    assert body["confirmed_items"]
    assert body["unassigned_items"]
    assert body["available_items"]

    eligible_orders = [
        o
        for route in body["routes"]
        for o in route["orders"]
    ]
    assert len(eligible_orders) >= 1
    order_line = eligible_orders[0]
    assert order_line["items"]
    item_line = order_line["items"][0]
    assert item_line["item_id"] == item["id"]
    assert item_line["total_boxes"] == 2
    assert float(item_line["requested_kg"]) == 40.0

    route_with_orders = next(
        r for r in body["routes"] if r["confirmed_items"] and r["unassigned_items"]
    )
    assert route_with_orders["confirmed_items"][0]["total_boxes"] == 2
    assert float(route_with_orders["confirmed_items"][0]["total_kg"]) == 40.0


@pytest.mark.asyncio
async def test_double_dispatch_rejected(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchorg2")
    headers = auth_headers(admin["access_token"])
    item = await create_default_item(client, admin["access_token"])
    order_id = await _setup_acknowledged_order(
        client, admin["access_token"], org["slug"], item["id"]
    )

    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "500.000", "item_id": item["id"]},
        headers=headers,
    )
    assert load.status_code == 200
    load_id = load.json()["id"]

    run1 = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "40.000"}],
        },
        headers=headers,
    )
    assert run1.status_code == 200, run1.text

    run2 = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "40.000"}],
        },
        headers=headers,
    )
    assert run2.status_code == 409


@pytest.mark.asyncio
async def test_cancel_run_releases_order(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchorg3")
    headers = auth_headers(admin["access_token"])
    item = await create_default_item(client, admin["access_token"])
    order_id = await _setup_acknowledged_order(
        client, admin["access_token"], org["slug"], item["id"]
    )

    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "200.000", "item_id": item["id"]},
        headers=headers,
    )
    load_id = load.json()["id"]

    run = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "40.000"}],
        },
        headers=headers,
    )
    run_id = run.json()["id"]

    cancel = await client.post(
        f"/admin/delivery-runs/{run_id}/cancel",
        json={"reason": "test"},
        headers=headers,
    )
    assert cancel.status_code == 200

    run_again = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "40.000"}],
        },
        headers=headers,
    )
    assert run_again.status_code == 200, run_again.text
