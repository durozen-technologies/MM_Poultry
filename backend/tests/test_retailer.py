import pytest
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from collections.abc import AsyncGenerator, Generator
from datetime import date

from app.auth.dependencies import AuthContext, get_current_auth
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.models.organization import Organization
from app.db.tenant_schema import set_search_path

# Shared IDs for testing
TEST_RETAILER_ID = UUID("00000000-0000-0000-0000-000000000100")
TEST_ORG_ID = UUID("00000000-0000-0000-0000-000000000002")

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
        "requested_kg": "50.5",
        "bird_size": "LARGE",
        "notes": "Testing order"
    }
    response = client.post("/api/v1/retailer/orders/today", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["requested_kg"] == "50.500"
    assert data["status"] == "PLACED"


def test_retailer_get_today_order(client: TestClient, mock_retailer_auth: None):
    response = client.get("/api/v1/retailer/orders/today")
    assert response.status_code == 200
    data = response.json()
    # Should fetch the one we just placed
    assert data is not None
    assert data["requested_kg"] == "50.500"


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
    from app.main import app
    from app.auth.dependencies import get_current_auth, AuthContext
    from app.models.user import User
    from app.models.enums import UserRole
    
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
