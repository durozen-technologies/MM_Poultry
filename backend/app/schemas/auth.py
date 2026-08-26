from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str
    organization_slug: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    role: UserRole
    organization_id: UUID | None = None
    retailer_id: UUID | None = None
    is_active: bool
    organization_slug: str | None = None
    organization_name: str | None = None
    full_name: str | None = None
    mobile_number: str | None = None
    retailer_name: str | None = None
    retailer_shop_name: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UsernameAvailableOut(BaseModel):
    available: bool
