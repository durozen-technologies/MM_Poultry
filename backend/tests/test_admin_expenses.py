from datetime import date

from fastapi.testclient import TestClient


def test_list_expense_categories_empty(client: TestClient, mock_admin_auth: None):
    response = client.get("/api/v1/admin/expense-categories")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 0


def test_create_and_get_expense_category(client: TestClient, mock_admin_auth: None):
    payload = {"name": "Fuel", "is_active": True}
    response = client.post("/api/v1/admin/expense-categories", json=payload)
    assert response.status_code == 201
    cat = response.json()
    assert cat["name"] == "Fuel"
    assert cat["is_active"] is True
    assert "id" in cat

    response = client.get("/api/v1/admin/expense-categories")
    assert response.status_code == 200
    cats = response.json()
    assert len(cats) >= 1
    assert cats[0]["name"] == "Fuel"


def test_create_duplicate_expense_category(client: TestClient, mock_admin_auth: None):
    payload = {"name": "Duplicate", "is_active": True}
    client.post("/api/v1/admin/expense-categories", json=payload)
    response = client.post("/api/v1/admin/expense-categories", json=payload)
    assert response.status_code == 409
    assert "already exists" in response.json()["error"]["message"].lower()


def test_create_and_list_expense(client: TestClient, mock_admin_auth: None):
    # Setup category
    cat_res = client.post("/api/v1/admin/expense-categories", json={"name": "Salary"})
    cat_id = cat_res.json()["id"]

    # Create expense
    payload = {
        "category_id": cat_id,
        "amount": 1500.50,
        "expense_date": date.today().isoformat(),
        "payment_method": "Cash",
        "notes": "Driver salary"
    }
    response = client.post("/api/v1/admin/expenses", json=payload)
    assert response.status_code == 201
    exp = response.json()
    assert exp["amount"] == "1500.5" or exp["amount"] == 1500.5
    assert exp["category_id"] == cat_id
    assert exp["payment_method"] == "Cash"
    
    # List expenses
    response = client.get("/api/v1/admin/expenses")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    item = data["items"][0]
    assert item["category_name"] == "Salary"
    # test created_by_user_name is present in the response
    assert "created_by_user_name" in item


def test_delete_expense(client: TestClient, mock_admin_auth: None):
    cat_res = client.post("/api/v1/admin/expense-categories", json={"name": "Temp"})
    cat_id = cat_res.json()["id"]

    payload = {
        "category_id": cat_id,
        "amount": 100,
        "expense_date": date.today().isoformat(),
    }
    exp_res = client.post("/api/v1/admin/expenses", json=payload)
    exp_id = exp_res.json()["id"]

    # Delete
    del_res = client.delete(f"/api/v1/admin/expenses/{exp_id}")
    assert del_res.status_code == 204

    # Verify deleted
    list_res = client.get("/api/v1/admin/expenses")
    data = list_res.json()
    assert not any(x["id"] == exp_id for x in data["items"])


def test_unauthorized_expenses_access(client: TestClient):
    response = client.get("/api/v1/admin/expense-categories")
    assert response.status_code == 401
