from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas.order import (
    ConfirmOrderRequest,
    DailyOrderCreate,
    DailyOrderOut,
    SetOrderPricesRequest,
    TodayOrdersResponse,
)
from app.schemas.billing import DeliveryBillOut
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
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
    date: IstDate | None = None,
    start_date: IstDate | None = None,
    end_date: IstDate | None = None,
    retailer_id: UUID | None = None,
) -> TodayOrdersResponse:
    return await svc.list_orders_by_date(
        auth.db,
        target_date=date,
        start_date=start_date,
        end_date=end_date,
        retailer_id=retailer_id,
    )


@router.post("/admin/orders/{order_id}/confirm", response_model=DailyOrderOut)
async def admin_confirm_order(
    order_id: UUID,
    payload: ConfirmOrderRequest,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> DailyOrderOut:
    return await svc.confirm_order(auth.db, order_id, payload)


@router.post("/admin/orders/{order_id}/cancel", response_model=DailyOrderOut)
async def admin_cancel_order(
    order_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> DailyOrderOut:
    return await svc.cancel_order(auth.db, order_id)


@router.post("/admin/orders/{order_id}/set-prices", response_model=DailyOrderOut)
async def admin_set_order_prices(
    order_id: UUID,
    payload: SetOrderPricesRequest,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> DailyOrderOut:
    return await svc.set_order_prices(auth.db, order_id, payload)


@router.post("/admin/orders/{order_id}/make-billed", response_model=DeliveryBillOut)
async def admin_make_order_billed(
    order_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> DeliveryBillOut:
    return await svc.make_order_billed(auth.db, order_id)


@router.post("/admin/retailers/{retailer_id}/orders", response_model=DailyOrderOut)
async def admin_create_retailer_order(
    retailer_id: UUID,
    payload: DailyOrderCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> DailyOrderOut:
    try:
        return await svc.upsert_today_order(
            auth.db,
            retailer_id=retailer_id,
            payload=payload,
            user_id=auth.user.id,
        )
    except ValueError as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/admin/orders/{order_id}/bill", response_model=DeliveryBillOut)
async def admin_get_order_bill(
    order_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> DeliveryBillOut:
    from fastapi import HTTPException, status
    bill = await svc.get_bill_by_order_id(auth.db, order_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found for this order")
    return bill
