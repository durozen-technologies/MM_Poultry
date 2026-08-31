import pytest
from fastapi.testclient import TestClient
from uuid import UUID

def test_check_username_available(client: TestClient):
    response = client.get("/api/v1/auth/check-username?username=completely_new_user_123")
    assert response.status_code == 200
    assert response.json()["available"] is True

def test_check_username_not_available(client: TestClient, mock_super_admin_auth: None):
    # Create an org and its admin
    org_payload = {"name": "Auth Org", "slug": "auth_org"}
    org_res = client.post("/api/v1/super-admin/organizations", json=org_payload)
    org_id = org_res.json()["id"]
    
    admin_payload = {"username": "auth_admin", "password": "securePass123", "full_name": "A"}
    client.post(f"/api/v1/super-admin/organizations/{org_id}/admins", json=admin_payload)
    
    response = client.get("/api/v1/auth/check-username?username=auth_admin")
    assert response.status_code == 409
    assert "taken" in response.json()["error"]["message"]


def test_login_invalid_credentials(client: TestClient):
    payload = {
        "username": "nonexistent_user",
        "password": "wrongpassword"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Invalid" in response.json()["error"]["message"]


def test_auth_me(client: TestClient, mock_admin_auth: None):
    # mock_admin_auth is imported from conftest.py implicitly by pytest fixtures
    # It sets the user as admin_test with role ADMIN
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin_test"
    assert data["role"] == "ADMIN"
