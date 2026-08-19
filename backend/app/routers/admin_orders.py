from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import TodayOrdersResponse
from app.services import wholesale as svc

router = APIRouter()


@router.get("/admin/orders/today", response_model=TodayOrdersResponse)
async def admin_today_orders(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> TodayOrdersResponse:
    return await svc.list_today_orders(auth.db)
