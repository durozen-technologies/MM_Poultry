from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrderStatus
from app.schemas.dates import IstDate


class OrderItemCreate(BaseModel):
    item_id: UUID
    total_boxes: int = Field(gt=0)
    requested_kg: Decimal | None = None
    bird_size: str | None = None
    notes: str | None = None


class DailyOrderCreate(BaseModel):
    order_id: UUID | None = None
    items: list[OrderItemCreate] = Field(..., min_length=1)


class DailyOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    item_id: UUID
    item_name: str | None = None
    total_boxes: int | None = None
    requested_kg: Decimal | None = None
    bird_size: str | None = None
    notes: str | None = None


class ConfirmOrderRequest(BaseModel):
    expected_delivery_date: IstDate = Field(
        ..., description="The estimated delivery date chosen by the admin"
    )


class DailyOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID
    order_date: IstDate
    order_number: str | None = None
    status: OrderStatus
    expected_delivery_date: IstDate | None = None
    retailer_name: str | None = None
    shop_name: str | None = None
    route_id: UUID | None = None
    route_name: str | None = None
    route_area: str | None = None
    retailer_area: str | None = None
    items: list[DailyOrderItemOut] = []


class TodayOrdersResponse(BaseModel):
    items: list[DailyOrderOut]
    has_more: bool = False
    next_cursor: str | None = None
    total_requested_kg: Decimal = Decimal("0.000")
    total_boxes: int = 0
