from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class DispatchOrderItemLine(BaseModel):
    item_id: UUID
    item_name: str | None = None
    total_boxes: int | None = None
    requested_kg: Decimal | None = None


class DispatchItemSummary(BaseModel):
    item_id: UUID
    item_name: str | None = None
    total_boxes: int = 0
    total_kg: Decimal = Decimal("0")


class DispatchOrderLine(BaseModel):
    order_id: UUID
    retailer_id: UUID
    shop_name: str | None = None
    requested_kg: Decimal
    dispatch_status: str
    items: list[DispatchOrderItemLine] = []


class DispatchRunSummary(BaseModel):
    id: UUID
    status: str
    driver_name: str | None = None
    vehicle_number: str | None = None
    planned_kg: Decimal | None = None
    actual_loaded_kg: Decimal | None = None


class DispatchRouteBucket(BaseModel):
    route_id: UUID | None = None
    route_name: str
    confirmed_kg: Decimal
    assigned_kg: Decimal
    delivered_kg: Decimal
    remaining_unassigned_kg: Decimal
    order_count: int
    route_status: str
    confirmed_items: list[DispatchItemSummary] = []
    unassigned_items: list[DispatchItemSummary] = []
    runs: list[DispatchRunSummary] = []
    orders: list[DispatchOrderLine] = []


class DispatchTodayOut(BaseModel):
    available_stock_kg: Decimal
    total_confirmed_kg: Decimal
    total_remaining_unassigned_kg: Decimal
    confirmed_items: list[DispatchItemSummary] = []
    unassigned_items: list[DispatchItemSummary] = []
    available_items: list[DispatchItemSummary] = []
    routes: list[DispatchRouteBucket]
