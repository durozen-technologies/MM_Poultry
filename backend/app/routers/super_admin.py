from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import (
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    TenantAdminCreate,
    TenantAdminUpdate,
    UserOut,
)
from app.services import wholesale as svc

router = APIRouter()


@router.get("/super-admin/organizations", response_model=list[OrganizationOut])
async def list_orgs(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
    include_inactive: bool = Query(default=True),
) -> list[OrganizationOut]:
    return await svc.list_organizations(auth.db, include_inactive=include_inactive)


@router.post("/super-admin/organizations", response_model=OrganizationOut)
async def create_org(
    payload: OrganizationCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> OrganizationOut:
    from app.db.tenant_schema import set_search_path

    await set_search_path(auth.db, None)
    org = await svc.create_organization(auth.db, payload)
    await auth.db.commit()
    return org


@router.patch("/super-admin/organizations/{org_id}", response_model=OrganizationOut)
async def update_org(
    org_id: UUID,
    payload: OrganizationUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> OrganizationOut:
    org = await svc.update_organization(auth.db, org_id, payload)
    await auth.db.commit()
    return org


@router.delete("/super-admin/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org(
    org_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> None:
    await svc.delete_organization(auth.db, org_id)
    await auth.db.commit()


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
    admin = await svc.create_tenant_admin(auth.db, org_id, payload)
    await auth.db.commit()
    return admin


@router.patch("/super-admin/organizations/{org_id}/admins/{user_id}", response_model=UserOut)
async def update_tenant_admin(
    org_id: UUID,
    user_id: UUID,
    payload: TenantAdminUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> UserOut:
    admin = await svc.update_tenant_admin(auth.db, org_id, user_id, payload)
    await auth.db.commit()
    return admin


@router.delete(
    "/super-admin/organizations/{org_id}/admins/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tenant_admin(
    org_id: UUID,
    user_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> None:
    await svc.delete_tenant_admin(auth.db, org_id, user_id)
    await auth.db.commit()
