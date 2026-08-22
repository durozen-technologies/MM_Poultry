import pytest
from fastapi.testclient import TestClient

def test_admin_today_orders_empty(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/orders/today")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_requested_kg" in data

def test_unauthorized_orders_access(client: TestClient) -> None:
    response = client.get("/api/v1/admin/orders/today")
    assert response.status_code == 401
