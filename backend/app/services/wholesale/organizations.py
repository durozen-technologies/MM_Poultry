from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.enums import (
    UserRole,
)
from app.models.organization import Organization
from app.models.user import User
from app.schemas import (
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    TenantAdminCreate,
    TenantAdminUpdate,
    UserOut,
)
from app.schemas.auth import DeliveryUserCreate
from app.services.auth import upsert_auth_index


async def create_organization(db: AsyncSession, payload: OrganizationCreate) -> OrganizationOut:
    from app.db.tenant_schema import derive_schema_name, provision_tenant_schema_async

    slug = payload.slug.strip().lower()
    existing = await db.scalar(select(Organization).where(Organization.slug == slug))
    if existing:
        msg = "Organization with this name already exists. If it was deleted, you can reactivate it."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
    schema_name = derive_schema_name(slug)
    org = Organization(name=payload.name.strip(), slug=slug, schema_name=schema_name)
    db.add(org)
    await db.flush()
    await provision_tenant_schema_async(schema_name)
    return OrganizationOut.model_validate(org, from_attributes=True)


async def list_organizations(db: AsyncSession) -> list[OrganizationOut]:
    rows = list(await db.scalars(select(Organization).order_by(Organization.name)))
    return [OrganizationOut.model_validate(r, from_attributes=True) for r in rows]



async def update_organization(db: AsyncSession, org_id: UUID, payload: OrganizationUpdate) -> OrganizationOut:
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if payload.name is not None:
        org.name = payload.name.strip()
    if payload.is_active is not None:
        org.is_active = payload.is_active
    
    await db.flush()
    return OrganizationOut.model_validate(org, from_attributes=True)


async def delete_organization(db: AsyncSession, org_id: UUID) -> None:
    from app.models.organization import UserAuthIndex
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    auth_rows = await db.scalars(select(UserAuthIndex).where(UserAuthIndex.organization_id == org_id))
    for row in auth_rows:
        await db.delete(row)
        
    await db.delete(org)
    await db.flush()


async def list_tenant_admins(db: AsyncSession, org_id: UUID) -> list[UserOut]:
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    from app.db.tenant_schema import set_search_path
    await set_search_path(db, org.schema_name)
    
    rows = list(await db.scalars(select(User).where(User.role == UserRole.ADMIN)))
    
    await set_search_path(db, None)
    return [UserOut.model_validate(r, from_attributes=True) for r in rows]


async def create_tenant_admin(db: AsyncSession, org_id: UUID, payload: TenantAdminCreate) -> UserOut:
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    from app.db.tenant_schema import set_search_path
    from app.services.auth import check_global_username_available

    await set_search_path(db, None)
    if not await check_global_username_available(db, payload.username):
        raise HTTPException(status_code=409, detail="Username is already taken globally")

    await set_search_path(db, org.schema_name)

    user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        role=UserRole.ADMIN,
        organization_id=org.id,
    )
    db.add(user)
    await db.flush()
    
    await set_search_path(db, None)
    await upsert_auth_index(
        db,
        username=user.username,
        organization_id=org.id,
        schema_name=org.schema_name,
        user_id=user.id,
    )
    
    return UserOut.model_validate(user, from_attributes=True)


async def create_delivery_user(db: AsyncSession, org_id: UUID, payload: DeliveryUserCreate) -> UserOut:
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    from app.db.tenant_schema import set_search_path
    from app.services.auth import check_global_username_available

    await set_search_path(db, None)
    if not await check_global_username_available(db, payload.username):
        raise HTTPException(status_code=409, detail="Username is already taken globally")

    await set_search_path(db, org.schema_name)

    user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        role=UserRole.DELIVERY,
        organization_id=org.id,
    )
    db.add(user)
    await db.flush()
    
    await set_search_path(db, None)
    await upsert_auth_index(
        db,
        username=user.username,
        organization_id=org.id,
        schema_name=org.schema_name,
        user_id=user.id,
    )
    return UserOut.model_validate(user, from_attributes=True)


async def list_delivery_users(db: AsyncSession, org_id: UUID) -> list[UserOut]:
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    from app.db.tenant_schema import set_search_path
    await set_search_path(db, org.schema_name)
    
    users = await db.scalars(select(User).where(User.role == UserRole.DELIVERY))
    users_list = list(users.all())
    
    await set_search_path(db, None)
    return [UserOut.model_validate(u, from_attributes=True) for u in users_list]


async def update_tenant_admin(db: AsyncSession, org_id: UUID, user_id: UUID, payload: TenantAdminUpdate) -> UserOut:
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    from app.db.tenant_schema import set_search_path
    
    await set_search_path(db, org.schema_name)
    
    user = await db.scalar(select(User).where(User.id == user_id, User.role == UserRole.ADMIN))
    if not user:
        await set_search_path(db, None)
        raise HTTPException(status_code=404, detail="Tenant admin not found")
        
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = get_password_hash(payload.password)
        
    await db.flush()
    await set_search_path(db, None)
    
    return UserOut.model_validate(user, from_attributes=True)


async def delete_tenant_admin(db: AsyncSession, org_id: UUID, user_id: UUID) -> None:
    from app.models.organization import UserAuthIndex
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    from app.db.tenant_schema import set_search_path
    await set_search_path(db, org.schema_name)
    
    user = await db.scalar(select(User).where(User.id == user_id, User.role == UserRole.ADMIN))
    if not user:
        await set_search_path(db, None)
        raise HTTPException(status_code=404, detail="Tenant admin not found")
        
    await db.delete(user)
    await db.flush()
    
    await set_search_path(db, None)
    auth_index = await db.scalar(select(UserAuthIndex).where(UserAuthIndex.user_id == user_id))
    if auth_index:
        await db.delete(auth_index)
        
    await db.flush()
    await set_search_path(db, None)


