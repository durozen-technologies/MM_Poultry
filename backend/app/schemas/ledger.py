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
    notes: str | None


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
