from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.dates import IstDate, IstDateOptional


class RetailerCreate(BaseModel):
    name: str
    shop_name: str | None = None
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    whatsapp: str | None = None
    address: str | None = None
    area: str | None = None
    route_name: str | None = None
    category: str | None = None
    notes: str | None = None
    opening_balance: Decimal = Decimal("0.00")
    credit_limit: Decimal = Decimal("0.00")
    preferred_delivery_time: str | None = None
    username: str | None = None
    password: str | None = None


class RetailerUpdate(BaseModel):
    name: str | None = None
    shop_name: str | None = None
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    whatsapp: str | None = None
    address: str | None = None
    area: str | None = None
    route_name: str | None = None
    category: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    opening_balance: Decimal | None = None
    credit_limit: Decimal | None = None
    preferred_delivery_time: str | None = None


class RetailerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    shop_name: str | None
    owner_name: str | None = None
    phone: str | None
    alternate_phone: str | None
    whatsapp: str | None = None
    address: str | None
    area: str | None = None
    route_name: str | None = None
    category: str | None = None
    notes: str | None
    is_active: bool
    opening_balance: Decimal
    credit_balance: Decimal
    credit_limit: Decimal = Decimal("0.00")
    preferred_delivery_time: str | None = None
    has_portal_access: bool = False


class RetailerPortalUserCreate(BaseModel):
    username: str
    password: str


class RateUpsert(BaseModel):
    retailer_id: UUID | None = None
    item_id: UUID
    rate_per_kg: Decimal
    effective_from: IstDateOptional = None
    effective_to: IstDateOptional = None


class RateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID | None
    item_id: UUID
    rate_per_kg: Decimal
    effective_from: IstDate
    effective_to: IstDateOptional = None


class CursorPage(BaseModel):
    items: list
    has_more: bool = False
    next_cursor: str | None = None
