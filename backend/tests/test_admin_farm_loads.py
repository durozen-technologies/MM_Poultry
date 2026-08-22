import pytest
from fastapi.testclient import TestClient

def test_list_farm_loads_empty(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/farm-loads")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_farm_load(client: TestClient, mock_admin_auth: None) -> None:
    # We need a farm to load from
    farm_resp = client.post("/api/v1/admin/farms", json={"name": "Load Test Farm"})
    farm_id = farm_resp.json()["id"]

    payload = {
        "farm_id": farm_id,
        "vehicle_number": "TN-99-9999",
        "driver_name": "Test Driver",
        "loaded_weight_kg": 1500.5,
        "bird_count": 800,
        "rate_per_kg": 100,
        "total_amount": 150050,
        "paid_amount": 0,
        "payment_method": "CASH",
        "remarks": "Test Load"
    }
    response = client.post("/api/v1/admin/farm-loads", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["farm_id"] == farm_id
    assert data["vehicle_number"] == "TN-99-9999"
    assert float(data["loaded_weight_kg"]) == 1500.5
    assert data["status"] == "OPEN"
    
def test_update_farm_load(client: TestClient, mock_admin_auth: None) -> None:
    farm_resp = client.post("/api/v1/admin/farms", json={"name": "Update Load Farm"})
    farm_id = farm_resp.json()["id"]

    response = client.post("/api/v1/admin/farm-loads", json={
        "farm_id": farm_id,
        "loaded_weight_kg": 1000
    })
    load_id = response.json()["id"]
    
    response = client.patch(f"/api/v1/admin/farm-loads/{load_id}", json={"paid_amount": 1000})
    assert response.status_code == 200
    data = response.json()
    assert float(data["paid_amount"]) == 1000

def test_unauthorized_access(client: TestClient) -> None:
    response = client.get("/api/v1/admin/farm-loads")
    assert response.status_code == 401
