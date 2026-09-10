from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FarmLoadStatus
from app.schemas.dates import IstDate

# ---------------------------------------------------------------------------
# Farm schemas
# ---------------------------------------------------------------------------


class FarmCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    location: str | None = Field(default=None, max_length=250)
    contact_phone: str | None = Field(default=None, max_length=30)
    capacity: int | None = None
    is_active: bool = True


class FarmUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    location: str | None = Field(default=None, max_length=250)
    contact_phone: str | None = Field(default=None, max_length=30)
    capacity: int | None = None
    is_active: bool | None = None


class FarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    location: str | None = None
    contact_phone: str | None = None
    capacity: int | None = None
    is_active: bool


# ---------------------------------------------------------------------------
# FarmLoad schemas
# ---------------------------------------------------------------------------


class FarmLoadCreate(BaseModel):
    farm_id: UUID | None = None
    item_id: UUID | None = None
    load_date: IstDate | None = None
    driver_name: str | None = Field(default=None, max_length=120)
    driver_user_id: UUID | None = None
    planned_kg: Decimal | None = Field(default=None, gt=0)
    loaded_weight_kg: Decimal = Field(..., gt=0)
    bird_count: int | None = None
    total_boxes: int | None = None
    empty_box_weight: Decimal | None = Field(default=None, ge=0)
    rate_per_kg: Decimal | None = Field(default=None, gt=0)
    remarks: str | None = Field(default=None, max_length=500)


class FarmLoadUpdate(BaseModel):
    driver_name: str | None = Field(default=None, max_length=120)
    planned_kg: Decimal | None = Field(default=None, gt=0)
    loaded_weight_kg: Decimal | None = Field(default=None, gt=0)
    bird_count: int | None = None
    total_boxes: int | None = None
    empty_box_weight: Decimal | None = Field(default=None, ge=0)
    weight_loss_kg: Decimal | None = Field(default=None, ge=0)
    rate_per_kg: Decimal | None = Field(default=None, gt=0)
    total_amount: Decimal | None = Field(default=None, ge=0)
    paid_amount: Decimal | None = Field(default=None, ge=0)
    payment_method: str | None = Field(default=None, max_length=50)
    remarks: str | None = Field(default=None, max_length=500)
    status: FarmLoadStatus | None = None


class FarmLoadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farm_id: UUID | None = None
    item_id: UUID
    load_date: IstDate
    driver_name: str | None = None
    driver_user_id: UUID | None = None
    planned_kg: Decimal | None = None
    loaded_weight_kg: Decimal
    bird_count: int | None = None
    total_boxes: int | None = None
    empty_box_weight: Decimal | None = None
    weight_loss_kg: Decimal | None = None
    rate_per_kg: Decimal | None = None
    total_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    payment_method: str | None = None
    remarks: str | None = None
    status: FarmLoadStatus
