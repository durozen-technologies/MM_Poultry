from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    slug: str = Field(..., min_length=2, max_length=80, pattern=r"^[a-z0-9_-]+$")


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    is_active: bool | None = None


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    schema_name: str
    is_active: bool


class TenantAdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    password: str = Field(..., min_length=6, max_length=128)


class TenantAdminUpdate(BaseModel):
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


class DeliveryUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)
    mobile_number: str | None = Field(default=None, max_length=30)


class DeliveryUserUpdate(BaseModel):
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)
    mobile_number: str | None = Field(default=None, max_length=30)
