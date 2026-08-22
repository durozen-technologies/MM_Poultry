import pytest
from fastapi.testclient import TestClient

def test_list_vehicles_empty(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/vehicles")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_vehicle(client: TestClient, mock_admin_auth: None) -> None:
    payload = {
        "number": "TN-01-AB-1234",
        "capacity_kg": 2500,
        "driver_name": "Test Driver"
    }
    response = client.post("/api/v1/admin/vehicles", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["number"] == "TN-01-AB-1234"
    assert float(data["capacity_kg"]) == 2500
    
def test_update_vehicle(client: TestClient, mock_admin_auth: None) -> None:
    response = client.post("/api/v1/admin/vehicles", json={"number": "TEST-1"})
    vehicle_id = response.json()["id"]
    
    response = client.patch(f"/api/v1/admin/vehicles/{vehicle_id}", json={"driver_name": "New Driver", "is_active": False})
    assert response.status_code == 200
    data = response.json()
    assert data["driver_name"] == "New Driver"
    assert data["is_active"] is False

def test_delete_vehicle(client: TestClient, mock_admin_auth: None) -> None:
    response = client.post("/api/v1/admin/vehicles", json={"number": "TEST-2"})
    vehicle_id = response.json()["id"]
    
    response = client.delete(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert response.status_code == 204
    
def test_unauthorized_access(client: TestClient) -> None:
    response = client.get("/api/v1/admin/vehicles")
    assert response.status_code == 401
