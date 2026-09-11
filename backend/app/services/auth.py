from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.core.timezone import now_ist
from app.db.tenant_schema import tenant_schema_scope
from app.models.enums import UserRole
from app.models.organization import Organization, UserAuthIndex
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, UserOut


def normalize_username(username: str) -> str:
    return username.strip().lower()


async def check_username_available(db: AsyncSession, username: str) -> bool:
    """Check username is available globally in the auth index and not taken by a super-admin."""
    username_lower = normalize_username(username)

    existing_index = await db.scalar(
        select(UserAuthIndex).where(
            UserAuthIndex.username_lower == username_lower,
        )
    )
    if existing_index:
        return False

    # Super-admin usernames are globally reserved
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Username is required"
        )
    if not await check_username_available(db, username_lower):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken in this organization")
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
        token = create_access_token(
            super_admin.id,
            role=super_admin.role,
            org_id=getattr(super_admin, "organization_id", None),
            perm_version=getattr(super_admin, "permissions_version", 0),
        )
        return LoginResponse(
            access_token=token,
            user=UserOut.model_validate(super_admin, from_attributes=True),
        )

    stmt = select(UserAuthIndex).where(UserAuthIndex.username_lower == username_lower)
    if payload.organization_slug:
        # Narrow to exact org if caller provided it
        org_row = await db.scalar(
            select(Organization).where(Organization.slug == payload.organization_slug)
        )
        if org_row:
            stmt = stmt.where(UserAuthIndex.organization_id == org_row.id)

    matches = (await db.scalars(stmt)).all()
    if len(matches) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    async def _resolve(index: UserAuthIndex) -> LoginResponse | None:
        """Return LoginResponse if password matches, else None."""
        async with tenant_schema_scope(db, index.schema_name):
            user = await db.scalar(select(User).where(User.id == index.user_id))
            if user is None or not verify_password(payload.password, user.password_hash):
                return None
            if not user.is_active:
                return None
            org = await db.scalar(select(Organization).where(Organization.id == index.organization_id))
            if org is None or not org.is_active:
                return None
            user.last_login_at = now_ist()
            token = create_access_token(
                user.id,
                role=user.role,
                org_id=getattr(user, "organization_id", None),
                perm_version=getattr(user, "permissions_version", 0),
            )
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

    valid: list[LoginResponse] = []
    for idx in matches:
        result = await _resolve(idx)
        if result is not None:
            valid.append(result)

    if len(valid) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if len(valid) > 1:
        # Same username + same password across multiple orgs — ask for org code
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Multiple accounts found. Please provide your organization code.",
        )
    return valid[0]


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
        select(UserAuthIndex).where(
            UserAuthIndex.username_lower == username_lower,
            UserAuthIndex.organization_id == organization_id,
        )
    )
    if existing:
        if existing.user_id == user_id:
            existing.schema_name = schema_name
            return
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken in this organization")
    db.add(
        UserAuthIndex(
            username_lower=username_lower,
            organization_id=organization_id,
            schema_name=schema_name,
            user_id=user_id,
        )
    )
