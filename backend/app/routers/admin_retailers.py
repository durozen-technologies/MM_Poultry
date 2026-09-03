from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import (
    CursorPage,
    LedgerOut,
    PaymentCreate,
    PaymentOut,
    RateOut,
    RateUpsert,
    RetailerCreate,
    RetailerOut,
    RetailerPortalUserCreate,
    RetailerReturnCreate,
    RetailerReturnOut,
    RetailerUpdate,
    UserOut,
)
from app.services import wholesale as svc

router = APIRouter()


@router.get("/admin/retailers", response_model=CursorPage)
async def admin_list_retailers(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
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
    return await svc.retailer_to_out(auth.db, retailer)


@router.patch("/admin/retailers/{retailer_id}", response_model=RetailerOut)
async def admin_update_retailer(
    retailer_id: UUID,
    payload: RetailerUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RetailerOut:
    return await svc.update_retailer(auth.db, retailer_id, payload)


@router.delete("/admin/retailers/{retailer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_retailer(
    retailer_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    await svc.deactivate_retailer(auth.db, retailer_id)


@router.post("/admin/retailers/{retailer_id}/portal-user", response_model=UserOut)
async def admin_create_portal_user(
    retailer_id: UUID,
    payload: RetailerPortalUserCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> UserOut:
    assert auth.organization is not None and auth.schema_name is not None
    return await svc.create_retailer_portal_user(
        auth.db,
        retailer_id,
        payload,
        organization_id=auth.organization.id,
        schema_name=auth.schema_name,
    )


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


@router.post("/admin/retailers/{retailer_id}/returns", response_model=RetailerReturnOut)
async def admin_return(
    retailer_id: UUID,
    payload: RetailerReturnCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RetailerReturnOut:
    return await svc.create_return(auth.db, retailer_id, payload)
