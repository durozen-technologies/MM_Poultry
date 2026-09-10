from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.dates import IstDate, IstDateOptional


class RetailerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    shop_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    route_id: UUID | None = None
    opening_balance: Decimal = Field(default=Decimal("0.00"), ge=0)
    credit_limit: Decimal = Field(default=Decimal("0.00"), ge=0)
    username: str | None = Field(default=None, min_length=3, max_length=80)
    password: str | None = Field(default=None, min_length=6, max_length=128)


class RetailerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    shop_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    route_id: UUID | None = None
    is_active: bool | None = None
    opening_balance: Decimal | None = Field(default=None, ge=0)
    credit_limit: Decimal | None = Field(default=None, ge=0)


class RetailerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    shop_name: str | None
    phone: str | None
    route_id: UUID | None = None
    route_name: str | None = None
    route_area: str | None = None
    is_active: bool
    opening_balance: Decimal
    credit_balance: Decimal
    credit_limit: Decimal = Decimal("0.00")
    has_portal_access: bool = False


class RetailerPortalUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    password: str = Field(..., min_length=6, max_length=128)


class RateUpsert(BaseModel):
    retailer_id: UUID | None = None
    item_id: UUID
    rate_per_kg: Decimal = Field(..., gt=0)
    effective_from: IstDateOptional = None
    effective_to: IstDateOptional = None


class RateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID | None
    item_id: UUID | None
    rate_per_kg: Decimal
    effective_from: IstDate
    effective_to: IstDateOptional = None


class CursorPage(BaseModel):
    items: list
    has_more: bool = False
    next_cursor: str | None = None
