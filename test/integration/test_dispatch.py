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
    assert run2.status_code == 400


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


@pytest.mark.asyncio
async def test_admin_dispatch_today_returns_empty(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchtoday1")
    headers = auth_headers(admin["access_token"])

    resp = await client.get("/admin/dispatch/today", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "available_stock_kg" in body
    assert "total_confirmed_kg" in body
    assert "total_remaining_unassigned_kg" in body
    assert "routes" in body
    assert "confirmed_items" in body
    assert "unassigned_items" in body
    assert "available_items" in body
    assert isinstance(body["routes"], list)


@pytest.mark.asyncio
async def test_admin_dispatch_today_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/admin/dispatch/today")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_dispatch_today_with_order(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchtoday2")
    headers = auth_headers(admin["access_token"])
    item = await create_default_item(client, admin["access_token"])
    order_id = await _setup_acknowledged_order(
        client, admin["access_token"], org["slug"], item["id"]
    )

    resp = await client.get("/admin/dispatch/today", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["total_confirmed_kg"]) > 0
    all_orders = []
    for route in body["routes"]:
        all_orders.extend(route.get("orders", []))
    assert len(all_orders) >= 1


@pytest.mark.asyncio
async def test_admin_dispatch_today_with_route(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchtoday3")
    headers = auth_headers(admin["access_token"])

    route = await client.post(
        "/admin/routes",
        json={"name": "Route A", "sort_order": 1},
        headers=headers,
    )
    assert route.status_code in (200, 201)
    route_id = route.json()["id"]

    resp = await client.get("/admin/dispatch/today", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    route_names = [r["route_name"] for r in body["routes"]]
    assert "Route A" in route_names
    assert "Unassigned" in route_names

    route_bucket = next(r for r in body["routes"] if r["route_name"] == "Route A")
    assert route_bucket["route_id"] == route_id
    assert route_bucket["order_count"] == 0
    assert float(route_bucket["confirmed_kg"]) == 0
    assert float(route_bucket["assigned_kg"]) == 0
    assert float(route_bucket["remaining_unassigned_kg"]) == 0
    assert route_bucket["route_status"] == "completed"


@pytest.mark.asyncio
async def test_admin_dispatch_today_with_delivery_run(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchtoday4")
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

    run = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "40.000"}],
        },
        headers=headers,
    )
    assert run.status_code == 200, run.text

    resp = await client.get("/admin/dispatch/today", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    all_runs = []
    for route in body["routes"]:
        all_runs.extend(route.get("runs", []))
    assert len(all_runs) >= 1


@pytest.mark.asyncio
async def test_admin_dispatch_today_cancelled_run(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchtoday5")
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

    run = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "40.000"}],
        },
        headers=headers,
    )
    assert run.status_code == 200
    run_id = run.json()["id"]

    cancel = await client.post(
        f"/admin/delivery-runs/{run_id}/cancel",
        json={"reason": "test cancel"},
        headers=headers,
    )
    assert cancel.status_code == 200

    resp = await client.get("/admin/dispatch/today", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    all_runs = []
    for route in body["routes"]:
        all_runs.extend(route.get("runs", []))
    assert len(all_runs) >= 1
    cancelled_runs = [r for r in all_runs if r["status"] == "CANCELLED"]
    assert len(cancelled_runs) >= 1


@pytest.mark.asyncio
async def test_admin_dispatch_today_multiple_routes(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="dispatchtoday6")
    headers = auth_headers(admin["access_token"])

    route1 = await client.post(
        "/admin/routes",
        json={"name": "Route Alpha", "sort_order": 1},
        headers=headers,
    )
    assert route1.status_code in (200, 201)

    route2 = await client.post(
        "/admin/routes",
        json={"name": "Route Beta", "sort_order": 2},
        headers=headers,
    )
    assert route2.status_code in (200, 201)

    resp = await client.get("/admin/dispatch/today", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    route_names = [r["route_name"] for r in body["routes"]]
    assert "Route Alpha" in route_names
    assert "Route Beta" in route_names
    assert "Unassigned" in route_names
