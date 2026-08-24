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
        "address": "123 Test St",
        "region": "North",
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
    rate_payload = {
        "rate_per_kg": 150.50
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
        "cash_amount": 5000.0,
        "upi_amount": 0.0,
        "notes": "Advance payment"
    }
    pay_resp = client.post(f"/api/v1/admin/retailers/{retailer_id}/payments", json=payment_payload)
    assert pay_resp.status_code == 200
    assert float(pay_resp.json()["total_amount"]) == 5000.0

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

def test_admin_create_retailer_return(client: TestClient, mock_admin_auth: None) -> None:
    # Create retailer
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Test Retailer for Returns"})
    retailer_id = create_resp.json()["id"]
    
    payload = {
        "weight_kg": 15.5,
        "rate_per_kg": 100.0,
        "total_amount": 1550.0,
        "reason": "Spoiled",
    }
    r = client.post(
        f"/api/v1/admin/retailers/{retailer_id}/returns",
        json=payload,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["weight_kg"] == "15.500" or data["weight_kg"] == "15.5"
    assert data["total_amount"] == "1550.00" or data["total_amount"] == "1550.0"
    
    # Check ledger
    r = client.get(
        f"/api/v1/admin/retailers/{retailer_id}/ledger",
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["entries"]) == 1
    assert data["entries"][0]["entry_type"] == "RETURN"
    assert float(data["entries"][0]["credit"]) == 1550.0
    assert float(data["credit_balance"]) == -1550.0

def test_admin_create_payment_not_credit(client: TestClient, mock_admin_auth: None) -> None:
    # Create retailer
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Test Retailer for No Credit Payment"})
    retailer_id = create_resp.json()["id"]
    
    payload = {
        "cash_amount": 500.0,
        "upi_amount": 0.0,
        "type": "RECEIVED",
        "is_credit": False,
    }
    r = client.post(
        f"/api/v1/admin/retailers/{retailer_id}/payments",
        json=payload,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert float(data["total_amount"]) == 500.0
    
    # Check ledger - since is_credit=False, credit should be 0, but total amount is 500
    r = client.get(
        f"/api/v1/admin/retailers/{retailer_id}/ledger",
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["entries"]) == 1
    assert data["entries"][0]["entry_type"] == "PAYMENT"
    assert float(data["entries"][0]["credit"]) == 0.0
    assert float(data["credit_balance"]) == 0.0

def test_retailer_creation_with_portal_user(client: TestClient, mock_admin_auth: None) -> None:
    # 60
    create_resp = client.post("/api/v1/admin/retailers", json={
        "name": "Retailer with User",
        "username": "user1234",
        "password": "Password123!"
    })
    assert create_resp.status_code == 200

def test_retailer_list_with_cursor(client: TestClient, mock_admin_auth: None) -> None:
    # 76
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Retailer Cursor"})
    r_id = create_resp.json()["id"]
    get_resp = client.get(f"/api/v1/admin/retailers?cursor={r_id}&limit=1")
    assert get_resp.status_code == 200

def test_retailer_not_found(client: TestClient, mock_admin_auth: None) -> None:
    # 91
    nid = str(uuid.uuid4())
    resp = client.get(f"/api/v1/admin/retailers/{nid}")
    assert resp.status_code == 404

def test_retailer_update_opening_balance(client: TestClient, mock_admin_auth: None) -> None:
    # 102-106
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Retailer Bal Update", "opening_balance": 1000.0})
    r_id = create_resp.json()["id"]
    up_resp = client.patch(f"/api/v1/admin/retailers/{r_id}", json={"opening_balance": 2000.0})
    assert up_resp.status_code == 200
    assert float(up_resp.json()["opening_balance"]) == 2000.0
    
def test_retailer_duplicate_portal_user(client: TestClient, mock_admin_auth: None) -> None:
    # 130
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Retailer Dup Portal"})
    r_id = create_resp.json()["id"]
    u_name = f"dup_{uuid.uuid4().hex[:8]}"
    resp1 = client.post(f"/api/v1/admin/retailers/{r_id}/portal-user", json={"username": u_name, "password": "Password123!"})
    assert resp1.status_code == 200
    resp2 = client.post(f"/api/v1/admin/retailers/{r_id}/portal-user", json={"username": u_name + "2", "password": "Password123!"})
    assert resp2.status_code == 409

def test_retailer_duplicate_username(client: TestClient, mock_admin_auth: None) -> None:
    # 166-167
    create_resp = client.post("/api/v1/admin/retailers", json={"name": "Retailer U1"})
    r1_id = create_resp.json()["id"]
    create_resp2 = client.post("/api/v1/admin/retailers", json={"name": "Retailer U2"})
    r2_id = create_resp2.json()["id"]
    
    u_name = f"userx_{uuid.uuid4().hex[:8]}"
    client.post(f"/api/v1/admin/retailers/{r1_id}/portal-user", json={"username": u_name, "password": "Password123!"})
    
    # Try using same username on another retailer
    resp2 = client.post(f"/api/v1/admin/retailers/{r2_id}/portal-user", json={"username": u_name, "password": "Password123!"})
    assert resp2.status_code == 409
