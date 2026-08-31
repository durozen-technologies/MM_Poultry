from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas.settings import OrgSettingsOut, OrgSettingsUpdate
from app.services.wholesale.common import get_org_settings_out, update_org_settings

router = APIRouter()


@router.get("/admin/settings", response_model=OrgSettingsOut)
async def get_settings(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> OrgSettingsOut:
    settings = await get_org_settings_out(auth.db)
    return OrgSettingsOut.model_validate(settings, from_attributes=True)


@router.put("/admin/settings", response_model=OrgSettingsOut)
async def put_settings(
    payload: OrgSettingsUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> OrgSettingsOut:
    settings = await update_org_settings(auth.db, payload)
    return OrgSettingsOut.model_validate(settings, from_attributes=True)
