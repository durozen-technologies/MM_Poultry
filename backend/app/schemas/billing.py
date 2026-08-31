from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PrintStatus
from app.schemas.dates import IstDate, IstDateTime


class BillPreviewRequest(BaseModel):
    cash_payment: Decimal = Field(default=Decimal("0.00"), ge=0)
    upi_payment: Decimal = Field(default=Decimal("0.00"), ge=0)


class BillItemPreviewOut(BaseModel):
    item_id: UUID
    weight_kg: Decimal
    rate_per_kg: Decimal
    amount: Decimal


class BillPreviewOut(BaseModel):
    stop_id: UUID
    retailer_id: UUID
    items: list[BillItemPreviewOut]
    total_amount: Decimal
    cash_payment: Decimal
    upi_payment: Decimal
    balance_amount: Decimal


class BillCommitRequest(BaseModel):
    cash_payment: Decimal = Field(default=Decimal("0.00"), ge=0)
    upi_payment: Decimal = Field(default=Decimal("0.00"), ge=0)
    print_status: PrintStatus = PrintStatus.PENDING
    checkout_id: str | None = Field(default=None, max_length=64)


class DeliveryBillItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_bill_id: UUID
    item_id: UUID
    weight_kg: Decimal
    rate_per_kg: Decimal
    amount: Decimal


class DeliveryBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bill_number: str
    checkout_id: str
    delivery_stop_id: UUID
    retailer_id: UUID
    bill_date: IstDate
    total_amount: Decimal
    cash_payment: Decimal
    upi_payment: Decimal
    balance_amount: Decimal
    print_status: PrintStatus
    whatsapp_shared_at: IstDateTime | None = None
    items: list[DeliveryBillItemOut] = []


class PrintStatusUpdate(BaseModel):
    print_status: PrintStatus
