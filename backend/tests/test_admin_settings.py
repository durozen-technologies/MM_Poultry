import uuid
from fastapi.testclient import TestClient

def test_admin_settings_get_default(client: TestClient, mock_admin_auth: None) -> None:
    resp = client.get("/api/v1/admin/settings")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "weight_loss_warn_pct" in data
    assert "weight_loss_alert_pct" in data
    assert "enforce_credit_limit" in data
    assert "id" in data


def test_admin_settings_update(client: TestClient, mock_admin_auth: None) -> None:
    # First get current
    get_resp = client.get("/api/v1/admin/settings")
    assert get_resp.status_code == 200
    orig_warn = float(get_resp.json()["weight_loss_warn_pct"])
    orig_alert = float(get_resp.json()["weight_loss_alert_pct"])
    orig_credit = get_resp.json()["enforce_credit_limit"]

    # Update
    new_warn = orig_warn + 1.0 if orig_warn < 10 else 5.0
    new_alert = new_warn + 2.0
    new_credit = not orig_credit

    payload = {
        "weight_loss_warn_pct": str(new_warn),
        "weight_loss_alert_pct": str(new_alert),
        "enforce_credit_limit": new_credit
    }
    put_resp = client.put("/api/v1/admin/settings", json=payload)
    assert put_resp.status_code == 200, put_resp.text
    
    updated = put_resp.json()
    assert float(updated["weight_loss_warn_pct"]) == new_warn
    assert float(updated["weight_loss_alert_pct"]) == new_alert
    assert updated["enforce_credit_limit"] == new_credit

    # Verify get reflects update
    get2 = client.get("/api/v1/admin/settings")
    assert float(get2.json()["weight_loss_warn_pct"]) == new_warn


def test_admin_settings_unauthorized(client: TestClient) -> None:
    assert client.get("/api/v1/admin/settings").status_code == 401
    assert client.put("/api/v1/admin/settings", json={}).status_code == 401
