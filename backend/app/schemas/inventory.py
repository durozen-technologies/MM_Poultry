from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.farm import FarmLoadOut


class InventorySummaryItem(BaseModel):
    item_id: UUID
    item_name: str
    total_available_kg: Decimal


class InventorySummaryOut(BaseModel):
    items: list[InventorySummaryItem]


class InventoryFarmLoadOut(FarmLoadOut):
    farm_name: str | None = None
    contact_phone: str | None = None
    delivered_weight_kg: Decimal = Decimal("0")
    available_weight_kg: Decimal = Decimal("0")


class InventoryItemLoadsOut(BaseModel):
    item_id: UUID
    loads: list[InventoryFarmLoadOut]
