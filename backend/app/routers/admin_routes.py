from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import (
    CursorPage,
    RouteCreate,
    RouteDetailOut,
    RouteOut,
    RouteRetailersReplace,
    RouteUpdate,
)
from app.services import wholesale as svc

router = APIRouter()


@router.get("/admin/routes", response_model=list[RouteOut])
async def admin_list_routes(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[RouteOut]:
    return await svc.list_routes(auth.db)


@router.get("/admin/routes/unassigned-retailers", response_model=CursorPage)
async def admin_list_unassigned_retailers(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> CursorPage:
    items, has_more, next_cursor, total_count = await svc.list_unassigned_retailers(
        auth.db, cursor=cursor, limit=limit
    )
    return CursorPage(
        items=items,
        has_more=has_more,
        next_cursor=next_cursor,
        total_count=total_count or None,
    )


@router.post("/admin/routes", response_model=RouteOut, status_code=status.HTTP_201_CREATED)
async def admin_create_route(
    payload: RouteCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RouteOut:
    return await svc.create_route(auth.db, payload)


@router.get("/admin/routes/{route_id}", response_model=RouteDetailOut)
async def admin_get_route(
    route_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RouteDetailOut:
    return await svc.get_route(auth.db, route_id)


@router.patch("/admin/routes/{route_id}", response_model=RouteOut)
async def admin_update_route(
    route_id: UUID,
    payload: RouteUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RouteOut:
    return await svc.update_route(auth.db, route_id, payload)


@router.delete("/admin/routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_route(
    route_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    await svc.deactivate_route(auth.db, route_id)


@router.put("/admin/routes/{route_id}/retailers", response_model=RouteDetailOut)
async def admin_replace_route_retailers(
    route_id: UUID,
    payload: RouteRetailersReplace,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> RouteDetailOut:
    return await svc.replace_route_retailers(auth.db, route_id, payload)
