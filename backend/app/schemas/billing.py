from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import PrintStatus
from app.schemas.dates import IstDate, IstDateTime


class BillPreviewRequest(BaseModel):
    cash_payment: Decimal = Decimal("0.00")
    upi_payment: Decimal = Decimal("0.00")


class BillPreviewOut(BaseModel):
    stop_id: UUID
    retailer_id: UUID
    weight_kg: Decimal
    rate_per_kg: Decimal
    total_amount: Decimal
    cash_payment: Decimal
    upi_payment: Decimal
    balance_amount: Decimal


class BillCommitRequest(BaseModel):
    cash_payment: Decimal = Decimal("0.00")
    upi_payment: Decimal = Decimal("0.00")
    print_status: PrintStatus = PrintStatus.PENDING
    checkout_id: str | None = None


class DeliveryBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bill_number: str
    checkout_id: str
    delivery_stop_id: UUID
    retailer_id: UUID
    bill_date: IstDate
    weight_kg: Decimal
    rate_per_kg: Decimal
    total_amount: Decimal
    cash_payment: Decimal
    upi_payment: Decimal
    balance_amount: Decimal
    print_status: PrintStatus
    whatsapp_shared_at: IstDateTime | None = None


class PrintStatusUpdate(BaseModel):
    print_status: PrintStatus
