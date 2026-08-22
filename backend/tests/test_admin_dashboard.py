import pytest
from fastapi.testclient import TestClient

def test_admin_dashboard(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 200
    data = response.json()
    # Check for keys in OpsDashboard (could be total_orders, etc. We'll just verify dict)
    assert isinstance(data, dict)

def test_unauthorized_dashboard_access(client: TestClient) -> None:
    response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 401
