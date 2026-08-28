import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin, create_default_item


@pytest.mark.asyncio
async def test_today_orders(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="ordersorg")
    item = await create_default_item(client, admin["access_token"])
    headers = auth_headers(admin["access_token"])
    retailer = await client.post(
        "/admin/retailers",
        json={
            "name": "Order Retailer",
            "username": "orderret",
            "password": "password123",
        },
        headers=headers,
    )
    assert retailer.status_code == 200
    login = await client.post(
        "/auth/login",
        json={
            "username": "orderret",
            "password": "password123",
            "organization_slug": "ordersorg",
        },
    )
    assert login.status_code == 200
    r_headers = auth_headers(login.json()["access_token"])
    placed = await client.post(
        "/retailer/orders/today",
        json={"items": [{"item_id": item["id"], "requested_kg": "25.500", "total_boxes": 2}]},
        headers=r_headers,
    )
    assert placed.status_code == 200
    listed = await client.get("/admin/orders/today", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) >= 1
