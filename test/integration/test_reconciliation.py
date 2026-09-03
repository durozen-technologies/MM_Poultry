"""Reconciliation gate integration tests."""

from datetime import date
from uuid import uuid4

import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_default_item, create_org_with_admin, login


async def _ack_order(client: AsyncClient, admin_token: str, org_slug: str, item_id: str) -> tuple[str, str]:
    headers = auth_headers(admin_token)
    retailer = await client.post(
        "/admin/retailers",
        json={"name": "Recon Shop"},
        headers=headers,
    )
    rid = retailer.json()["id"]
    username = f"rc_{uuid4().hex[:8]}"
    await client.post(
        f"/admin/retailers/{rid}/portal-user",
        json={"username": username, "password": "password123"},
        headers=headers,
    )
    ret_login = await login(client, username=username, password="password123", organization_slug=org_slug)
    order = await client.post(
        "/retailer/orders/today",
        json={
            "items": [
                {
                    "item_id": item_id,
                    "requested_kg": "50.000",
                    "total_boxes": 2,
                    "bird_size": "MEDIUM",
                }
            ]
        },
        headers=auth_headers(ret_login["access_token"]),
    )
    order_id = order.json()["id"]
    await client.post(
        f"/admin/orders/{order_id}/confirm",
        json={"expected_delivery_date": date.today().strftime("%d/%m/%Y")},
        headers=headers,
    )
    return rid, order_id


@pytest.mark.asyncio
async def test_complete_requires_reconciliation(client: AsyncClient) -> None:
    org, admin = await create_org_with_admin(client, slug="reconorg1")
    headers = auth_headers(admin["access_token"])
    item = await create_default_item(client, admin["access_token"])
    _, order_id = await _ack_order(client, admin["access_token"], org["slug"], item["id"])

    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "100.000", "item_id": item["id"]},
        headers=headers,
    )
    load_id = load.json()["id"]
    run = await client.post(
        "/admin/delivery-runs",
        json={
            "order_ids": [order_id],
            "farm_load_allocations": [{"farm_load_id": load_id, "allocated_kg": "50.000"}],
        },
        headers=headers,
    )
    run_id = run.json()["id"]
    stop_id = run.json()["stops"][0]["id"]

    await client.post(f"/delivery/runs/{run_id}/start", headers=headers)
    await client.post(
        f"/delivery/stops/{stop_id}/skip",
        headers=headers,
    )

    complete = await client.post(f"/delivery/runs/{run_id}/complete", headers=headers)
    assert complete.status_code == 400

    reconcile = await client.post(
        f"/delivery/runs/{run_id}/reconcile",
        json={"returned_kg": "50.000", "wastage_kg": "0.000"},
        headers=headers,
    )
    assert reconcile.status_code == 200

    complete2 = await client.post(f"/delivery/runs/{run_id}/complete", headers=headers)
    assert complete2.status_code == 200
