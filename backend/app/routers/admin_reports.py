from __future__ import annotations

from datetime import timedelta
from io import BytesIO
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse

from app.auth.dependencies import AuthContext, require_roles
from app.core.timezone import ist_month_bounds, ist_week_bounds, parse_ist_date, today_ist
from app.models.enums import UserRole
from app.schemas import ReportSummary, TripWeightLossOut
from app.services import wholesale as svc

router = APIRouter()


def _period_bounds(period: str, day):
    if period == "weekly":
        start_dt, end_dt = ist_week_bounds(day)
        return start_dt.date(), end_dt.date() - timedelta(days=1)
    if period == "monthly":
        start_dt, end_dt = ist_month_bounds(day)
        return start_dt.date(), end_dt.date() - timedelta(days=1)
    return day, day


@router.get("/admin/trips/{run_id}/weight-loss", response_model=TripWeightLossOut | None)
async def admin_weight_loss(
    run_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> TripWeightLossOut | None:
    return await svc.compute_trip_weight_loss(auth.db, run_id)


@router.get("/admin/reports/summary", response_model=ReportSummary)
async def admin_report_summary(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    on_date: str | None = Query(default=None, description="Report day in DD/MM/YYYY (IST)"),
) -> ReportSummary:
    day = parse_ist_date(on_date) if on_date else today_ist()
    start, end = _period_bounds(period, day)
    return await svc.report_summary(auth.db, start, end)


@router.get("/admin/reports/summary.pdf")
async def admin_report_pdf(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    on_date: str | None = Query(default=None, description="Report day in DD/MM/YYYY (IST)"),
) -> Response:
    day = parse_ist_date(on_date) if on_date else today_ist()
    start, end = _period_bounds(period, day)
    summary = await svc.report_summary(auth.db, start, end)
    pdf = svc.build_report_pdf(summary)
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report.pdf"},
    )
