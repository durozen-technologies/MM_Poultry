from __future__ import annotations

from io import BytesIO
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthContext, get_current_auth, require_roles
from app.core.timezone import ist_month_bounds, ist_week_bounds, parse_ist_date, today_ist
from app.db.session import get_platform_db
from app.models.enums import UserRole
from app.schemas import (
    BillCommitRequest,
    BillPreviewOut,
    BillPreviewRequest,
    CursorPage,
    DailyOrderCreate,
    DailyOrderOut,
    DeliveryBillOut,
    DeliveryRunCreate,
    DeliveryRunOut,
    DeliveryStopOut,
    FarmCreate,
    FarmLoadCreate,
    FarmLoadOut,
    FarmOut,
    LedgerOut,
    LoginRequest,
    LoginResponse,
    OpsDashboard,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    PaymentCreate,
    PaymentOut,
    PrintStatusUpdate,
    RateOut,
    RateUpsert,
    ReportSummary,
    RetailerCreate,
    RetailerOut,
    RetailerUpdate,
    TenantAdminCreate,
    TenantAdminUpdate,
    TodayOrdersResponse,
    TripWeightLossOut,
    UserOut,
    VehicleCreate,
    VehicleOut,
    WeighRequest,
)
from app.services import wholesale as svc
from app.services.auth import login_user

router = APIRouter()
health_router = APIRouter()


@health_router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
) -> LoginResponse:
    return await login_user(db, payload)


@router.get("/auth/me", response_model=UserOut)
async def me(auth: Annotated[AuthContext, Depends(get_current_auth)]) -> UserOut:
    return UserOut(
        id=auth.user.id,
        username=auth.user.username,
        role=auth.user.role,
        organization_id=auth.user.organization_id,
        retailer_id=auth.user.retailer_id,
        is_active=auth.user.is_active,
        organization_slug=auth.organization.slug if auth.organization else None,
        organization_name=auth.organization.name if auth.organization else None,
    )


# --- Super admin ---


@router.get("/super-admin/organizations", response_model=list[OrganizationOut])
async def list_orgs(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> list[OrganizationOut]:
    return await svc.list_organizations(auth.db)


@router.post("/super-admin/organizations", response_model=OrganizationOut)
async def create_org(
    payload: OrganizationCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> OrganizationOut:
    # provision needs commit after create — use platform search path
    from app.db.tenant_schema import set_search_path

    await set_search_path(auth.db, None)
    return await svc.create_organization(auth.db, payload)


@router.patch("/super-admin/organizations/{org_id}", response_model=OrganizationOut)
async def update_org(
    org_id: UUID,
    payload: OrganizationUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> OrganizationOut:
    return await svc.update_organization(auth.db, org_id, payload)


@router.delete("/super-admin/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org(
    org_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> None:
    await svc.delete_organization(auth.db, org_id)


@router.get("/super-admin/organizations/{org_id}/admins", response_model=list[UserOut])
async def list_tenant_admins(
    org_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> list[UserOut]:
    return await svc.list_tenant_admins(auth.db, org_id)


@router.post("/super-admin/organizations/{org_id}/admins", response_model=UserOut)
async def create_tenant_admin(
    org_id: UUID,
    payload: TenantAdminCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> UserOut:
    return await svc.create_tenant_admin(auth.db, org_id, payload)


@router.patch("/super-admin/organizations/{org_id}/admins/{user_id}", response_model=UserOut)
async def update_tenant_admin(
    org_id: UUID,
    user_id: UUID,
    payload: TenantAdminUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> UserOut:
    return await svc.update_tenant_admin(auth.db, org_id, user_id, payload)


@router.delete("/super-admin/organizations/{org_id}/admins/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_admin(
    org_id: UUID,
    user_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> None:
    await svc.delete_tenant_admin(auth.db, org_id, user_id)


# --- Delivery Users ---

@router.get("/admin/users/delivery", response_model=list[UserOut])
async def list_delivery_users(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[UserOut]:
    return await svc.list_delivery_users(auth.db, auth.user.organization_id)


@router.post("/admin/users/delivery", response_model=UserOut)
async def create_delivery_user(
    payload: DeliveryUserCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> UserOut:
    return await svc.create_delivery_user(auth.db, auth.user.organization_id, payload)


# --- Admin retailers / rates / orders ---


@router.get("/admin/retailers", response_model=CursorPage)
async def admin_list_retailers(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> CursorPage:
    items, has_more, next_cursor = await svc.list_retailers(auth.db, cursor=cursor, limit=limit)
    return CursorPage(items=items, has_more=has_more, next_cursor=next_cursor)


@router.post("/admin/retailers", response_model=RetailerOut)
async def admin_create_retailer(
    payload: RetailerCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RetailerOut:
    assert auth.organization is not None and auth.schema_name is not None
    return await svc.create_retailer(
        auth.db,
        payload,
        organization_id=auth.organization.id,
        schema_name=auth.schema_name,
    )


@router.get("/admin/retailers/{retailer_id}", response_model=RetailerOut)
async def admin_get_retailer(
    retailer_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RetailerOut:
    retailer = await svc.get_retailer(auth.db, retailer_id)
    return RetailerOut.model_validate(retailer, from_attributes=True)


@router.patch("/admin/retailers/{retailer_id}", response_model=RetailerOut)
async def admin_update_retailer(
    retailer_id: UUID,
    payload: RetailerUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RetailerOut:
    return await svc.update_retailer(auth.db, retailer_id, payload)


@router.get("/admin/rates", response_model=list[RateOut])
async def admin_list_rates(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[RateOut]:
    return await svc.list_rates(auth.db)


@router.put("/admin/rates", response_model=RateOut)
async def admin_upsert_rate(
    payload: RateUpsert,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RateOut:
    return await svc.upsert_rate(auth.db, payload)


@router.get("/admin/orders/today", response_model=TodayOrdersResponse)
async def admin_today_orders(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> TodayOrdersResponse:
    return await svc.list_today_orders(auth.db)


@router.get("/retailer/orders/today", response_model=DailyOrderOut | None)
async def retailer_get_today_order(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> DailyOrderOut | None:
    if not auth.user.retailer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retailer not linked")
    return await svc.get_today_order_for_retailer(auth.db, auth.user.retailer_id)


@router.post("/retailer/orders/today", response_model=DailyOrderOut)
async def retailer_upsert_today_order(
    payload: DailyOrderCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> DailyOrderOut:
    if not auth.user.retailer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retailer not linked")
    return await svc.upsert_today_order(
        auth.db,
        retailer_id=auth.user.retailer_id,
        payload=payload,
        user_id=auth.user.id,
    )


# --- Farm / delivery ---


@router.get("/admin/farms", response_model=list[FarmOut])
async def admin_list_farms(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[FarmOut]:
    return await svc.list_farms(auth.db)


@router.post("/admin/farms", response_model=FarmOut)
async def admin_create_farm(
    payload: FarmCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmOut:
    return await svc.create_farm(auth.db, payload)


@router.get("/admin/farm-loads", response_model=list[FarmLoadOut])
async def admin_list_loads(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> list[FarmLoadOut]:
    return await svc.list_farm_loads(auth.db)


@router.post("/admin/farm-loads", response_model=FarmLoadOut)
async def admin_create_load(
    payload: FarmLoadCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmLoadOut:
    return await svc.create_farm_load(auth.db, payload)


@router.get("/admin/vehicles", response_model=list[VehicleOut])
async def admin_list_vehicles(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[VehicleOut]:
    return await svc.list_vehicles(auth.db)


@router.post("/admin/vehicles", response_model=VehicleOut)
async def admin_create_vehicle(
    payload: VehicleCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> VehicleOut:
    return await svc.create_vehicle(auth.db, payload)


@router.get("/admin/dashboard", response_model=OpsDashboard)
async def admin_ops_dashboard(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    on_date: str | None = Query(
        default=None, description="Ops day in DD/MM/YYYY (IST)"
    ),
) -> OpsDashboard:
    day = parse_ist_date(on_date) if on_date else today_ist()
    return await svc.ops_dashboard(auth.db, day)


@router.patch("/admin/farm-loads/{load_id}", response_model=FarmLoadOut)
async def admin_update_load(
    load_id: UUID,
    payload: FarmLoadCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmLoadOut:
    return await svc.update_farm_load(auth.db, load_id, payload)


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
    return await svc.get_active_run(auth.db)


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
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.DELIVERY, UserRole.ADMIN))],
) -> DeliveryStopOut:
    return await svc.skip_stop(auth.db, stop_id)


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


# --- Ledger / reports ---


@router.get("/admin/retailers/{retailer_id}/ledger", response_model=LedgerOut)
async def admin_ledger(
    retailer_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> LedgerOut:
    return await svc.get_ledger(auth.db, retailer_id)


@router.post("/admin/retailers/{retailer_id}/payments", response_model=PaymentOut)
async def admin_payment(
    retailer_id: UUID,
    payload: PaymentCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> PaymentOut:
    return await svc.create_payment(auth.db, retailer_id, payload)


@router.get("/retailer/ledger", response_model=LedgerOut)
async def retailer_ledger(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.RETAILER))],
) -> LedgerOut:
    if not auth.user.retailer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retailer not linked")
    return await svc.get_ledger(auth.db, auth.user.retailer_id)


@router.get("/admin/trips/{run_id}/weight-loss", response_model=TripWeightLossOut)
async def admin_weight_loss(
    run_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> TripWeightLossOut:
    return await svc.compute_trip_weight_loss(auth.db, run_id)


@router.get("/admin/reports/summary", response_model=ReportSummary)
async def admin_report_summary(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    on_date: str | None = Query(
        default=None, description="Report day in DD/MM/YYYY (IST)"
    ),
) -> ReportSummary:
    day = parse_ist_date(on_date) if on_date else today_ist()
    if period == "weekly":
        start_dt, end_dt = ist_week_bounds(day)
        from datetime import timedelta

        start, end = start_dt.date(), end_dt.date() - timedelta(days=1)
    elif period == "monthly":
        start_dt, end_dt = ist_month_bounds(day)
        from datetime import timedelta

        start, end = start_dt.date(), end_dt.date() - timedelta(days=1)
    else:
        start = end = day
    return await svc.report_summary(auth.db, start, end)


@router.get("/admin/reports/summary.pdf")
async def admin_report_pdf(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    on_date: str | None = Query(
        default=None, description="Report day in DD/MM/YYYY (IST)"
    ),
) -> Response:
    day = parse_ist_date(on_date) if on_date else today_ist()
    if period == "weekly":
        start_dt, end_dt = ist_week_bounds(day)
        from datetime import timedelta

        start, end = start_dt.date(), end_dt.date() - timedelta(days=1)
    elif period == "monthly":
        start_dt, end_dt = ist_month_bounds(day)
        from datetime import timedelta

        start, end = start_dt.date(), end_dt.date() - timedelta(days=1)
    else:
        start = end = day
    summary = await svc.report_summary(auth.db, start, end)
    pdf = svc.build_report_pdf(summary)
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report.pdf"},
    )
