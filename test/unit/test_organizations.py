import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.services.wholesale.organizations import (
    create_organization,
    update_organization,
    delete_organization,
    list_tenant_admins,
    create_tenant_admin,
    create_delivery_user,
    list_delivery_users,
    update_delivery_user,
    delete_delivery_user,
    update_tenant_admin,
    delete_tenant_admin
)
from app.schemas import OrganizationCreate, OrganizationUpdate, TenantAdminCreate, DeliveryUserCreate, DeliveryUserUpdate, TenantAdminUpdate
from app.models.organization import Organization
from app.models.user import User
from app.models.enums import UserRole

class FakeOrig(Exception):
    def __str__(self):
        return "user_auth_index unique"

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    mock_org = Organization(id=uuid4(), name="Test", slug="test", schema_name="tenant_test", is_active=True)
    db.scalar.return_value = mock_org
    db.scalars.return_value = [mock_org]
    return db

@pytest.mark.asyncio
async def test_create_organization_reactivate(mock_db):
    mock_org = Organization(id=uuid4(), name="Old", slug="old", schema_name="tenant_old", is_active=False)
    mock_db.scalar.return_value = mock_org
    payload = OrganizationCreate(name="New", slug="old")
    out = await create_organization(mock_db, payload)
    assert out.name == "New"
    assert mock_org.is_active is True
    
@pytest.mark.asyncio
async def test_create_organization_conflict(mock_db):
    mock_org = Organization(id=uuid4(), name="Old", slug="old", schema_name="tenant_old", is_active=True)
    mock_db.scalar.return_value = mock_org
    payload = OrganizationCreate(name="New", slug="old")
    with pytest.raises(HTTPException) as exc:
        await create_organization(mock_db, payload)
    assert exc.value.status_code == 409

@pytest.mark.asyncio
@patch("app.db.tenant_schema.provision_tenant_schema_async", new_callable=AsyncMock)
async def test_create_organization_race(mock_provision, mock_db):
    print("mock_db add type:", type(mock_db.add))
    mock_org = Organization(id=uuid4(), name="New", slug="new", schema_name="tenant_new")
    mock_db.scalar.side_effect = [None, mock_org]
    mock_db.flush.side_effect = IntegrityError("statement", "params", Exception("orig"))
    
    payload = OrganizationCreate(name="New", slug="new")
    with pytest.raises(HTTPException) as exc:
        await create_organization(mock_db, payload)
    assert exc.value.status_code == 409
    
@pytest.mark.asyncio
async def test_update_org_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await update_organization(mock_db, uuid4(), OrganizationUpdate())
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_delete_org_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await delete_organization(mock_db, uuid4())
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_list_tenant_admins_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException):
        await list_tenant_admins(mock_db, uuid4())

@pytest.mark.asyncio
@patch("app.services.auth.require_username_available", new_callable=AsyncMock)
@patch("app.services.auth.upsert_auth_index", new_callable=AsyncMock)
async def test_create_tenant_admin_conflict(mock_upsert, mock_req, mock_db):
    mock_org = Organization(id=uuid4(), name="T", slug="t", schema_name="tenant_t")
    mock_db.scalar.return_value = mock_org
    mock_req.return_value = "username"
    exc = IntegrityError("st", "param", FakeOrig())
    mock_db.flush.side_effect = exc
    with pytest.raises(HTTPException) as e:
        await create_tenant_admin(mock_db, uuid4(), TenantAdminCreate(username="user123", password="password123"))
    assert e.value.status_code == 409

@pytest.mark.asyncio
async def test_delivery_users_crud_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException):
        await create_delivery_user(mock_db, uuid4(), DeliveryUserCreate(username="user123", password="password123", full_name="F"))
    with pytest.raises(HTTPException):
        await list_delivery_users(mock_db, uuid4())
    with pytest.raises(HTTPException):
        await update_delivery_user(mock_db, uuid4(), uuid4(), DeliveryUserUpdate())
    with pytest.raises(HTTPException):
        await delete_delivery_user(mock_db, uuid4(), uuid4())

@pytest.mark.asyncio
async def test_tenant_admin_crud_not_found(mock_db):
    mock_org = Organization(id=uuid4(), name="T", slug="t", schema_name="tenant_t")
    mock_db.scalar.side_effect = [mock_org, None, None]
    with pytest.raises(HTTPException) as e:
        await update_tenant_admin(mock_db, uuid4(), uuid4(), TenantAdminUpdate())
    assert e.value.status_code == 404

    mock_db.scalar.side_effect = [mock_org, None, None]
    with pytest.raises(HTTPException) as e:
        await delete_tenant_admin(mock_db, uuid4(), uuid4())
    assert e.value.status_code == 404

    mock_db.scalar.side_effect = [mock_org, None, None]
    with pytest.raises(HTTPException) as e:
        await update_delivery_user(mock_db, uuid4(), uuid4(), DeliveryUserUpdate())
    assert e.value.status_code == 404

    mock_db.scalar.side_effect = [mock_org, None, None]
    with pytest.raises(HTTPException) as e:
        await delete_delivery_user(mock_db, uuid4(), uuid4())
    assert e.value.status_code == 404

@pytest.mark.asyncio
async def test_update_delivery_user_fields(mock_db):
    mock_org = Organization(id=uuid4(), name="T", slug="t", schema_name="tenant_t")
    mock_user = User(id=uuid4(), username="d", password_hash="h", role=UserRole.DELIVERY, permissions_version=1)
    mock_db.scalar.side_effect = [mock_org, mock_user]
    
    out = await update_delivery_user(mock_db, uuid4(), uuid4(), DeliveryUserUpdate(is_active=False, password="new_password", full_name=" F ", mobile_number=" 123 ", vehicle_name=" V "))
    assert out.is_active is False
    assert mock_user.permissions_version == 3
    assert mock_user.full_name == "F"
    assert mock_user.mobile_number == "123"
    assert mock_user.vehicle_name == "V"

@pytest.mark.asyncio
@patch("app.services.auth.require_username_available", new_callable=AsyncMock)
@patch("app.services.auth.upsert_auth_index", new_callable=AsyncMock)
async def test_create_delivery_user_conflict(mock_upsert, mock_req, mock_db):
    mock_org = Organization(id=uuid4(), name="T", slug="t", schema_name="tenant_t")
    mock_db.scalar.return_value = mock_org
    mock_req.return_value = "username"
    exc = IntegrityError("st", "param", FakeOrig())
    mock_db.flush.side_effect = exc
    with pytest.raises(HTTPException) as e:
        await create_delivery_user(mock_db, uuid4(), DeliveryUserCreate(username="user123", password="password123"))
    assert e.value.status_code == 409
