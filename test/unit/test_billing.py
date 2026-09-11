import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from app.services.wholesale.billing import (
    weigh_stop,
    preview_bill,
    commit_bill,
    update_bill_print_status,
    record_standalone_payment,
    mark_whatsapp_shared,
)
from app.schemas.billing import BillCommitRequest, BillPreviewRequest, PaymentCreateRequest, PrintStatusUpdate
from app.models.domain import DeliveryBill
from app.models.enums import DeliveryStopStatus, PaymentType, PrintStatus, UserRole
from app.schemas.delivery import WeighItemRequest, WeighRequest


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.asyncio
async def test_update_bill_print_status_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await update_bill_print_status(mock_db, uuid4(), PrintStatusUpdate(print_status=PrintStatus.PRINTED))
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_bill_print_status_noop(mock_db):
    bill = DeliveryBill(
        id=uuid4(),
        print_status=PrintStatus.PRINTED,
        bill_number="BILL-001",
        checkout_id="checkout-001",
        delivery_stop_id=uuid4(),
        retailer_id=uuid4(),
        bill_date=date.today(),
        total_amount=Decimal("100.00"),
        cash_payment=Decimal("0.00"),
        upi_payment=Decimal("0.00"),
        balance_amount=Decimal("100.00"),
        overall_balance=Decimal("0.00"),
    )
    mock_db.scalar.return_value = bill
    out = await update_bill_print_status(mock_db, bill.id, PrintStatusUpdate(print_status=PrintStatus.PRINTED))
    assert out.print_status == PrintStatus.PRINTED


@pytest.mark.asyncio
async def test_record_standalone_payment_zero(mock_db):
    with pytest.raises(HTTPException) as exc:
        await record_standalone_payment(
            mock_db, uuid4(),
            PaymentCreateRequest(cash_amount=Decimal("0"), upi_amount=Decimal("0"), payment_date=date.today()),
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_record_standalone_payment_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await record_standalone_payment(
            mock_db, uuid4(),
            PaymentCreateRequest(cash_amount=Decimal("100"), payment_date=date.today()),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_mark_whatsapp_shared_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await mark_whatsapp_shared(mock_db, uuid4())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_weigh_stop_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await weigh_stop(
            mock_db, uuid4(),
            WeighRequest(items=[WeighItemRequest(item_id=uuid4(), weight_kg=Decimal("1.0"), delivered_boxes=1)]),
            actor_role=UserRole.DELIVERY,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_preview_bill_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await preview_bill(mock_db, uuid4(), BillPreviewRequest())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_commit_bill_not_found(mock_db):
    mock_db.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await commit_bill(mock_db, uuid4(), payload=BillCommitRequest())
    assert exc.value.status_code == 404
