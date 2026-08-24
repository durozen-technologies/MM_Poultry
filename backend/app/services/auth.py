from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token_for_user, verify_password
from app.core.timezone import now_ist
from app.db.tenant_schema import tenant_schema_scope
from app.models.enums import UserRole
from app.models.organization import Organization, UserAuthIndex
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, UserOut

USERNAME_TAKEN = "Username is already taken globally"


def normalize_username(username: str) -> str:
    return username.strip().lower()


def raise_username_taken(exc: Exception | None = None) -> None:
    if exc is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_TAKEN) from exc
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_TAKEN)


def reraise_username_conflict(exc: IntegrityError) -> None:
    msg = str(getattr(exc, "orig", exc)).lower()
    if "username" in msg or "user_auth_index" in msg:
        raise_username_taken(exc)
    raise exc


async def check_global_username_available(db: AsyncSession, username: str) -> bool:
    """Check if a username is available globally across all tenants and superadmins."""
    username_lower = normalize_username(username)

    existing_index = await db.scalar(
        select(UserAuthIndex).where(UserAuthIndex.username_lower == username_lower)
    )
    if existing_index:
        return False

    existing_sa = await db.scalar(
        select(User).where(
            func.lower(User.username) == username_lower,
            User.organization_id.is_(None),
        )
    )
    return existing_sa is None


async def require_username_available(db: AsyncSession, username: str) -> str:
    username_lower = normalize_username(username)
    if not username_lower:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username is required"
        )
    if not await check_global_username_available(db, username_lower):
        raise_username_taken()
    return username_lower


async def login_user(db: AsyncSession, payload: LoginRequest) -> LoginResponse:
    username_lower = normalize_username(payload.username)

    super_admin = await db.scalar(
        select(User).where(
            func.lower(User.username) == username_lower,
            User.organization_id.is_(None),
            User.role == UserRole.SUPER_ADMIN,
        )
    )
    if super_admin is not None:
        if not verify_password(payload.password, super_admin.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )
        if not super_admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive"
            )
        super_admin.last_login_at = now_ist()
        token = create_access_token_for_user(super_admin)
        return LoginResponse(
            access_token=token,
            user=UserOut.model_validate(super_admin, from_attributes=True),
        )

    stmt = select(UserAuthIndex).where(UserAuthIndex.username_lower == username_lower)
    if payload.organization_slug:
        org = await db.scalar(
            select(Organization).where(Organization.slug == payload.organization_slug.strip())
        )
        if org is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )
        stmt = stmt.where(UserAuthIndex.organization_id == org.id)

    matches = list(await db.scalars(stmt))
    if len(matches) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if len(matches) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization required",
        )

    index = matches[0]
    async with tenant_schema_scope(db, index.schema_name):
        user = await db.scalar(select(User).where(User.id == index.user_id))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive"
            )
        org = await db.scalar(select(Organization).where(Organization.id == index.organization_id))
        if org is None or not org.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )
        user.last_login_at = now_ist()
        token = create_access_token_for_user(user)
        return LoginResponse(
            access_token=token,
            user=UserOut(
                id=user.id,
                username=user.username,
                role=user.role,
                organization_id=user.organization_id,
                retailer_id=user.retailer_id,
                is_active=user.is_active,
                organization_slug=org.slug,
                organization_name=org.name,
                full_name=user.full_name,
                mobile_number=user.mobile_number,
            ),
        )


async def upsert_auth_index(
    db: AsyncSession,
    *,
    username: str,
    organization_id,
    schema_name: str,
    user_id,
) -> None:
    username_lower = normalize_username(username)
    existing = await db.scalar(
        select(UserAuthIndex).where(UserAuthIndex.username_lower == username_lower)
    )
    if existing:
        if existing.user_id == user_id:
            existing.schema_name = schema_name
            existing.organization_id = organization_id
            return
        raise_username_taken()
    db.add(
        UserAuthIndex(
            username_lower=username_lower,
            organization_id=organization_id,
            schema_name=schema_name,
            user_id=user_id,
        )
    )
