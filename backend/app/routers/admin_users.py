from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas import DeliveryUserCreate, DeliveryUserUpdate, UserOut
from app.services import wholesale as svc

router = APIRouter()


def _org_id(auth: AuthContext) -> UUID:
    if not auth.user.organization_id:
        raise HTTPException(status_code=403, detail="Not an organization admin")
    return auth.user.organization_id


@router.get("/admin/users/delivery", response_model=list[UserOut])
async def list_delivery_users(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[UserOut]:
    return await svc.list_delivery_users(auth.db, _org_id(auth))


@router.post("/admin/users/delivery", response_model=UserOut)
async def create_delivery_user(
    payload: DeliveryUserCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> UserOut:
    return await svc.create_delivery_user(auth.db, _org_id(auth), payload)


@router.patch("/admin/users/delivery/{user_id}", response_model=UserOut)
async def update_delivery_user(
    user_id: UUID,
    payload: DeliveryUserUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> UserOut:
    return await svc.update_delivery_user(auth.db, _org_id(auth), user_id, payload)


@router.delete("/admin/users/delivery/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_delivery_user(
    user_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    await svc.delete_delivery_user(auth.db, _org_id(auth), user_id)


@router.get("/admin/users/retailer", response_model=list[UserOut])
async def list_retailer_users(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> list[UserOut]:
    from app.services.wholesale.retailers import list_retailer_users as _list
    return await _list(auth.db, _org_id(auth))


@router.patch("/admin/users/retailer/{user_id}", response_model=UserOut)
async def update_retailer_user(
    user_id: UUID,
    payload: DeliveryUserUpdate, # We can reuse DeliveryUserUpdate or create RetailerUserUpdate, but DeliveryUserUpdate only has password/is_active/full_name/mobile which is fine (we'll only use password and is_active)
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> UserOut:
    from app.services.wholesale.retailers import update_retailer_user as _update
    return await _update(auth.db, _org_id(auth), user_id, payload.model_dump(exclude_unset=True))


@router.delete("/admin/users/retailer/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_retailer_user(
    user_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    from app.services.wholesale.retailers import delete_retailer_user as _delete

    if auth.schema_name is None:
        raise HTTPException(status_code=400, detail="Organization schema not resolved")
    await _delete(auth.db, _org_id(auth), user_id, auth.schema_name)
