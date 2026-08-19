from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrganizationCreate(BaseModel):
    name: str
    slug: str


class OrganizationUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    schema_name: str
    is_active: bool


class TenantAdminCreate(BaseModel):
    username: str
    password: str


class TenantAdminUpdate(BaseModel):
    is_active: bool | None = None
    password: str | None = None


class DeliveryUserCreate(BaseModel):
    username: str
    password: str
    full_name: str | None = None
    mobile_number: str | None = None


class DeliveryUserUpdate(BaseModel):
    is_active: bool | None = None
    password: str | None = None
    full_name: str | None = None
    mobile_number: str | None = None
