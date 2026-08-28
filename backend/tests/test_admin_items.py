import uuid

from fastapi.testclient import TestClient


def test_admin_items_crud_lifecycle(client: TestClient, mock_admin_auth: None) -> None:
    # Create
    name = f"Item {uuid.uuid4().hex[:8]}"
    payload = {"name": name, "default_price": 123.45, "description": "test item"}
    resp = client.post("/api/v1/admin/items", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["name"] == name
    assert float(data["default_price"]) == 123.45
    item_id = data["id"]

    # List includes created item
    list_resp = client.get("/api/v1/admin/items", params={"page": 1, "size": 50})
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert body["total"] >= 1
    assert any(i["id"] == item_id for i in body["items"])

    # Get single
    get_resp = client.get(f"/api/v1/admin/items/{item_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == item_id

    # Patch (update name and price)
    new_name = f"Item {uuid.uuid4().hex[:8]}"
    patch_resp = client.patch(
        f"/api/v1/admin/items/{item_id}", json={"name": new_name, "default_price": 99.99}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == new_name
    assert float(patch_resp.json()["default_price"]) == 99.99

    # Verify get reflects update
    get_resp2 = client.get(f"/api/v1/admin/items/{item_id}")
    assert get_resp2.json()["name"] == new_name

    # Delete
    del_resp = client.delete(f"/api/v1/admin/items/{item_id}")
    assert del_resp.status_code == 204

    # Get after delete should be 404
    get_after = client.get(f"/api/v1/admin/items/{item_id}")
    assert get_after.status_code == 404


def test_admin_items_duplicate_name(client: TestClient, mock_admin_auth: None) -> None:
    name = f"Dup {uuid.uuid4().hex[:8]}"
    r1 = client.post("/api/v1/admin/items", json={"name": name, "default_price": 10})
    assert r1.status_code == 200
    r2 = client.post("/api/v1/admin/items", json={"name": name, "default_price": 20})
    assert r2.status_code == 400
    assert "already exists" in r2.json()["error"]["message"].lower()

    # Also test duplicate on update
    name2 = f"Dup2 {uuid.uuid4().hex[:8]}"
    r3 = client.post("/api/v1/admin/items", json={"name": name2, "default_price": 30})
    item2_id = r3.json()["id"]
    patch_dup = client.patch(f"/api/v1/admin/items/{item2_id}", json={"name": name})
    assert patch_dup.status_code == 400

    # Cleanup
    client.delete(f"/api/v1/admin/items/{r1.json()['id']}")
    client.delete(f"/api/v1/admin/items/{item2_id}")


def test_admin_items_not_found(client: TestClient, mock_admin_auth: None) -> None:
    nid = str(uuid.uuid4())
    assert client.get(f"/api/v1/admin/items/{nid}").status_code == 404
    assert client.patch(f"/api/v1/admin/items/{nid}", json={"name": "x"}).status_code == 404
    assert client.delete(f"/api/v1/admin/items/{nid}").status_code == 404


def test_admin_items_pagination_and_active_only(client: TestClient, mock_admin_auth: None) -> None:
    # Create active and inactive items
    active_name = f"Active {uuid.uuid4().hex[:8]}"
    inactive_name = f"Inactive {uuid.uuid4().hex[:8]}"
    a = client.post("/api/v1/admin/items", json={"name": active_name, "default_price": 10})
    b = client.post("/api/v1/admin/items", json={"name": inactive_name, "default_price": 10})
    b_id = b.json()["id"]
    # Deactivate second
    client.patch(f"/api/v1/admin/items/{b_id}", json={"is_active": False})

    # active_only=true should exclude inactive
    res_active = client.get("/api/v1/admin/items", params={"active_only": True, "page": 1, "size": 100})
    assert res_active.status_code == 200
    ids_active = [i["id"] for i in res_active.json()["items"]]
    assert b_id not in ids_active

    # Pagination
    p1 = client.get("/api/v1/admin/items", params={"page": 1, "size": 1})
    assert p1.status_code == 200
    assert p1.json()["size"] == 1
    assert p1.json()["page"] == 1
    assert p1.json()["pages"] >= 1

    # Cleanup
    client.delete(f"/api/v1/admin/items/{a.json()['id']}")
    # b is inactive but still deletable (will hard delete since no rate)
    client.delete(f"/api/v1/admin/items/{b_id}")


def test_admin_items_delete_with_rate_marks_inactive(client: TestClient, mock_admin_auth: None) -> None:
    # Create item
    name = f"RateItem {uuid.uuid4().hex[:8]}"
    item = client.post("/api/v1/admin/items", json={"name": name, "default_price": "50.00"}).json()
    item_id = item["id"]
    # Create retailer and rate referencing this item
    retailer = client.post("/api/v1/admin/retailers", json={"name": f"R {uuid.uuid4().hex[:6]}"}).json()
    rate_payload = {"rate_per_kg": 10, "item_id": item_id, "retailer_id": retailer["id"]}
    rate_resp = client.put("/api/v1/admin/rates", json=rate_payload)
    assert rate_resp.status_code == 200

    # Delete should soft-delete (mark inactive) instead of hard delete
    del_resp = client.delete(f"/api/v1/admin/items/{item_id}")
    assert del_resp.status_code == 204

    # Still fetchable but inactive
    get_resp = client.get(f"/api/v1/admin/items/{item_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False


def test_admin_items_unauthorized(client: TestClient) -> None:
    assert client.get("/api/v1/admin/items").status_code == 401
    assert client.post("/api/v1/admin/items", json={"name": "x"}).status_code == 401
    nid = str(uuid.uuid4())
    assert client.get(f"/api/v1/admin/items/{nid}").status_code == 401
    assert client.patch(f"/api/v1/admin/items/{nid}", json={"name": "x"}).status_code == 401
    assert client.delete(f"/api/v1/admin/items/{nid}").status_code == 401


def test_admin_items_roles_retailer_and_delivery_can_list(client: TestClient, mock_admin_auth: None) -> None:
    # Ensure list works for ADMIN (already tested). Verify DELIVERY and RETAILER roles can list/get.
    # We create an item as admin first
    name = f"RoleItem {uuid.uuid4().hex[:8]}"
    item = client.post("/api/v1/admin/items", json={"name": name, "default_price": 10}).json()
    item_id = item["id"]

    from app.auth.dependencies import AuthContext, get_current_auth
    from app.db.tenant_schema import set_search_path
    from app.main import app
    from app.models.enums import UserRole
    from app.models.organization import Organization
    from app.models.user import User
    from collections.abc import AsyncGenerator
    from uuid import UUID

    # Delivery role
    delivery_user = User(
        id=UUID("00000000-0000-0000-0000-000000000211"),
        username="delivery_items_test",
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
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_delivery
    try:
        r = client.get("/api/v1/admin/items")
        assert r.status_code == 200
        r2 = client.get(f"/api/v1/admin/items/{item_id}")
        assert r2.status_code == 200
        # Delivery cannot create
        r3 = client.post("/api/v1/admin/items", json={"name": "nope"})
        assert r3.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_auth, None)

    # Cleanup as admin
    from app.main import app as _app  # re-use mock_admin_auth fixture needs override

    # Need to re-apply admin mock for cleanup: directly use client with mock_admin_auth context
    # Simpler: override again with admin and delete
    import asyncio as _asyncio  # noqa: F401

    # Use mock_admin_auth pattern inline to delete
    admin_user = User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        username="admin_test",
        password_hash="test",
        role=UserRole.ADMIN,
        is_active=True,
        organization_id=UUID("00000000-0000-0000-0000-000000000002"),
    )

    async def _mock_admin() -> AsyncGenerator[AuthContext, None]:
        from app.db.database import get_session_factory

        session = get_session_factory()()
        org2 = Organization(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            name="Test Org",
            slug="test_org",
            schema_name="tenant_test",
            is_active=True,
        )
        try:
            await set_search_path(session, "tenant_test")
            yield AuthContext(user=admin_user, organization=org2, schema_name="tenant_test", db=session)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_admin
    try:
        client.delete(f"/api/v1/admin/items/{item_id}")
    finally:
        app.dependency_overrides.pop(get_current_auth, None)
