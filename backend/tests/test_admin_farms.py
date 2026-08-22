import pytest
from fastapi.testclient import TestClient

# Use async tests when we inject db_session or rely on async fixtures
# But TestClient itself is synchronous.

def test_list_farms_empty(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/farms")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_and_get_farm(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Create a farm
    payload = {
        "name": "Test Farm",
        "owner_name": "Test Owner",
        "location": "Test Village",
        "address": "123 Test St",
        "contact_phone": "9999999999",
        "capacity": 5000
    }
    response = client.post("/api/v1/admin/farms", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Farm"
    farm_id = data["id"]

    # 2. Get the farm
    response = client.get(f"/api/v1/admin/farms/{farm_id}")
    assert response.status_code == 200
    assert response.json()["id"] == farm_id

    # 3. List farms
    response = client.get("/api/v1/admin/farms")
    assert len(response.json()) > 0
    
def test_update_farm(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Create
    response = client.post("/api/v1/admin/farms", json={"name": "Old Name"})
    farm_id = response.json()["id"]
    
    # 2. Update
    response = client.patch(f"/api/v1/admin/farms/{farm_id}", json={"name": "New Name", "is_active": False})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["is_active"] is False

def test_delete_farm(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Create
    response = client.post("/api/v1/admin/farms", json={"name": "To Delete"})
    farm_id = response.json()["id"]
    
    # 2. Delete (deactivate)
    response = client.delete(f"/api/v1/admin/farms/{farm_id}")
    assert response.status_code == 204
    
    # 3. Check it is inactive
    response = client.get(f"/api/v1/admin/farms/{farm_id}")
    assert response.status_code == 200
    assert response.json()["is_active"] is False

def test_unauthorized_access(client: TestClient) -> None:
    response = client.get("/api/v1/admin/farms")
    assert response.status_code == 401
    
    response = client.post("/api/v1/admin/farms", json={"name": "Nope"})
    assert response.status_code == 401
