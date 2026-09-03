import uuid
from fastapi.testclient import TestClient

def test_admin_inventory_get(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Create Farm
    farm_resp = client.post("/api/v1/admin/farms", json={"name": "Inventory Test Farm"})
    assert farm_resp.status_code == 200
    farm_id = farm_resp.json()["id"]

    # 2. Create Item
    item_resp = client.post("/api/v1/admin/items", json={"name": f"InvItem_{uuid.uuid4().hex[:8]}", "default_price": 100})
    assert item_resp.status_code == 200
    item_id = item_resp.json()["id"]

    # 3. Create Farm Load (adds to inventory)
    load_payload = {
        "farm_id": farm_id,
        "item_id": item_id,
        "loaded_weight_kg": 2500.0,
        "rate_per_kg": 95.0,
        "status": "OPEN",
    }
    load_resp = client.post("/api/v1/admin/farm-loads", json=load_payload)
    assert load_resp.status_code == 200
    load_id = load_resp.json()["id"]

    # 4. Check Inventory Summary
    inv_resp = client.get("/api/v1/admin/inventory")
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    assert "items" in inv_data
    
    # Find our item in the inventory summary
    item_summary = next((i for i in inv_data["items"] if i["item_id"] == item_id), None)
    assert item_summary is not None
    assert float(item_summary["total_available_kg"]) == 2500.0

    # 5. Check Inventory Item Loads
    loads_resp = client.get(f"/api/v1/admin/inventory/{item_id}/loads")
    assert loads_resp.status_code == 200
    loads_data = loads_resp.json()
    assert loads_data["item_id"] == item_id
    assert len(loads_data["loads"]) >= 1
    
    our_load = next((l for l in loads_data["loads"] if l["id"] == load_id), None)
    assert our_load is not None
    assert float(our_load["available_weight_kg"]) == 2500.0
    assert float(our_load["loaded_weight_kg"]) == 2500.0
    assert our_load["farm_name"] == "Inventory Test Farm"


def test_admin_inventory_unauthorized(client: TestClient) -> None:
    assert client.get("/api/v1/admin/inventory").status_code == 401
    nid = str(uuid.uuid4())
    assert client.get(f"/api/v1/admin/inventory/{nid}/loads").status_code == 401
