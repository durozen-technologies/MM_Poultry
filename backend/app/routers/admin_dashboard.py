from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import AuthContext, require_roles
from app.core.timezone import parse_ist_date, today_ist
from app.models.enums import UserRole
from app.schemas import OpsDashboard
from app.services import wholesale as svc

router = APIRouter()


@router.get("/admin/dashboard", response_model=OpsDashboard)
async def admin_ops_dashboard(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    on_date: str | None = Query(default=None, description="Ops day in DD/MM/YYYY (IST)"),
) -> OpsDashboard:
    day = parse_ist_date(on_date) if on_date else today_ist()
    return await svc.ops_dashboard(auth.db, day)
