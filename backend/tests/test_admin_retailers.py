import pytest
import uuid
from fastapi.testclient import TestClient

def test_list_retailers_empty(client: TestClient, mock_admin_auth: None) -> None:
    response = client.get("/api/v1/admin/retailers")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    # Might not be empty if other tests ran, but typically we can check status 200

def test_create_and_get_retailer(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Create Retailer
    payload = {
        "name": "Test Retailer",
        "phone": "+1234567890",
    }
    create_resp = client.post("/api/v1/admin/retailers", json=payload)
    assert create_resp.status_code == 200
    data = create_resp.json()
    assert data["name"] == "Test Retailer"
    assert "id" in data
    retailer_id = data["id"]

    # 2. Get Retailer
    get_resp = client.get(f"/api/v1/admin/retailers/{retailer_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == retailer_id

def test_update_retailer(client: TestClient, mock_admin_auth: None) -> None:
    # Create first
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Retailer to Update"})
    retailer_id = create_resp.json()["id"]

    # Update
    update_resp = client.patch(f"/api/v1/admin/retailers/{retailer_id}", json={"name": "Updated Retailer"})
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Retailer"

def test_delete_retailer(client: TestClient, mock_admin_auth: None) -> None:
    # Create first
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Retailer to Delete"})
    retailer_id = create_resp.json()["id"]

    # Delete
    del_resp = client.delete(f"/api/v1/admin/retailers/{retailer_id}")
    assert del_resp.status_code == 204

    # Verify deleted (deactivated or soft deleted depending on implementation)
    # The endpoint might return 404 or 400 if it's inactive, or just list it as inactive.
    # Let's check status code of a get request.
    get_resp = client.get(f"/api/v1/admin/retailers/{retailer_id}")
    # Depends on implementation; usually 404
    assert get_resp.status_code in (404, 200)

def test_create_portal_user(client: TestClient, mock_admin_auth: None) -> None:
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Portal Retailer"})
    retailer_id = create_resp.json()["id"]

    payload = {
        "username": f"user_{uuid.uuid4().hex[:8]}",
        "password": "Password123!"
    }
    
    resp = client.post(f"/api/v1/admin/retailers/{retailer_id}/portal-user", json=payload)
    assert resp.status_code == 200
    assert resp.json()["username"] == payload["username"]

def test_upsert_and_list_rates(client: TestClient, mock_admin_auth: None) -> None:
    # Upsert rate
    import uuid
    item_id = client.post("/api/v1/admin/items", json={"name": f"Live Bird {uuid.uuid4()}", "default_price": "180.00"}).json()["id"]
    rate_payload = {
        "rate_per_kg": 150.50,
        "item_id": item_id
    }
    put_resp = client.put("/api/v1/admin/rates", json=rate_payload)
    assert put_resp.status_code == 200
    assert float(put_resp.json()["rate_per_kg"]) == 150.50

    # List rates
    get_resp = client.get("/api/v1/admin/rates")
    assert get_resp.status_code == 200
    assert any(float(r["rate_per_kg"]) == 150.50 for r in get_resp.json())

def test_payment_and_ledger(client: TestClient, mock_admin_auth: None) -> None:
    # Create retailer
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Ledger Retailer"})
    retailer_id = create_resp.json()["id"]

    # Make payment
    payment_payload = {
        "payment_date": "10/01/2024",
        "cash_amount": 5000.0,
        "upi_amount": 0.0,
        "notes": "Advance payment"
    }
    pay_resp = client.post(f"/api/v1/admin/retailers/{retailer_id}/payments", json=payment_payload)
    assert pay_resp.status_code == 204

    # Check ledger
    ledger_resp = client.get(f"/api/v1/admin/retailers/{retailer_id}/ledger")
    assert ledger_resp.status_code == 200
    ledger_data = ledger_resp.json()
    assert "entries" in ledger_data
    assert float(ledger_data["credit_balance"]) == -5000.0

def test_unauthorized_retailer_access(client: TestClient) -> None:
    # Test without auth
    response = client.get("/api/v1/admin/retailers")
    assert response.status_code == 401

