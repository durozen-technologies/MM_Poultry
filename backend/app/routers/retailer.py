from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import (
    DailyOrderCreate,
    DailyOrderOut,
    DeliveryBillOut,
    LedgerOut,
    RetailerBillsPage,
    RetailerDashboardOut,
    RetailerOrderDetailOut,
    RetailerOrdersPage,
    RetailerProfileOut,
)
from app.services import wholesale as svc

router = APIRouter()


def _require_retailer_id(auth: AuthContext) -> UUID:
    if not auth.user.retailer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retailer not linked")
    return auth.user.retailer_id


@router.get("/retailer/dashboard", response_model=RetailerDashboardOut)
async def retailer_dashboard(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> RetailerDashboardOut:
    return await svc.get_retailer_dashboard(auth.db, _require_retailer_id(auth))


@router.get("/retailer/orders/today", response_model=DailyOrderOut | None)
async def retailer_get_today_order(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> DailyOrderOut | None:
    return await svc.get_today_order_for_retailer(auth.db, _require_retailer_id(auth))


@router.post("/retailer/orders/today", response_model=DailyOrderOut)
async def retailer_upsert_today_order(
    payload: DailyOrderCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> DailyOrderOut:
    return await svc.upsert_today_order(
        auth.db,
        retailer_id=_require_retailer_id(auth),
        payload=payload,
        user_id=auth.user.id,
    )


@router.get("/retailer/orders", response_model=RetailerOrdersPage)
async def retailer_list_orders(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
    scope: Literal["today", "history"] = "today",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> RetailerOrdersPage:
    return await svc.list_retailer_orders(
        auth.db,
        _require_retailer_id(auth),
        scope=scope,
        cursor=cursor,
        limit=limit,
    )


@router.get("/retailer/orders/{order_id}", response_model=RetailerOrderDetailOut)
async def retailer_get_order(
    order_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> RetailerOrderDetailOut:
    return await svc.get_retailer_order_detail(auth.db, _require_retailer_id(auth), order_id)


@router.get("/retailer/bills", response_model=RetailerBillsPage)
async def retailer_list_bills(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> RetailerBillsPage:
    return await svc.list_retailer_bills(
        auth.db,
        _require_retailer_id(auth),
        cursor=cursor,
        limit=limit,
    )


@router.get("/retailer/bills/{bill_id}", response_model=DeliveryBillOut)
async def retailer_get_bill(
    bill_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> DeliveryBillOut:
    return await svc.get_retailer_bill(auth.db, _require_retailer_id(auth), bill_id)


@router.get("/retailer/profile", response_model=RetailerProfileOut)
async def retailer_profile(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> RetailerProfileOut:
    return await svc.get_retailer_profile(
        auth.db, _require_retailer_id(auth), auth.user.username
    )


@router.get("/retailer/ledger", response_model=LedgerOut)
async def retailer_ledger(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> LedgerOut:
    return await svc.get_ledger(auth.db, _require_retailer_id(auth))
