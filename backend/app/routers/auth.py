from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthContext, get_current_auth
from app.db.session import get_platform_db
from app.schemas import LoginRequest, LoginResponse, UsernameAvailableOut, UserOut
from app.services.auth import check_global_username_available, login_user

router = APIRouter()


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
        full_name=auth.user.full_name,
        mobile_number=auth.user.mobile_number,
    )


@router.get("/auth/check-username", response_model=UsernameAvailableOut)
async def check_username(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    username: str = Query(min_length=1),
) -> UsernameAvailableOut:
    available = await check_global_username_available(db, username)
    if not available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken globally")
    return UsernameAvailableOut(available=True)
