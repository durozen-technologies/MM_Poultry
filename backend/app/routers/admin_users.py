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
