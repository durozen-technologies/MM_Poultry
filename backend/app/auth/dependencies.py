from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, AsyncIterator
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.database import get_session_factory
from app.db.tenant_context_var import reset_active_tenant_schema, set_active_tenant_schema
from app.db.tenant_schema import set_search_path
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    organization: Organization | None
    schema_name: str | None
    db: AsyncSession


async def get_current_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AsyncIterator[AuthContext]:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = UUID(str(payload["sub"]))
        org_id_raw = payload.get("org_id")
        org_id = UUID(str(org_id_raw)) if org_id_raw else None
        perm_version = int(payload.get("perm_version", 0))
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from exc

    session = get_session_factory()()
    token = set_active_tenant_schema(None)
    organization: Organization | None = None
    schema_name: str | None = None
    try:
        await set_search_path(session, None)
        if org_id is None:
            user = await session.scalar(select(User).where(User.id == user_id))
            if user is None or user.role != UserRole.SUPER_ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                )
        else:
            organization = await session.scalar(
                select(Organization).where(Organization.id == org_id)
            )
            if organization is None or not organization.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                )
            schema_name = organization.schema_name
            reset_active_tenant_schema(token)
            token = set_active_tenant_schema(schema_name)
            await set_search_path(session, schema_name)
            user = await session.scalar(select(User).where(User.id == user_id))
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                )
            if int(user.permissions_version) != perm_version:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive"
            )

        yield AuthContext(user=user, organization=organization, schema_name=schema_name, db=session)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
        reset_active_tenant_schema(token)


def require_roles(*roles: UserRole):
    async def _dep(auth: Annotated[AuthContext, Depends(get_current_auth)]) -> AuthContext:
        if auth.user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return auth

    return _dep
