from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import ConfirmOrderRequest, DailyOrderOut, TodayOrdersResponse
from app.schemas.dates import IstDate
from app.services import wholesale as svc

router = APIRouter()


@router.get("/admin/orders/today", response_model=TodayOrdersResponse)
async def admin_today_orders(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> TodayOrdersResponse:
    return await svc.list_today_orders(auth.db)


@router.get("/admin/orders", response_model=TodayOrdersResponse)
async def admin_orders_by_date(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    date: IstDate | None = None,
) -> TodayOrdersResponse:
    # If no date, default to today (backward compat)
    if date is None:
        return await svc.list_today_orders(auth.db)
    return await svc.list_orders_by_date(auth.db, date)


@router.post("/admin/orders/{order_id}/confirm", response_model=DailyOrderOut)
async def admin_confirm_order(
    order_id: UUID,
    payload: ConfirmOrderRequest,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> DailyOrderOut:
    return await svc.confirm_order(auth.db, order_id, payload.expected_delivery_date)


@router.post("/admin/orders/{order_id}/cancel", response_model=DailyOrderOut)
async def admin_cancel_order(
    order_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> DailyOrderOut:
    return await svc.cancel_order(auth.db, order_id)
