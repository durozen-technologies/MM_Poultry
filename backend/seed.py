"""Seed demo org and users per .core/TEST_CREDENTIALS.md."""

from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.core.security import get_password_hash
from app.core.timezone import today_ist
from app.db.database import get_session_factory
from app.db.tenant_schema import (
    derive_schema_name,
    provision_tenant_schema_async,
    repair_tenant_schema_async,
    set_search_path,
)
from app.models.domain import Farm, OrgSettings, Retailer, RetailerItemRate, Vehicle
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.services.auth import upsert_auth_index


async def seed() -> None:
    await set_up()


async def set_up() -> None:
    from app.db.tenant_schema import create_platform_tables

    await create_platform_tables()
    session = get_session_factory()()
    try:
        await set_search_path(session, None)

        # Super admin in public.users
        existing_sa = await session.scalar(
            select(User).where(
                User.username == "superadmin",
                User.organization_id.is_(None),
            )
        )
        if existing_sa is None:
            session.add(
                User(
                    username="superadmin",
                    password_hash=get_password_hash("password123"),
                    role=UserRole.SUPER_ADMIN,
                    organization_id=None,
                )
            )
            await session.flush()
            print("Created superadmin")

        org = await session.scalar(select(Organization).where(Organization.slug == "demo"))
        if org is None:
            schema_name = derive_schema_name("demo")
            org = Organization(name="Demo Wholesaler", slug="demo", schema_name=schema_name)
            session.add(org)
            await session.flush()
            await session.commit()
            await provision_tenant_schema_async(schema_name)
            session = get_session_factory()()
            await set_search_path(session, None)
            org = await session.scalar(select(Organization).where(Organization.slug == "demo"))
            assert org is not None
            print(f"Created org demo -> {schema_name}")
        else:
            schema_name = org.schema_name
            await repair_tenant_schema_async(schema_name)
            print(f"Repaired existing tenant {schema_name}")

        await set_search_path(session, schema_name)

        settings = await session.scalar(select(OrgSettings).limit(1))
        if settings is None:
            session.add(OrgSettings())
            await session.flush()
            print("Created org_settings defaults")

        vehicle = await session.scalar(select(Vehicle).limit(1))
        if vehicle is None:
            session.add(
                Vehicle(number="TN01AB1234", capacity_kg=Decimal("500.000"), driver_name="Ravi")
            )
            await session.flush()
            print("Created demo vehicle")

        async def ensure_user(
            username: str, role: UserRole, retailer_id=None
        ) -> User:
            user = await session.scalar(select(User).where(User.username == username))
            if user is None:
                user = User(
                    username=username,
                    password_hash=get_password_hash("password123"),
                    role=role,
                    organization_id=org.id,
                    retailer_id=retailer_id,
                )
                session.add(user)
                await session.flush()
                await set_search_path(session, None)
                await upsert_auth_index(
                    session,
                    username=username,
                    organization_id=org.id,
                    schema_name=schema_name,
                    user_id=user.id,
                )
                await set_search_path(session, schema_name)
                print(f"Created user {username}")
            return user

        await ensure_user("admin", UserRole.ADMIN)
        await ensure_user("delivery1", UserRole.DELIVERY)

        retailer = await session.scalar(select(Retailer).where(Retailer.name == "Retail Shop 1"))
        if retailer is None:
            retailer = Retailer(
                name="Retail Shop 1",
                shop_name="Chicken Corner",
                phone="9000000001",
                opening_balance=Decimal("0.00"),
                credit_balance=Decimal("0.00"),
            )
            session.add(retailer)
            await session.flush()
            # extra demo retailers
            for i, name in enumerate(["Retail Shop 2", "Retail Shop 3"], start=2):
                session.add(
                    Retailer(
                        name=name,
                        shop_name=f"Shop {i}",
                        phone=f"900000000{i}",
                        opening_balance=Decimal("0.00"),
                        credit_balance=Decimal("0.00"),
                    )
                )
            print("Created demo retailers")

        await ensure_user("retailer1", UserRole.RETAILER, retailer_id=retailer.id)

        rate = await session.scalar(
            select(RetailerItemRate).where(RetailerItemRate.retailer_id.is_(None))
        )
        if rate is None:
            session.add(
                RetailerItemRate(
                    retailer_id=None,
                    rate_per_kg=Decimal("180.00"),
                    effective_from=today_ist(),
                )
            )
            print("Created default rate 180/kg")

        farm = await session.scalar(select(Farm).where(Farm.name == "Demo Farm"))
        if farm is None:
            session.add(Farm(name="Demo Farm", location="Village Road", contact_phone="9000000099"))
            print("Created Demo Farm")

        await session.commit()
        print("Seed complete.")
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


if __name__ == "__main__":
    asyncio.run(seed())
