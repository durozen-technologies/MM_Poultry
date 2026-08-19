from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FarmLoadStatus
from app.schemas.dates import IstDate, IstDateOptional


class FarmCreate(BaseModel):
    name: str
    owner_name: str | None = None
    location: str | None = None
    address: str | None = None
    contact_phone: str | None = None
    capacity: int | None = None


class FarmUpdate(BaseModel):
    name: str | None = None
    owner_name: str | None = None
    location: str | None = None
    address: str | None = None
    contact_phone: str | None = None
    capacity: int | None = None
    is_active: bool | None = None


class FarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_name: str | None = None
    location: str | None
    address: str | None = None
    contact_phone: str | None
    capacity: int | None = None
    is_active: bool


class FarmLoadCreate(BaseModel):
    load_date: IstDateOptional = None
    farm_id: UUID | None = None
    vehicle_id: UUID | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_user_id: UUID | None = None
    loaded_weight_kg: Decimal = Field(gt=0)
    bird_count: int | None = None
    rate_per_kg: Decimal | None = None
    total_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    payment_method: str | None = None
    remarks: str | None = None


class FarmLoadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    load_date: IstDate
    farm_id: UUID | None
    vehicle_id: UUID | None = None
    vehicle_number: str | None
    driver_name: str | None
    loaded_weight_kg: Decimal
    bird_count: int | None
    rate_per_kg: Decimal | None = None
    total_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    payment_method: str | None = None
    remarks: str | None
    status: FarmLoadStatus


class VehicleCreate(BaseModel):
    number: str
    capacity_kg: Decimal | None = None
    driver_name: str | None = None


class VehicleUpdate(BaseModel):
    number: str | None = None
    capacity_kg: Decimal | None = None
    driver_name: str | None = None
    is_active: bool | None = None


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str
    capacity_kg: Decimal | None
    driver_name: str | None
    is_active: bool
