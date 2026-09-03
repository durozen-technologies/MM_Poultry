import uuid
from collections.abc import AsyncGenerator, Generator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import AuthContext, get_current_auth
from app.db.tenant_schema import set_search_path
from app.main import app
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User


def _create_retailer(client: TestClient, name: str | None = None) -> dict:
    label = name or f"Shop_{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/api/v1/admin/retailers",
        json={"name": label, "shop_name": label},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_create_route(client: TestClient, mock_admin_auth: None) -> None:
    resp = client.post(
        "/api/v1/admin/routes",
        json={"name": "North Circuit", "area": "North Chennai"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "North Circuit"
    assert data["area"] == "North Chennai"
    assert data["retailer_count"] == 0


def test_create_route_duplicate_name(client: TestClient, mock_admin_auth: None) -> None:
    client.post("/api/v1/admin/routes", json={"name": "East Route"})
    dup = client.post("/api/v1/admin/routes", json={"name": "east route"})
    assert dup.status_code == 409


def test_assign_retailers_syncs_route_name(client: TestClient, mock_admin_auth: None) -> None:
    route = client.post("/api/v1/admin/routes", json={"name": "West Loop"}).json()
    retailer = _create_retailer(client)

    put = client.put(
        f"/api/v1/admin/routes/{route['id']}/retailers",
        json={"retailer_ids": [retailer["id"]]},
    )
    assert put.status_code == 200
    assert len(put.json()["retailers"]) == 1

    got = client.get(f"/api/v1/admin/retailers/{retailer['id']}").json()
    assert got["route_id"] == route["id"]
    assert got["route_name"] == "West Loop"


def test_cross_route_assign_conflict(client: TestClient, mock_admin_auth: None) -> None:
    route_a = client.post("/api/v1/admin/routes", json={"name": "Route A"}).json()
    route_b = client.post("/api/v1/admin/routes", json={"name": "Route B"}).json()
    retailer = _create_retailer(client)

    client.put(
        f"/api/v1/admin/routes/{route_a['id']}/retailers",
        json={"retailer_ids": [retailer["id"]]},
    )
    conflict = client.put(
        f"/api/v1/admin/routes/{route_b['id']}/retailers",
        json={"retailer_ids": [retailer["id"]]},
    )
    assert conflict.status_code == 409


def test_patch_retailer_route_id(client: TestClient, mock_admin_auth: None) -> None:
    route = client.post("/api/v1/admin/routes", json={"name": "South Belt"}).json()
    retailer = _create_retailer(client)

    patch = client.patch(
        f"/api/v1/admin/retailers/{retailer['id']}",
        json={"route_id": route["id"]},
    )
    assert patch.status_code == 200
    assert patch.json()["route_id"] == route["id"]
    assert patch.json()["route_name"] == "South Belt"


def test_patch_retailer_moves_between_routes(client: TestClient, mock_admin_auth: None) -> None:
    route_a = client.post("/api/v1/admin/routes", json={"name": "Move A"}).json()
    route_b = client.post("/api/v1/admin/routes", json={"name": "Move B"}).json()
    retailer = _create_retailer(client)

    client.patch(f"/api/v1/admin/retailers/{retailer['id']}", json={"route_id": route_a["id"]})
    moved = client.patch(
        f"/api/v1/admin/retailers/{retailer['id']}",
        json={"route_id": route_b["id"]},
    )
    assert moved.status_code == 200
    assert moved.json()["route_id"] == route_b["id"]
    assert moved.json()["route_name"] == "Move B"

    route_a_detail = client.get(f"/api/v1/admin/routes/{route_a['id']}").json()
    assert route_a_detail["retailer_count"] == 0
    route_b_detail = client.get(f"/api/v1/admin/routes/{route_b['id']}").json()
    assert len(route_b_detail["retailers"]) == 1


def test_deactivate_route_unassigns_retailers(client: TestClient, mock_admin_auth: None) -> None:
    route = client.post("/api/v1/admin/routes", json={"name": "Temp Route"}).json()
    retailer = _create_retailer(client)
    client.put(
        f"/api/v1/admin/routes/{route['id']}/retailers",
        json={"retailer_ids": [retailer["id"]]},
    )

    delete = client.delete(f"/api/v1/admin/routes/{route['id']}")
    assert delete.status_code == 204

    got = client.get(f"/api/v1/admin/retailers/{retailer['id']}").json()
    assert got["route_id"] is None
    assert got["route_name"] is None


def test_unassigned_retailers_list(client: TestClient, mock_admin_auth: None) -> None:
    assigned = _create_retailer(client, "Assigned Shop")
    unassigned = _create_retailer(client, "Free Shop")
    route = client.post("/api/v1/admin/routes", json={"name": "Assign Route"}).json()
    client.put(
        f"/api/v1/admin/routes/{route['id']}/retailers",
        json={"retailer_ids": [assigned["id"]]},
    )

    resp = client.get("/api/v1/admin/routes/unassigned-retailers")
    assert resp.status_code == 200
    body = resp.json()
    ids = {item["id"] for item in body["items"]}
    assert unassigned["id"] in ids
    assert assigned["id"] not in ids
    assert body.get("total_count", 0) >= 1


def test_delivery_routes_and_orders(client: TestClient, mock_admin_auth: None) -> None:
    route = client.post("/api/v1/admin/routes", json={"name": "Delivery Route"}).json()
    retailer = _create_retailer(client)
    client.put(
        f"/api/v1/admin/routes/{route['id']}/retailers",
        json={"retailer_ids": [retailer["id"]]},
    )

    delivery_user = User(
        id=UUID("00000000-0000-0000-0000-000000000201"),
        username="delivery_routes_test",
        password_hash="test",
        role=UserRole.DELIVERY,
        is_active=True,
        organization_id=UUID("00000000-0000-0000-0000-000000000002"),
    )

    async def _mock_delivery() -> AsyncGenerator[AuthContext, None]:
        from app.db.database import get_session_factory

        session = get_session_factory()()
        org = Organization(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            name="Test Org",
            slug="test_org",
            schema_name="tenant_test",
            is_active=True,
        )
        try:
            await set_search_path(session, "tenant_test")
            yield AuthContext(user=delivery_user, organization=org, schema_name="tenant_test", db=session)
            await session.commit()
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_delivery
    try:
        routes_resp = client.get("/api/v1/delivery/routes")
        assert routes_resp.status_code == 200
        names = [r["name"] for r in routes_resp.json()]
        assert "Delivery Route" in names

        orders_resp = client.get(f"/api/v1/delivery/routes/{route['id']}/orders")
        assert orders_resp.status_code == 200
        assert "items" in orders_resp.json()
    finally:
        app.dependency_overrides.pop(get_current_auth, None)


def test_routes_unauthorized(client: TestClient) -> None:
    assert client.get("/api/v1/admin/routes").status_code == 401
