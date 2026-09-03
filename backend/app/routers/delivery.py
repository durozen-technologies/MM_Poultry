from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import (
    BillCommitRequest,
    BillPreviewOut,
    BillPreviewRequest,
    DeliveryBillOut,
    DeliveryRunCreate,
    DeliveryRunOut,
    DeliveryStopOut,
    PrintStatusUpdate,
    RouteOut,
    TodayOrdersResponse,
    WeighRequest,
)
from app.services import wholesale as svc


class SkipRequest(BaseModel):
    reason: str | None = None


router = APIRouter()


@router.get("/delivery/routes", response_model=list[RouteOut])
async def delivery_list_routes(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> list[RouteOut]:
    return await svc.list_delivery_routes(auth.db)


@router.get("/delivery/routes/{route_id}/orders", response_model=TodayOrdersResponse)
async def delivery_route_orders(
    route_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> TodayOrdersResponse:
    return await svc.list_orders_for_route(auth.db, route_id)


@router.get("/admin/delivery-runs", response_model=list[DeliveryRunOut])
async def admin_list_runs(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    limit: int = 20,
    offset: int = 0,
) -> list[DeliveryRunOut]:
    # Clamp to production-safe bounds
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return await svc.list_delivery_runs(auth.db, limit=limit, offset=offset)


@router.post("/admin/delivery-runs", response_model=DeliveryRunOut)
async def admin_create_run(
    payload: DeliveryRunCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> DeliveryRunOut:
    return await svc.create_delivery_run(auth.db, payload)


@router.get("/delivery/runs/active", response_model=DeliveryRunOut | None)
async def delivery_active_run(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryRunOut | None:
    driver_id = auth.user.id if auth.user.role == UserRole.DELIVERY else None
    return await svc.get_active_run(auth.db, driver_user_id=driver_id)


@router.post("/delivery/runs/{run_id}/start", response_model=DeliveryRunOut)
async def delivery_start_run(
    run_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryRunOut:
    return await svc.start_delivery_run(auth.db, run_id)


@router.post("/delivery/runs/{run_id}/complete", response_model=DeliveryRunOut)
async def delivery_complete_run(
    run_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryRunOut:
    return await svc.complete_delivery_run(auth.db, run_id)


@router.post("/delivery/stops/{stop_id}/weigh", response_model=DeliveryStopOut)
async def delivery_weigh(
    stop_id: UUID,
    payload: WeighRequest,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryStopOut:
    return await svc.weigh_stop(auth.db, stop_id, payload, actor_role=auth.user.role)


@router.post("/delivery/stops/{stop_id}/skip", response_model=DeliveryStopOut)
async def delivery_skip(
    stop_id: UUID,
    payload: SkipRequest | None = None,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))] = None,  # type: ignore[assignment]
) -> DeliveryStopOut:
    assert auth is not None
    reason = payload.reason if payload else None
    return await svc.skip_stop(auth.db, stop_id, reason=reason)


@router.post("/delivery/stops/{stop_id}/bill/preview", response_model=BillPreviewOut)
async def delivery_bill_preview(
    stop_id: UUID,
    payload: BillPreviewRequest,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> BillPreviewOut:
    return await svc.preview_bill(auth.db, stop_id, payload)


@router.post("/delivery/stops/{stop_id}/bill/commit", response_model=DeliveryBillOut)
async def delivery_bill_commit(
    stop_id: UUID,
    payload: BillCommitRequest,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryBillOut:
    return await svc.commit_bill(auth.db, stop_id, payload)


@router.patch("/delivery/bills/{bill_id}/print-status", response_model=DeliveryBillOut)
async def bill_print_status(
    bill_id: UUID,
    payload: PrintStatusUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryBillOut:
    return await svc.update_bill_print_status(auth.db, bill_id, payload)


@router.patch("/delivery/bills/{bill_id}/whatsapp", response_model=DeliveryBillOut)
async def bill_whatsapp(
    bill_id: UUID,
    auth: Annotated[
        AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN, UserRole.RETAILER))
    ],
) -> DeliveryBillOut:
    return await svc.mark_whatsapp_shared(auth.db, bill_id)
