from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas.dispatch import DispatchTodayOut
from app.services.wholesale.dispatch import get_dispatch_today

router = APIRouter()


@router.get("/admin/dispatch/today", response_model=DispatchTodayOut)
async def admin_dispatch_today(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> DispatchTodayOut:
    return await get_dispatch_today(auth.db)
