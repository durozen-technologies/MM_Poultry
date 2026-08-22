import pytest
import uuid
from fastapi.testclient import TestClient

def test_list_delivery_users_empty(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/users/delivery")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_and_get_delivery_user(client: TestClient, mock_admin_auth: None) -> None:
    payload = {
        "username": f"deluser_{uuid.uuid4().hex[:6]}",
        "password": "Password123!",
        "full_name": "Test Delivery User"
    }
    
    # Create
    create_resp = client.post("/api/v1/admin/users/delivery", json=payload)
    assert create_resp.status_code == 200
    data = create_resp.json()
    assert data["username"] == payload["username"]
    assert "id" in data
    
    # List and verify it exists
    list_resp = client.get("/api/v1/admin/users/delivery")
    assert list_resp.status_code == 200
    users = list_resp.json()
    assert any(u["id"] == data["id"] for u in users)

def test_update_delivery_user(client: TestClient, mock_admin_auth: None) -> None:
    # Create
    create_resp = client.post("/api/v1/admin/users/delivery", json={
        "username": f"deluser_{uuid.uuid4().hex[:6]}",
        "password": "Password123!"
    })
    user_id = create_resp.json()["id"]

    # Update
    update_payload = {
        "full_name": "Updated Name",
        "is_active": False
    }
    update_resp = client.patch(f"/api/v1/admin/users/delivery/{user_id}", json=update_payload)
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["full_name"] == "Updated Name"
    assert data["is_active"] is False

def test_delete_delivery_user(client: TestClient, mock_admin_auth: None) -> None:
    # Create
    create_resp = client.post("/api/v1/admin/users/delivery", json={
        "username": f"deluser_{uuid.uuid4().hex[:6]}",
        "password": "Password123!"
    })
    user_id = create_resp.json()["id"]

    # Delete
    del_resp = client.delete(f"/api/v1/admin/users/delivery/{user_id}")
    assert del_resp.status_code == 204

    # List and verify deleted (or inactive, depending on implementation)
    list_resp = client.get("/api/v1/admin/users/delivery")
    users = list_resp.json()
    # It might be filtered out or marked inactive, usually filtered out from list
    assert not any(u["id"] == user_id for u in users)

def test_unauthorized_user_access(client: TestClient) -> None:
    response = client.get("/api/v1/admin/users/delivery")
    assert response.status_code == 401

def test_admin_user_not_found(client: TestClient, mock_admin_auth: None) -> None:
    non_existent_id = uuid.uuid4()
    response = client.patch(
        f"/api/v1/admin/users/delivery/{non_existent_id}",
        json={"full_name": "Test"}
    )
    assert response.status_code == 404
    
    response = client.delete(f"/api/v1/admin/users/delivery/{non_existent_id}")
    assert response.status_code == 404

def test_admin_no_org_id(client: TestClient):
    from app.main import app
    from app.auth.dependencies import get_current_auth, AuthContext
    from app.models.user import User
    from app.models.enums import UserRole
    import uuid

    async def _mock_no_org():
        yield AuthContext(
            user=User(id=uuid.uuid4(), username="noorg", password_hash="", role=UserRole.ADMIN, is_active=True, organization_id=None),
            organization=None,
            schema_name="tenant_test",
            db=None
        )
    
    app.dependency_overrides[get_current_auth] = _mock_no_org
    try:
        response = client.get("/api/v1/admin/users/delivery")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_auth, None)
