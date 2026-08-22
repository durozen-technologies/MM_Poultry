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
    assert response.json() is None


def test_delivery_weigh_invalid_stop(client: TestClient, mock_delivery_auth: None):
    # UUID that doesn't exist
    bad_id = "00000000-0000-0000-0000-000000000999"
    payload = {
        "delivered_weight_kg": "50",
        "delivered_bird_count": 20
    }
    response = client.post(f"/api/v1/delivery/stops/{bad_id}/weigh", json=payload)
    # Service raises 404
    assert response.status_code == 404
    assert "not found" in response.json()["error"]["message"].lower()


def test_delivery_bill_preview_invalid_stop(client: TestClient, mock_delivery_auth: None):
    bad_id = "00000000-0000-0000-0000-000000000999"
    payload = {
        "rate_per_kg": "120.0"
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
    res = client.post(f"/api/v1/delivery/stops/{nid}/weigh", json={"delivered_weight_kg": 10})
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
