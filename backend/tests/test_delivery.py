import pytest
import uuid
from uuid import UUID
from fastapi.testclient import TestClient
from collections.abc import AsyncGenerator, Generator

from app.auth.dependencies import AuthContext, get_current_auth
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.models.organization import Organization
from app.db.tenant_schema import set_search_path

TEST_ORG_ID = UUID("00000000-0000-0000-0000-000000000002")
TEST_DELIVERY_USER_ID = UUID("00000000-0000-0000-0000-000000000201")

@pytest.fixture
def mock_delivery_auth() -> Generator[None, None, None]:
    delivery_user = User(
        id=TEST_DELIVERY_USER_ID,
        username="delivery_test",
        password_hash="test",
        role=UserRole.DELIVERY,
        is_active=True,
        organization_id=TEST_ORG_ID,
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
            yield AuthContext(
                user=delivery_user,
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


def test_delivery_active_run_empty(client: TestClient, mock_delivery_auth: None):
    response = client.get("/api/v1/delivery/runs/active")
    assert response.status_code == 200


def test_delivery_weigh_invalid_stop(client: TestClient, mock_delivery_auth: None):
    # UUID that doesn't exist
    bad_id = "00000000-0000-0000-0000-000000000999"
    payload = {
        "items": [
            {
                "item_id": "00000000-0000-0000-0000-000000000999",
                "gross_weight_kg": 12,
                "delivered_boxes": 1,
                "empty_box_weight_kg": 2,
                "delivered_bird_count": 20,
            }
        ]
    }
    response = client.post(f"/api/v1/delivery/stops/{bad_id}/weigh", json=payload)
    # Service raises 404
    assert response.status_code == 404
    assert "not found" in response.json()["error"]["message"].lower()


def test_delivery_bill_preview_invalid_stop(client: TestClient, mock_delivery_auth: None):
    bad_id = "00000000-0000-0000-0000-000000000999"
    payload = {
        "cash_payment": 0
    }
    response = client.post(f"/api/v1/delivery/stops/{bad_id}/bill/preview", json=payload)
    assert response.status_code == 404


def test_bill_whatsapp_invalid(client: TestClient, mock_delivery_auth: None):
    bad_id = "00000000-0000-0000-0000-000000000999"
    response = client.patch("/api/v1/delivery/bills/invalid-id/whatsapp")
    assert response.status_code == 422 # Invalid UUID

def test_delivery_run_not_found(client: TestClient, mock_delivery_auth: None) -> None:
    nid = str(uuid.uuid4())
    res = client.post(f"/api/v1/delivery/runs/{nid}/start")
    assert res.status_code == 404
    res = client.post(f"/api/v1/delivery/runs/{nid}/complete")
    assert res.status_code == 404

def test_delivery_stop_not_found(client: TestClient, mock_delivery_auth: None) -> None:
    nid = str(uuid.uuid4())
    # 2. Test weigh
    res = client.post(f"/api/v1/delivery/stops/{nid}/weigh", json={"items": [{"item_id": "00000000-0000-0000-0000-000000000999", "gross_weight_kg": 12, "delivered_boxes": 1, "empty_box_weight_kg": 2}]})
    assert res.status_code == 404
    res = client.post(f"/api/v1/delivery/stops/{nid}/skip")
    assert res.status_code == 404

def test_delivery_bill_not_found(client: TestClient, mock_delivery_auth: None) -> None:
    nid = str(uuid.uuid4())
    res = client.post(f"/api/v1/delivery/stops/{nid}/bill/preview", json={})
    assert res.status_code == 404
    res = client.post(f"/api/v1/delivery/stops/{nid}/bill/commit", json={})
    assert res.status_code == 404
    res = client.patch(f"/api/v1/delivery/bills/{nid}/print-status", json={"print_status": "PRINTED"})
    assert res.status_code == 404
    res = client.patch(f"/api/v1/delivery/bills/{nid}/whatsapp")
    assert res.status_code == 404
    
def test_delivery_run_create_not_found(client: TestClient, mock_admin_auth: None) -> None:
    nid = str(uuid.uuid4())
    # Hit missing delivery-runs POST with admin auth
    res = client.post("/api/v1/admin/delivery-runs", json={"farm_load_id": nid, "order_ids": [nid]})
    assert res.status_code == 404

def test_delivery_full_lifecycle(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Admin setup: Create Farm Load
    farm_resp = client.post("/api/v1/admin/farms", json={"name": "Lifecycle Farm Delivery"})
    farm_id = farm_resp.json()["id"]
    load_resp = client.post("/api/v1/admin/farm-loads", json={"farm_id": farm_id, "loaded_weight_kg": 1000})
    load_id = load_resp.json()["id"]

    # 2. Admin setup: Create Retailer & order
    ret_resp = client.post("/api/v1/admin/retailers", json={"name": "Delivery Ret 1"})
    ret_id = ret_resp.json()["id"]
    
    from app.main import app
    from app.auth.dependencies import get_current_auth, AuthContext
    from app.models.user import User
    from app.models.enums import UserRole
    
    old_override = app.dependency_overrides.get(get_current_auth)
    
    async def _mock_retailer_with_db():
        from app.db.database import get_session_factory
        from app.db.tenant_schema import set_search_path
        session = get_session_factory()()
        await set_search_path(session, "tenant_test")
        try:
            from sqlalchemy import text, select
            from app.models.domain import Item
            test_item_id = uuid.UUID("00000000-0000-0000-0000-000000000999")
            it = await session.scalar(select(Item).where(Item.id == test_item_id))
            if not it:
                it2 = await session.scalar(select(Item).where(Item.name == "Test Bird"))
                if it2:
                    await session.execute(text("DELETE FROM items WHERE name = 'Test Bird'"))
                    await session.commit()
                it = Item(id=test_item_id, name="Test Bird", default_price=100.0, uom="KG")
                session.add(it)
                await session.commit()
                await set_search_path(session, "tenant_test")
            
            yield AuthContext(
                user=User(id=uuid.uuid4(), username="ret", password_hash="", role=UserRole.RETAILER, is_active=True, retailer_id=uuid.UUID(ret_id)),
                organization=None,
                schema_name="tenant_test",
                db=session
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_retailer_with_db
    order_resp = client.post("/api/v1/retailer/orders/today", json={"items": [{"item_id": "00000000-0000-0000-0000-000000000999", "total_boxes": 2, "requested_kg": "50", "bird_size": "LARGE"}]})
    order_id = order_resp.json()["id"]

    confirm_resp = client.post(
        f"/api/v1/admin/orders/{order_id}/confirm",
        json={"expected_delivery_date": order_resp.json().get("order_date", "03/09/2026")},
    )
    assert confirm_resp.status_code == 200

    if old_override:
        app.dependency_overrides[get_current_auth] = old_override
    else:
        app.dependency_overrides.pop(get_current_auth, None)

    # 3. Create Delivery Run
    run_resp = client.post("/api/v1/admin/delivery-runs", json={"farm_load_id": load_id, "order_ids": [order_id]})
    run_id = run_resp.json()["id"]
    stop_id = run_resp.json()["stops"][0]["id"]
    
    # 4. Driver Flow
    async def _mock_driver_with_db():
        from app.db.database import get_session_factory
        from app.db.tenant_schema import set_search_path
        session = get_session_factory()()
        await set_search_path(session, "tenant_test")
        try:
            yield AuthContext(
                user=User(id=uuid.uuid4(), username="driver", password_hash="", role=UserRole.DELIVERY, is_active=True, organization_id=TEST_ORG_ID),
                organization=None,
                schema_name="tenant_test",
                db=session
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
    
    app.dependency_overrides[get_current_auth] = _mock_driver_with_db

    # Driver gets active runs (it shouldn't be active yet because we haven't started it)
    active = client.get("/api/v1/delivery/runs/active")
    assert active.status_code == 200
    
    # Let's start the run
    start_resp = client.post(f"/api/v1/delivery/runs/{run_id}/start")
    assert start_resp.status_code == 200

    # Test skipping stop
    skip_resp = client.post(f"/api/v1/delivery/stops/{stop_id}/skip")
    assert skip_resp.status_code == 200
    assert len(skip_resp.json()["items"]) > 0
    assert skip_resp.json()["items"][0]["delivered_weight_kg"] is None

    # Wait, if we skipped it, we cannot weigh it without overriding.
    # Actually, we can't weigh a skipped stop in the current logic.
    # Let's create another order and run to test weighing.
    
    app.dependency_overrides.pop(get_current_auth, None)
    if old_override:
        app.dependency_overrides[get_current_auth] = old_override

def test_delivery_weigh_and_bill(client: TestClient, mock_admin_auth: None) -> None:
    # 1. Admin setup: Create Farm Load
    farm_resp = client.post("/api/v1/admin/farms", json={"name": "Billing Farm"})
    load_resp = client.post("/api/v1/admin/farm-loads", json={"farm_id": farm_resp.json()["id"], "loaded_weight_kg": 1000})
    load_id = load_resp.json()["id"]

    # 2. Setup Retailer and rate
    ret_resp = client.post("/api/v1/admin/retailers", json={"name": "Billing Ret"})
    ret_id = ret_resp.json()["id"]
    client.put("/api/v1/admin/rates", json={"retailer_id": ret_id, "item_id": "00000000-0000-0000-0000-000000000999", "rate_per_kg": 150.0})

    from app.main import app
    from app.auth.dependencies import get_current_auth, AuthContext
    from app.models.user import User
    from app.models.enums import UserRole
    
    old_override = app.dependency_overrides.get(get_current_auth)
    
    async def _mock_retailer_with_db():
        from app.db.database import get_session_factory
        from app.db.tenant_schema import set_search_path
        session = get_session_factory()()
        await set_search_path(session, "tenant_test")
        try:
            from sqlalchemy import text, select
            from app.models.domain import Item
            test_item_id = uuid.UUID("00000000-0000-0000-0000-000000000999")
            it = await session.scalar(select(Item).where(Item.id == test_item_id))
            if not it:
                it2 = await session.scalar(select(Item).where(Item.name == "Test Bird"))
                if it2:
                    await session.execute(text("DELETE FROM items WHERE name = 'Test Bird'"))
                    await session.commit()
                it = Item(id=test_item_id, name="Test Bird", default_price=100.0, uom="KG")
                session.add(it)
                await session.commit()
                await set_search_path(session, "tenant_test")

            yield AuthContext(
                user=User(id=uuid.uuid4(), username="retb", password_hash="", role=UserRole.RETAILER, is_active=True, retailer_id=uuid.UUID(ret_id)),
                organization=None,
                schema_name="tenant_test",
                db=session
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_retailer_with_db
    order_resp = client.post("/api/v1/retailer/orders/today", json={"items": [{"item_id": "00000000-0000-0000-0000-000000000999", "total_boxes": 4, "requested_kg": "100", "bird_size": "LARGE"}]})
    order_id = order_resp.json()["id"]

    confirm_resp = client.post(
        f"/api/v1/admin/orders/{order_id}/confirm",
        json={"expected_delivery_date": order_resp.json().get("order_date", "03/09/2026")},
    )
    assert confirm_resp.status_code == 200

    if old_override:
        app.dependency_overrides[get_current_auth] = old_override
    else:
        app.dependency_overrides.pop(get_current_auth, None)

    # 3. Create Delivery Run
    run_resp = client.post("/api/v1/admin/delivery-runs", json={"farm_load_id": load_id, "order_ids": [order_id]})
    run_id = run_resp.json()["id"]
    stop_id = run_resp.json()["stops"][0]["id"]
    
    # 4. Start run
    client.post(f"/api/v1/delivery/runs/{run_id}/start")

    # 5. Weigh stop
    weigh_resp = client.post(f"/api/v1/delivery/stops/{stop_id}/weigh", json={
        "items": [
            {
                "item_id": "00000000-0000-0000-0000-000000000999",
                "gross_weight_kg": 97.0,
                "delivered_boxes": 1,
                "empty_box_weight_kg": 1.5,
                "delivered_bird_count": 50
            }
        ]
    })
    assert weigh_resp.status_code == 200
    assert float(weigh_resp.json()["items"][0]["delivered_weight_kg"]) == 95.5

    # 6. Bill preview
    preview_resp = client.post(f"/api/v1/delivery/stops/{stop_id}/bill/preview", json={
        "cash_payment": 1000.0,
        "upi_payment": 500.0
    })
    assert preview_resp.status_code == 200
    p_data = preview_resp.json()
    assert float(p_data["total_amount"]) == 95.5 * 150.0
    assert float(p_data["balance_amount"]) == (95.5 * 150.0) - 1500.0

    # Test error cases: payments exceed total
    err_preview = client.post(f"/api/v1/delivery/stops/{stop_id}/bill/preview", json={
        "cash_payment": 100000.0,
        "upi_payment": 0
    })
    assert err_preview.status_code == 400

    # 7. Bill commit
    commit_resp = client.post(f"/api/v1/delivery/stops/{stop_id}/bill/commit", json={
        "cash_payment": 1000.0,
        "upi_payment": 500.0
    })
    assert commit_resp.status_code == 200
    assert "id" in commit_resp.json()

    # Admin weigh override test
    err_override = client.post(f"/api/v1/delivery/stops/{stop_id}/weigh", json={
        "items": [{"item_id": "00000000-0000-0000-0000-000000000999", "gross_weight_kg": 103.0, "delivered_boxes": 2, "empty_box_weight_kg": 1.5}],
        "weight_override_reason": "Testing admin override"
    })
    # Cannot weigh after billed! Should be 409
    assert err_override.status_code == 409
