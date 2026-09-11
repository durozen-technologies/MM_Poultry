from collections.abc import AsyncGenerator, Generator
from uuid import UUID, uuid4

import pytest
from app.auth.dependencies import AuthContext, get_current_auth
from app.db.tenant_schema import set_search_path
from app.main import app
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from fastapi.testclient import TestClient

# Shared IDs for testing
TEST_RETAILER_ID = UUID("00000000-0000-0000-0000-000000000100")
TEST_ORG_ID = UUID("00000000-0000-0000-0000-000000000002")
TEST_ITEM_ID = UUID("00000000-0000-0000-0000-000000000999")

@pytest.fixture
def mock_retailer_auth() -> Generator[None, None, None]:
    retailer_user = User(
        id=UUID("00000000-0000-0000-0000-000000000101"),
        username="retailer_test",
        password_hash="test",
        role=UserRole.RETAILER,
        is_active=True,
        organization_id=TEST_ORG_ID,
        retailer_id=TEST_RETAILER_ID,
    )
    
    async def _mock_auth() -> AsyncGenerator[AuthContext, None]:
        from app.db.database import get_session_factory
        session = get_session_factory()()
        org = Organization(
            id=TEST_ORG_ID,
            name="Test Org",
            slug="test_org",
            schema_name="tenant_test",
            is_active=True,
        )
        try:
            await set_search_path(session, "tenant_test")
            
            # Setup the Retailer record if it doesn't exist so the relations work
            from app.models.domain import Retailer
            from sqlalchemy import select
            res = await session.execute(select(Retailer).where(Retailer.id == TEST_RETAILER_ID))
            if not res.scalar_one_or_none():
                ret = Retailer(
                    id=TEST_RETAILER_ID,
                    name="Test Retailer",
                    phone="9999999999",
                    opening_balance=0,
                    credit_balance=0,
                    is_active=True
                )
                session.add(ret)
                await session.commit()
                # Re-apply search path because commit() releases the connection
                await set_search_path(session, "tenant_test")
            
            from app.models.domain import Item
            from sqlalchemy import text
            res2 = await session.execute(select(Item).where(Item.id == TEST_ITEM_ID))
            if not res2.scalar_one_or_none():
                res3 = await session.execute(select(Item).where(Item.name == "Test Bird"))
                existing = res3.scalar_one_or_none()
                if existing:
                    await session.execute(text("DELETE FROM items WHERE name = 'Test Bird'"))
                    await session.commit()
                it = Item(id=TEST_ITEM_ID, name="Test Bird", default_price=100.0, uom="KG")
                session.add(it)
                await session.commit()
                await set_search_path(session, "tenant_test")

            yield AuthContext(
                user=retailer_user,
                organization=org,
                schema_name="tenant_test",
                db=session
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_auth
    yield
    app.dependency_overrides.pop(get_current_auth, None)


def test_retailer_dashboard(client: TestClient, mock_retailer_auth: None):
    response = client.get("/api/v1/retailer/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "outstanding" in data
    assert "month_purchase_total" in data


def test_retailer_upsert_today_order(client: TestClient, mock_retailer_auth: None):
    payload = {
        "items": [
            {
                "item_id": str(TEST_ITEM_ID),
                "total_boxes": 2,
                "requested_kg": "50.5",
                "notes": "morning delivery"
            }
        ]
    }
    response = client.post("/api/v1/retailer/orders/today", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["total_boxes"] == 2
    assert data["items"][0]["requested_kg"] == "50.500"
    assert data["status"] == "PLACED"

    # Second order should work since we dropped unique constraint
    payload2 = {
        "items": [
            {
                "item_id": str(TEST_ITEM_ID),
                "total_boxes": 3
            }
        ]
    }
    res2 = client.post("/api/v1/retailer/orders/today", json=payload2)
    assert res2.status_code == 200


def test_retailer_get_today_orders(client: TestClient, mock_retailer_auth: None):
    # Ensure at least one order exists (upsert)
    client.post(
        "/api/v1/retailer/orders/today",
        json={"items": [{"item_id": str(TEST_ITEM_ID), "total_boxes": 2, "requested_kg": "50.5"}]},
    )
    response = client.get("/api/v1/retailer/orders/today")
    assert response.status_code == 200
    data = response.json()
    # Should fetch the list of orders
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["items"][0]["total_boxes"] == 2
    assert data[0]["items"][0]["requested_kg"] == "50.500"


def test_retailer_list_orders(client: TestClient, mock_retailer_auth: None):
    response = client.get("/api/v1/retailer/orders?scope=history")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(response.json()["items"]) == 0

def test_retailer_order_not_found(client: TestClient, mock_retailer_auth: None) -> None:
    nid = str(uuid4())
    res = client.get(f"/api/v1/retailer/orders/{nid}")
    assert res.status_code == 404
    # Also hit un-hit endpoints
    res = client.get("/api/v1/retailer/dashboard")
    assert res.status_code == 200
    res = client.get("/api/v1/retailer/bills")
    assert res.status_code == 200

def test_retailer_no_retailer_id(client: TestClient):
    from app.auth.dependencies import AuthContext, get_current_auth
    from app.main import app
    from app.models.enums import UserRole
    from app.models.user import User
    
    async def _mock_no_ret():
        yield AuthContext(
            user=User(id=uuid4(), username="noret", password_hash="", role=UserRole.RETAILER, is_active=True, retailer_id=None),
            organization=None,
            schema_name="tenant_test",
            db=None
        )
    
    app.dependency_overrides[get_current_auth] = _mock_no_ret
    try:
        response = client.get("/api/v1/retailer/dashboard")
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_auth, None)

def test_retailer_bill_not_found(client: TestClient, mock_retailer_auth: None) -> None:
    nid = str(uuid4())
    res = client.get(f"/api/v1/retailer/bills/{nid}")
    assert res.status_code == 404


def test_retailer_ledger(client: TestClient, mock_retailer_auth: None):
    response = client.get("/api/v1/retailer/ledger")
    assert response.status_code == 200
    data = response.json()
    assert "entries" in data
    assert "retailer" in data
    assert data["retailer"]["name"] == "Test Retailer"


def test_retailer_profile(client: TestClient, mock_retailer_auth: None):
    response = client.get("/api/v1/retailer/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "retailer_test"
    assert data["retailer"]["id"] == str(TEST_RETAILER_ID)


def test_retailer_cannot_overwrite_acknowledged_order(client: TestClient, mock_retailer_auth: None):
    """Retailer must not place a new order when today's order is already ACKNOWLEDGED."""
    from app.core.timezone import now_ist

    # 1) Place an order as retailer
    payload = {"items": [{"item_id": str(TEST_ITEM_ID), "total_boxes": 5, "requested_kg": "100"}]}
    res = client.post("/api/v1/retailer/orders/today", json=payload)
    assert res.status_code == 200
    order_id = res.json()["id"]

    from app.main import app
    from app.auth.dependencies import get_current_auth
    from app.models.enums import UserRole
    from app.models.user import User
    from app.models.organization import Organization
    from uuid import UUID
    import collections.abc
    
    admin_user = User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        username="admin_test",
        password_hash="test",
        role=UserRole.ADMIN,
        is_active=True,
        organization_id=UUID("00000000-0000-0000-0000-000000000002"),
    )
    async def _mock_admin() -> collections.abc.AsyncGenerator:
        from app.db.database import get_session_factory
        from app.db.tenant_schema import set_search_path
        from app.auth.dependencies import AuthContext
        session = get_session_factory()()
        org2 = Organization(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            name="Test Org",
            slug="test_org",
            schema_name="tenant_test",
            is_active=True,
        )
        try:
            await set_search_path(session, "tenant_test")
            yield AuthContext(user=admin_user, organization=org2, schema_name="tenant_test", db=session)
            await session.commit()
        finally:
            await session.close()
            
    old_override = app.dependency_overrides.get(get_current_auth)
    app.dependency_overrides[get_current_auth] = _mock_admin
    try:
        from datetime import timedelta
        confirm_payload = {"expected_delivery_date": (now_ist().date() + timedelta(days=1)).isoformat()}
        res_confirm = client.post(f"/api/v1/admin/orders/{order_id}/confirm", json=confirm_payload)
        assert res_confirm.status_code == 200
        assert res_confirm.json()["status"] == "ACKNOWLEDGED"
    finally:
        if old_override:
            app.dependency_overrides[get_current_auth] = old_override
        else:
            app.dependency_overrides.pop(get_current_auth, None)

    # 3) Retailer tries to place another order (no order_id) — should NOT overwrite
    payload2 = {"items": [{"item_id": str(TEST_ITEM_ID), "total_boxes": 10}]}
    res2 = client.post("/api/v1/retailer/orders/today", json=payload2)
    assert res2.status_code == 200
    data2 = res2.json()

    # The response should be a NEW order (different id), not the acknowledged one
    assert data2["id"] != order_id, "Retailer should not overwrite an acknowledged order"
    assert data2["status"] == "PLACED"
