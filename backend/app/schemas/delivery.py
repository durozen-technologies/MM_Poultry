from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DeliveryRunStatus, DeliveryStopStatus
from app.schemas.dates import IstDate, IstDateOptional, IstDateTime


class FarmLoadAllocation(BaseModel):
    farm_load_id: UUID
    allocated_kg: Decimal = Field(gt=0)


class OrderItemAdjustment(BaseModel):
    order_id: UUID
    item_id: UUID
    requested_kg: Decimal = Field(gt=0)


class DeliveryRunCreate(BaseModel):
    farm_load_id: UUID | None = None
    farm_load_allocations: list[FarmLoadAllocation] | None = None
    order_ids: list[UUID] = Field(..., min_length=1)
    order_adjustments: list[OrderItemAdjustment] | None = None
    run_date: IstDateOptional = None
    route_id: UUID | None = None
    driver_user_id: UUID | None = None
    driver_name: str | None = Field(default=None, max_length=120)
    vehicle_id: UUID | None = None
    vehicle_number: str | None = Field(default=None, max_length=40)


class DeliveryRunCancel(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class DeliveryRunReconcile(BaseModel):
    returned_kg: Decimal = Field(ge=0)
    wastage_kg: Decimal = Field(ge=0)
    actual_loaded_kg: Decimal | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=500)


class StockAdjustmentCreate(BaseModel):
    entity_type: str = Field(..., max_length=40)
    entity_id: UUID
    adjustment_kg: Decimal
    reason: str = Field(..., min_length=1, max_length=500)


class DeliveryStopItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_stop_id: UUID
    item_id: UUID
    ordered_kg: Decimal
    remaining_kg: Decimal | None = None
    delivered_weight_kg: Decimal | None = None
    delivered_boxes: int | None = None
    gross_weight_kg: Decimal | None = None
    empty_box_weight_kg: Decimal | None = None
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
    failure_reason: str | None = None
    retailer_name: str | None = None
    shop_name: str | None = None
    route_name: str | None = None
    items: list[DeliveryStopItemOut] = []


class DeliveryRunFarmLoadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_run_id: UUID
    farm_load_id: UUID
    allocated_kg: Decimal


class DeliveryRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farm_load_id: UUID | None = None
    route_id: UUID | None = None
    run_date: IstDate
    status: DeliveryRunStatus
    driver_user_id: UUID | None = None
    driver_name: str | None = None
    vehicle_id: UUID | None = None
    vehicle_number: str | None = None
    planned_kg: Decimal | None = None
    actual_loaded_kg: Decimal | None = None
    returned_kg: Decimal | None = None
    wastage_kg: Decimal | None = None
    reconciled_at: IstDateTime | None = None
    reconciliation_notes: str | None = None
    started_at: IstDateTime | None = None
    completed_at: IstDateTime | None = None
    farm_load_links: list[DeliveryRunFarmLoadOut] = []
    stops: list[DeliveryStopOut] = []


class WeighItemRequest(BaseModel):
    item_id: UUID
    gross_weight_kg: Decimal = Field(gt=0)
    delivered_boxes: int = Field(gt=0)
    empty_box_weight_kg: Decimal = Field(ge=0)
    delivered_bird_count: int | None = None


class WeighRequest(BaseModel):
    items: list[WeighItemRequest] = Field(..., min_length=1)
    scale_device_id: str | None = Field(default=None, max_length=120)
    weight_override_reason: str | None = Field(default=None, max_length=500)


class FailStopRequest(BaseModel):
    failure_reason: str = Field(..., min_length=1, max_length=500)
