from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DeliveryRunStatus, DeliveryStopStatus
from app.schemas.dates import IstDate, IstDateOptional, IstDateTime


class DeliveryRunCreate(BaseModel):
    farm_load_id: UUID
    order_ids: list[UUID]
    run_date: IstDateOptional = None


class DeliveryStopItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    delivery_stop_id: UUID
    item_id: UUID
    ordered_kg: Decimal
    delivered_weight_kg: Decimal | None = None
    rate_per_kg: Decimal
    gross_amount: Decimal | None = None
    delivered_bird_count: int | None = None


class DeliveryStopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_run_id: UUID
    retailer_id: UUID
    daily_order_id: UUID | None
    sequence: int
    status: DeliveryStopStatus
    retailer_name: str | None = None
    shop_name: str | None = None
    items: list[DeliveryStopItemOut] = []


class DeliveryRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farm_load_id: UUID
    run_date: IstDate
    status: DeliveryRunStatus
    started_at: IstDateTime | None = None
    completed_at: IstDateTime | None = None
    stops: list[DeliveryStopOut] = []


class WeighItemRequest(BaseModel):
    item_id: UUID
    delivered_weight_kg: Decimal = Field(gt=0)
    delivered_bird_count: int | None = None


class WeighRequest(BaseModel):
    items: list[WeighItemRequest]
    scale_device_id: str | None = None
    weight_override_reason: str | None = None
