import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin


async def _create_retailer_user(
    client: AsyncClient, admin_token: str, *, slug: str, username: str
) -> tuple[dict, dict]:
    headers = auth_headers(admin_token)
    created = await client.post(
        "/admin/retailers",
        json={"name": f"Shop {username}", "username": username, "password": "password123"},
        headers=headers,
    )
    assert created.status_code == 200, created.text
    login = await client.post(
        "/auth/login",
        json={"username": username, "password": "password123", "organization_slug": slug},
    )
    assert login.status_code == 200, login.text
    return created.json(), login.json()


@pytest.mark.asyncio
async def test_retailer_dashboard_after_order(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="rdash")
    retailer, login = await _create_retailer_user(
        client, admin["access_token"], slug="rdash", username="rdash_ret"
    )
    r_headers = auth_headers(login["access_token"])

    placed = await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "30.000", "bird_size": "Medium"},
        headers=r_headers,
    )
    assert placed.status_code == 200

    dash = await client.get("/retailer/dashboard", headers=r_headers)
    assert dash.status_code == 200
    body = dash.json()
    assert body["today_order"] is not None
    assert body["today_order"]["requested_kg"] == "30.000"
    assert body["outstanding"] == retailer["credit_balance"]


@pytest.mark.asyncio
async def test_retailer_orders_pagination(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="rorders")
    _, login = await _create_retailer_user(
        client, admin["access_token"], slug="rorders", username="rorders_ret"
    )
    r_headers = auth_headers(login["access_token"])

    await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "12.000"},
        headers=r_headers,
    )

    today = await client.get("/retailer/orders", params={"scope": "today"}, headers=r_headers)
    assert today.status_code == 200
    assert len(today.json()["items"]) == 1

    history = await client.get("/retailer/orders", params={"scope": "history"}, headers=r_headers)
    assert history.status_code == 200
    assert history.json()["items"] == []


@pytest.mark.asyncio
async def test_retailer_order_detail_tracking(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="rtrack")
    admin_headers = auth_headers(admin["access_token"])
    _, login = await _create_retailer_user(
        client, admin["access_token"], slug="rtrack", username="rtrack_ret"
    )
    r_headers = auth_headers(login["access_token"])

    placed = await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "20.000"},
        headers=r_headers,
    )
    order_id = placed.json()["id"]

    detail = await client.get(f"/retailer/orders/{order_id}", headers=r_headers)
    assert detail.status_code == 200
    stages = detail.json()["tracking_stages"]
    assert any(s["key"] == "pending" and s["active"] for s in stages)

    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "80.000", "vehicle_number": "TN99ZZ1111"},
        headers=admin_headers,
    )
    assert load.status_code == 200
    run = await client.post(
        "/admin/delivery-runs",
        json={"farm_load_id": load.json()["id"], "order_ids": [order_id]},
        headers=admin_headers,
    )
    assert run.status_code == 200

    detail2 = await client.get(f"/retailer/orders/{order_id}", headers=r_headers)
    stages2 = detail2.json()["tracking_stages"]
    assert any(s["key"] == "confirmed" and s["active"] for s in stages2)


@pytest.mark.asyncio
async def test_retailer_bills_scoped(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="rbills")
    admin_headers = auth_headers(admin["access_token"])
    _, login_a = await _create_retailer_user(
        client, admin["access_token"], slug="rbills", username="rbills_a"
    )
    _, login_b = await _create_retailer_user(
        client, admin["access_token"], slug="rbills", username="rbills_b"
    )
    headers_a = auth_headers(login_a["access_token"])
    headers_b = auth_headers(login_b["access_token"])

    await client.put("/admin/rates", json={"rate_per_kg": "180.00"}, headers=admin_headers)

    order_a = await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "25.000"},
        headers=headers_a,
    )
    order_b = await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "30.000"},
        headers=headers_b,
    )
    load = await client.post(
        "/admin/farm-loads",
        json={"loaded_weight_kg": "120.000", "vehicle_number": "TN01AB1234"},
        headers=admin_headers,
    )
    run = await client.post(
        "/admin/delivery-runs",
        json={"farm_load_id": load.json()["id"], "order_ids": [order_a.json()["id"], order_b.json()["id"]]},
        headers=admin_headers,
    )
    stops = run.json()["stops"]
    stop_a = next(s for s in stops if s["retailer_name"] == "Shop rbills_a")
    await client.post(f"/delivery/runs/{run.json()['id']}/start", headers=admin_headers)
    await client.post(
        f"/delivery/stops/{stop_a['id']}/weigh",
        json={"delivered_weight_kg": "24.000", "scale_device_id": "SIM"},
        headers=admin_headers,
    )
    bill = await client.post(
        f"/delivery/stops/{stop_a['id']}/bill/commit",
        json={"cash_payment": "1000", "upi_payment": "0", "checkout_id": "chk-rbills-a"},
        headers=admin_headers,
    )
    assert bill.status_code == 200
    bill_id = bill.json()["id"]

    page_a = await client.get("/retailer/bills", headers=headers_a)
    assert page_a.status_code == 200
    assert len(page_a.json()["items"]) == 1
    assert page_a.json()["items"][0]["id"] == bill_id

    page_b = await client.get("/retailer/bills", headers=headers_b)
    assert page_b.status_code == 200
    assert page_b.json()["items"] == []

    forbidden = await client.get(f"/retailer/bills/{bill_id}", headers=headers_b)
    assert forbidden.status_code == 404


@pytest.mark.asyncio
async def test_retailer_profile(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="rprof")
    retailer, login = await _create_retailer_user(
        client, admin["access_token"], slug="rprof", username="rprof_ret"
    )
    r_headers = auth_headers(login["access_token"])

    profile = await client.get("/retailer/profile", headers=r_headers)
    assert profile.status_code == 200
    body = profile.json()
    assert body["username"] == "rprof_ret"
    assert body["retailer"]["id"] == retailer["id"]


@pytest.mark.asyncio
async def test_bird_size_persisted_on_update(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="rsize")
    _, login = await _create_retailer_user(
        client, admin["access_token"], slug="rsize", username="rsize_ret"
    )
    r_headers = auth_headers(login["access_token"])

    first = await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "15.000", "bird_size": "Small"},
        headers=r_headers,
    )
    assert first.status_code == 200
    assert first.json()["bird_size"] == "Small"

    second = await client.post(
        "/retailer/orders/today",
        json={"requested_kg": "18.000", "bird_size": "Large", "notes": "morning"},
        headers=r_headers,
    )
    assert second.status_code == 200
    body = second.json()
    assert body["bird_size"] == "Large"
    assert body["notes"] == "morning"
    assert body["requested_kg"] == "18.000"
