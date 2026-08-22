from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import PaymentType
from app.schemas.dates import IstDate, IstDateOptional
from app.schemas.retailer import RetailerOut


class PaymentCreate(BaseModel):
    cash_amount: Decimal = Decimal("0.00")
    upi_amount: Decimal = Decimal("0.00")
    payment_date: IstDateOptional = None
    notes: str | None = None
    type: PaymentType = PaymentType.RECEIVED
    is_credit: bool = True


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID
    delivery_bill_id: UUID | None
    payment_date: IstDate
    cash_amount: Decimal
    upi_amount: Decimal
    total_amount: Decimal
    type: PaymentType
    is_credit: bool
    notes: str | None


class RetailerReturnCreate(BaseModel):
    return_date: IstDateOptional = None
    delivery_bill_id: UUID | None = None
    weight_kg: Decimal
    bird_count: int | None = None
    rate_per_kg: Decimal
    total_amount: Decimal
    reason: str | None = None


class RetailerReturnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID
    delivery_bill_id: UUID | None
    return_date: IstDate
    weight_kg: Decimal
    bird_count: int | None
    rate_per_kg: Decimal
    total_amount: Decimal
    reason: str | None
    created_at: IstDate


class LedgerEntry(BaseModel):
    entry_type: str
    entry_date: IstDate
    reference: str | None = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    balance_after: Decimal | None = None
    notes: str | None = None


class LedgerOut(BaseModel):
    retailer: RetailerOut
    opening_balance: Decimal
    credit_balance: Decimal
    entries: list[LedgerEntry]
