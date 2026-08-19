from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.billing import DeliveryBillOut
from app.schemas.dates import IstDate
from app.schemas.order import DailyOrderOut
from app.schemas.retailer import RetailerOut


class OrderTrackingStage(BaseModel):
    key: str
    label: str
    completed: bool
    active: bool


class RetailerOrderDetailOut(DailyOrderOut):
    estimated_delivery_date: IstDate
    tracking_stages: list[OrderTrackingStage]


class RetailerOrdersPage(BaseModel):
    items: list[DailyOrderOut]
    has_more: bool = False
    next_cursor: str | None = None


class RetailerBillsSummary(BaseModel):
    count: int
    total_amount: Decimal
    total_paid: Decimal
    outstanding: Decimal


class RetailerBillsPage(BaseModel):
    items: list[DeliveryBillOut]
    summary: RetailerBillsSummary
    has_more: bool = False
    next_cursor: str | None = None


class RetailerLastPayment(BaseModel):
    amount: Decimal
    payment_date: IstDate
    method: str | None = None


class RetailerDashboardOut(BaseModel):
    today_order: DailyOrderOut | None = None
    outstanding: Decimal
    last_payment: RetailerLastPayment | None = None
    month_purchase_total: Decimal
    month_payment_total: Decimal


class RetailerProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    retailer: RetailerOut
    username: str
