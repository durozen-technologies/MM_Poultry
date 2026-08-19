#!/usr/bin/env python3
"""Idempotent demo seed for local development and smoke tests."""

from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.database import get_session_factory
from app.db.tenant_schema import (
    derive_schema_name,
    provision_tenant_schema_async,
    repair_tenant_schema_async,
    set_search_path,
)
from app.models.domain import Farm, Retailer, RetailerItemRate
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas import OrganizationCreate, TenantAdminCreate
from app.services.auth import normalize_username, upsert_auth_index
from app.services.wholesale import create_organization, create_tenant_admin

DEMO_SLUG = "demo"
DEMO_PASSWORD = "password123"


async def _ensure_superadmin(session) -> None:
    username = "superadmin"
    await set_search_path(session, None)
    existing = await session.scalar(
        select(User).where(User.username == username, User.role == UserRole.SUPER_ADMIN)
    )
    if existing:
        return
    user = User(
        username=username,
        password_hash=get_password_hash(DEMO_PASSWORD),
        role=UserRole.SUPER_ADMIN,
        organization_id=None,
    )
    session.add(user)
    await session.flush()
    await upsert_auth_index(
        session,
        username=user.username,
        organization_id=None,
        schema_name="public",
        user_id=user.id,
    )


async def _ensure_demo_org(session):
    await set_search_path(session, None)
    org = await session.scalar(select(Organization).where(Organization.slug == DEMO_SLUG))
    if org:
        await session.commit()
        await repair_tenant_schema_async(org.schema_name)
        return org

    org_out = await create_organization(session, OrganizationCreate(name="Demo Wholesaler", slug=DEMO_SLUG))
    org = await session.scalar(select(Organization).where(Organization.id == org_out.id))
    assert org is not None
    return org


async def _ensure_demo_users(session, org: Organization) -> None:
    await set_search_path(session, org.schema_name)
    specs = [
        ("admin", UserRole.ADMIN, None),
        ("delivery1", UserRole.DELIVERY, None),
        ("retailer1", UserRole.RETAILER, "retailer1"),
    ]
    retailer = await session.scalar(select(Retailer).where(Retailer.name == "Demo Retailer"))
    for username, role, retailer_name in specs:
        normalized = normalize_username(username)
        existing = await session.scalar(select(User).where(User.username == normalized))
        if existing:
            continue
        retailer_id = retailer.id if retailer_name and retailer else None
        if role == UserRole.ADMIN:
            await set_search_path(session, None)
            await create_tenant_admin(
                session,
                org.id,
                TenantAdminCreate(username=username, password=DEMO_PASSWORD),
            )
            await set_search_path(session, org.schema_name)
            continue
        user = User(
            username=normalized,
            password_hash=get_password_hash(DEMO_PASSWORD),
            role=role,
            organization_id=org.id,
            retailer_id=retailer_id,
            full_name=f"{username} user" if role == UserRole.DELIVERY else None,
            mobile_number="9000000001" if role == UserRole.DELIVERY else None,
        )
        session.add(user)
        await session.flush()
        await set_search_path(session, None)
        await upsert_auth_index(
            session,
            username=user.username,
            organization_id=org.id,
            schema_name=org.schema_name,
            user_id=user.id,
        )
        await set_search_path(session, org.schema_name)


async def _ensure_demo_data(session, org: Organization) -> None:
    await set_search_path(session, org.schema_name)
    farm = await session.scalar(select(Farm).where(Farm.name == "Demo Farm"))
    if farm is None:
        session.add(
            Farm(
                name="Demo Farm",
                owner_name="Ravi",
                location="Salem",
                contact_phone="9000000000",
                capacity=5000,
            )
        )
    retailer = await session.scalar(select(Retailer).where(Retailer.name == "Demo Retailer"))
    if retailer is None:
        session.add(
            Retailer(
                name="Demo Retailer",
                shop_name="Demo Shop",
                phone="9000000002",
                opening_balance=Decimal("0.00"),
                credit_balance=Decimal("0.00"),
            )
        )
        await session.flush()
    rate = await session.scalar(
        select(RetailerItemRate).where(RetailerItemRate.retailer_id.is_(None))
    )
    if rate is None:
        from app.core.timezone import today_ist

        session.add(
            RetailerItemRate(
                retailer_id=None,
                rate_per_kg=Decimal("180.00"),
                effective_from=today_ist(),
            )
        )


async def main() -> None:
    from app.db.database import dispose_engine

    await dispose_engine()
    session = get_session_factory()()
    try:
        await _ensure_superadmin(session)
        await session.commit()
        org = await _ensure_demo_org(session)
        await _ensure_demo_data(session, org)
        await _ensure_demo_users(session, org)
        await session.commit()
        print(f"Seed complete. Org slug={DEMO_SLUG}, schema={derive_schema_name(DEMO_SLUG)}")
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


if __name__ == "__main__":
    asyncio.run(main())
