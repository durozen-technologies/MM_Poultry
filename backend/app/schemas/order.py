from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrderStatus
from app.schemas.dates import IstDate


class DailyOrderCreate(BaseModel):
    requested_kg: Decimal = Field(gt=0)
    bird_size: str | None = None
    notes: str | None = None


class DailyOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID
    order_date: IstDate
    order_number: str | None = None
    requested_kg: Decimal
    bird_size: str | None = None
    notes: str | None
    status: OrderStatus
    retailer_name: str | None = None
    shop_name: str | None = None


class TodayOrdersResponse(BaseModel):
    items: list[DailyOrderOut]
    total_requested_kg: Decimal
    has_more: bool = False
    next_cursor: str | None = None
