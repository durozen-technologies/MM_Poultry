import uuid
from uuid import UUID

from fastapi.testclient import TestClient


def test_retailer_users_list_empty(client: TestClient, mock_admin_auth: None) -> None:
    resp = client.get("/api/v1/admin/users/retailer")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_retailer_users_lifecycle(client: TestClient, mock_admin_auth: None) -> None:
    # Create a retailer + portal user
    retailer = client.post(
        "/api/v1/admin/retailers", json={"name": f"RU {uuid.uuid4().hex[:6]}"}
    ).json()
    rid = retailer["id"]
    uname = f"ru_{uuid.uuid4().hex[:6]}"
    portal = client.post(
        f"/api/v1/admin/retailers/{rid}/portal-user",
        json={"username": uname, "password": "Password123!"},
    )
    assert portal.status_code == 200, portal.text
    user_id = portal.json()["id"]

    # List should contain the new retailer user
    lst = client.get("/api/v1/admin/users/retailer")
    assert lst.status_code == 200
    assert any(u["id"] == user_id for u in lst.json())

    # Patch - deactivate
    patch = client.patch(f"/api/v1/admin/users/retailer/{user_id}", json={"is_active": False})
    assert patch.status_code == 200
    assert patch.json()["is_active"] is False

    # Patch - change password (should increment permissions_version and succeed)
    patch2 = client.patch(f"/api/v1/admin/users/retailer/{user_id}", json={"password": "NewPass123!"})
    assert patch2.status_code == 200

    # Patch - reactivate
    patch3 = client.patch(f"/api/v1/admin/users/retailer/{user_id}", json={"is_active": True})
    assert patch3.status_code == 200
    assert patch3.json()["is_active"] is True

    # Delete
    del_resp = client.delete(f"/api/v1/admin/users/retailer/{user_id}")
    assert del_resp.status_code == 204

    # Verify not in list anymore
    lst2 = client.get("/api/v1/admin/users/retailer")
    assert not any(u["id"] == user_id for u in lst2.json())

    # Verify auth index cleanup - username should be available again via global check
    # (Check via portal user creation with same username should now succeed on another retailer)
    retailer2 = client.post(
        "/api/v1/admin/retailers", json={"name": f"RU2 {uuid.uuid4().hex[:6]}"}
    ).json()
    reuse = client.post(
        f"/api/v1/admin/retailers/{retailer2['id']}/portal-user",
        json={"username": uname, "password": "Password123!"},
    )
    assert reuse.status_code == 200, reuse.text
    # Cleanup
    client.delete(f"/api/v1/admin/users/retailer/{reuse.json()['id']}")


def test_retailer_users_not_found(client: TestClient, mock_admin_auth: None) -> None:
    nid = str(uuid.uuid4())
    assert client.patch(f"/api/v1/admin/users/retailer/{nid}", json={"is_active": False}).status_code == 404
    assert client.delete(f"/api/v1/admin/users/retailer/{nid}").status_code == 404


def test_retailer_users_unauthorized(client: TestClient) -> None:
    assert client.get("/api/v1/admin/users/retailer").status_code == 401
    nid = str(uuid.uuid4())
    assert client.patch(f"/api/v1/admin/users/retailer/{nid}", json={"is_active": False}).status_code == 401
    assert client.delete(f"/api/v1/admin/users/retailer/{nid}").status_code == 401


def test_retailer_users_forbidden_for_non_admin(client: TestClient, mock_admin_auth: None) -> None:
    # Create a delivery user and verify it cannot access retailer users
    from collections.abc import AsyncGenerator

    from app.auth.dependencies import AuthContext, get_current_auth
    from app.db.tenant_schema import set_search_path
    from app.main import app
    from app.models.enums import UserRole
    from app.models.organization import Organization
    from app.models.user import User

    delivery_user = User(
        id=UUID("00000000-0000-0000-0000-000000000212"),
        username="delivery_ru_test",
        password_hash="test",
        role=UserRole.DELIVERY,
        is_active=True,
        organization_id=UUID("00000000-0000-0000-0000-000000000002"),
    )

    async def _mock_delivery() -> AsyncGenerator[AuthContext, None]:
        from app.db.database import get_session_factory

        session = get_session_factory()()
        org = Organization(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            name="Test Org",
            slug="test_org",
            schema_name="tenant_test",
            is_active=True,
        )
        try:
            await set_search_path(session, "tenant_test")
            yield AuthContext(user=delivery_user, organization=org, schema_name="tenant_test", db=session)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_delivery
    try:
        assert client.get("/api/v1/admin/users/retailer").status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_auth, None)
