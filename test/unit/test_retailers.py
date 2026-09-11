import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.services.wholesale.retailers import (
    create_retailer_portal_user,
    _create_portal_user,
    update_retailer_user,
    delete_retailer_user,
    get_retailer
)
from app.schemas import RetailerPortalUserCreate
from app.models.domain import Retailer
from app.models.user import User
from app.models.enums import UserRole

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    return db

@pytest.mark.asyncio
async def test_get_retailer_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await get_retailer(mock_db, uuid4())
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_create_retailer_portal_user_already_exists(mock_db):
    # first scalar is retailer, second is existing user
    mock_db.scalar.side_effect = [Retailer(id=uuid4()), User(id=uuid4())]
    with pytest.raises(HTTPException) as exc:
        await create_retailer_portal_user(mock_db, uuid4(), RetailerPortalUserCreate(username="user123", password="password123"), organization_id=uuid4(), schema_name="tenant_t")
    assert exc.value.status_code == 409

@pytest.mark.asyncio
@patch("app.services.auth.require_username_available", new_callable=AsyncMock)
@patch("app.services.auth.upsert_auth_index", new_callable=AsyncMock)
async def test_create_portal_user_integrity_error(mock_upsert, mock_req, mock_db):
    mock_req.return_value = "username"
    class FakeOrig(Exception):
        def __str__(self): return "user_auth_index"
    mock_db.flush.side_effect = IntegrityError("st", "p", FakeOrig())
    with pytest.raises(HTTPException) as exc:
        await _create_portal_user(mock_db, retailer_id=uuid4(), username="u", password="p", organization_id=uuid4(), schema_name="s")
    assert exc.value.status_code == 409

@pytest.mark.asyncio
async def test_update_retailer_user_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await update_retailer_user(mock_db, uuid4(), uuid4(), {})
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_delete_retailer_user_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await delete_retailer_user(mock_db, uuid4(), uuid4(), "s")
    assert exc.value.status_code == 404
