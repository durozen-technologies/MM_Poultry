from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RouteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    area: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None


class RouteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    area: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None
    is_active: bool | None = None


class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    area: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool
    retailer_count: int = 0
    today_order_count: int = 0


class RouteRetailerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    shop_name: str | None = None
    phone: str | None = None
    area: str | None = None
    is_active: bool


class RouteDetailOut(RouteOut):
    retailers: list[RouteRetailerOut] = Field(default_factory=list)


class RouteRetailersReplace(BaseModel):
    retailer_ids: list[UUID] = Field(default_factory=list)
