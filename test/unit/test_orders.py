from app.schemas.order import OrderItemCreate
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import date
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.services.wholesale.orders import (
    upsert_today_order,
    confirm_order,
    cancel_order,
    list_orders_by_date
)
from app.schemas.order import DailyOrderCreate
from app.models.domain import RetailerDailyOrder, Retailer
from app.models.enums import OrderStatus

@pytest.fixture
def mock_db():
    return AsyncMock()

@pytest.mark.asyncio
async def test_upsert_order_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await upsert_today_order(mock_db, retailer_id=uuid4(), payload=DailyOrderCreate(order_id=uuid4(), items=[OrderItemCreate(item_id=uuid4(), total_boxes=1)]), user_id=None)
        await upsert_today_order(mock_db, retailer_id=uuid4(), payload=DailyOrderCreate(order_id=uuid4(), items=[{"item_id": uuid4(), "total_boxes": 1}]), user_id=None)
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_upsert_order_blocked_status(mock_db):
    order = RetailerDailyOrder(id=uuid4(), status=OrderStatus.ACKNOWLEDGED)
    mock_db.scalar.return_value = order
    with pytest.raises(HTTPException) as exc:
        await upsert_today_order(mock_db, retailer_id=uuid4(), payload=DailyOrderCreate(order_id=uuid4(), items=[OrderItemCreate(item_id=uuid4(), total_boxes=1)]), user_id=None)
        await upsert_today_order(mock_db, retailer_id=uuid4(), payload=DailyOrderCreate(order_id=uuid4(), items=[{"item_id": uuid4(), "total_boxes": 1}]), user_id=None)
    assert exc.value.status_code == 409

@pytest.mark.asyncio
async def test_confirm_order_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await confirm_order(mock_db, uuid4(), date.today())
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_confirm_order_wrong_status(mock_db):
    order = RetailerDailyOrder(id=uuid4(), status=OrderStatus.ACKNOWLEDGED)
    mock_db.scalar.return_value = order
    with pytest.raises(HTTPException) as exc:
        await confirm_order(mock_db, uuid4(), date.today())
    assert exc.value.status_code == 400

@pytest.mark.asyncio
async def test_cancel_order_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await cancel_order(mock_db, uuid4())
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_cancel_order_already_cancelled(mock_db):
    order = RetailerDailyOrder(id=uuid4(), status=OrderStatus.CANCELLED)
    mock_db.scalar.return_value = order
    with pytest.raises(HTTPException) as exc:
        await cancel_order(mock_db, uuid4())
    assert exc.value.status_code == 400

@pytest.mark.asyncio
async def test_cancel_order_fulfilled(mock_db):
    order = RetailerDailyOrder(id=uuid4(), status=OrderStatus.FULFILLED)
    mock_db.scalar.return_value = order
    with pytest.raises(HTTPException) as exc:
        await cancel_order(mock_db, uuid4())
    assert exc.value.status_code == 400
    
@pytest.mark.asyncio
async def test_list_orders_exception(mock_db):
    mock_db.execute.side_effect = Exception("DB error")
    with pytest.raises(HTTPException) as exc:
        await list_orders_by_date(mock_db)
    assert exc.value.status_code == 500

