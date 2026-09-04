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
    route_id: UUID | None = None,
    unassigned_only: bool = False,
) -> TodayOrdersResponse:
    return await svc.list_today_orders(
        auth.db, route_id=route_id, unassigned_only=unassigned_only
    )


@router.get("/admin/orders", response_model=TodayOrdersResponse)
async def admin_orders_by_date(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    date: IstDate | None = None,
) -> TodayOrdersResponse:
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
