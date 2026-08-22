from __future__ import annotations

import re
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import Base, get_engine
from app.db.tenant_context_var import (
    get_active_tenant_schema,
    reset_active_tenant_schema,
    set_active_tenant_schema,
)

# Bump when tenant Alembic head advances.
TENANT_MIGRATION_HEAD = "0003_user_profile_fields"

_SCHEMA_SAFE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def derive_schema_name(slug: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", slug.strip().lower()).strip("_")
    name = f"tenant_{cleaned}"[:63]
    if not _SCHEMA_SAFE.match(name):
        raise ValueError(f"Invalid schema name derived from slug: {slug}")
    return name


async def set_session_ist(session: AsyncSession) -> None:
    """Force Indian Standard Time for this DB session (storage + CURRENT_TIMESTAMP)."""
    await session.execute(text("SET TIME ZONE 'Asia/Kolkata'"))


async def set_search_path(session: AsyncSession, schema_name: str | None) -> None:
    await set_session_ist(session)
    await session.execute(text("RESET search_path"))
    if schema_name:
        if not _SCHEMA_SAFE.match(schema_name):
            raise ValueError(f"Unsafe schema name: {schema_name}")
        await session.execute(text(f'SET search_path TO "{schema_name}", public'))
    else:
        await session.execute(text("SET search_path TO public"))


@asynccontextmanager
async def tenant_schema_scope(
    session: AsyncSession, schema_name: str
) -> AsyncIterator[None]:
    token = set_active_tenant_schema(schema_name)
    try:
        await set_search_path(session, schema_name)
        yield
    finally:
        reset_active_tenant_schema(token)
        await set_search_path(session, get_active_tenant_schema())


def _tenant_table_names() -> set[str]:
    # Tables that live in tenant schemas (not public control plane).
    return {
        "users",
        "retailers",
        "retailer_item_rates",
        "retailer_daily_orders",
        "farms",
        "vehicles",
        "org_settings",
        "farm_loads",
        "delivery_runs",
        "delivery_stops",
        "delivery_bills",
        "payments",
        "trip_weight_losses",
        "bill_sequences",
        "expense_categories",
        "expenses",
        "retailer_returns",
    }


def _platform_table_names() -> set[str]:
    return {"organizations", "user_auth_index", "users"}


async def reset_test_database_async() -> None:
    """Drop tenant schemas and truncate public control-plane tables (test isolation)."""
    engine = get_engine()
    async with engine.begin() as conn:
        rows = await conn.execute(
            text(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name LIKE 'tenant\\_%' ESCAPE '\\'"
            )
        )
        for (schema_name,) in rows:
            if _SCHEMA_SAFE.match(schema_name):
                await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        await conn.execute(text("SET search_path TO public"))
        await conn.execute(
            text(
                "TRUNCATE TABLE user_auth_index, users, organizations "
                "RESTART IDENTITY CASCADE"
            )
        )


async def create_platform_tables() -> None:
    """Create public control-plane tables (organizations + auth index + platform users)."""
    import app.models  # noqa: F401 — register metadata

    engine = get_engine()
    platform_tables = [
        table
        for table in Base.metadata.sorted_tables
        if table.name in _platform_table_names()
    ]
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        await conn.execute(text("SET search_path TO public"))
        for table in platform_tables:
            await conn.run_sync(table.create, checkfirst=True)
    await repair_platform_schema_async()


async def repair_platform_schema_async() -> None:
    """Align public control-plane columns and global username uniqueness."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("SET search_path TO public"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(30)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 0"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE"))
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT username_lower FROM user_auth_index
                    GROUP BY username_lower HAVING COUNT(*) > 1
                  ) THEN
                    RAISE EXCEPTION 'Duplicate username_lower values exist; resolve before unique constraint';
                  END IF;
                END $$;
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_auth_index_user_org'
                  ) THEN
                    ALTER TABLE user_auth_index DROP CONSTRAINT uq_auth_index_user_org;
                  END IF;
                END $$;
                """
            )
        )
        await conn.execute(text("DROP INDEX IF EXISTS ix_user_auth_index_username_lower"))
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_auth_index_username_lower "
                "ON user_auth_index (username_lower)"
            )
        )


async def provision_tenant_schema_async(schema_name: str) -> None:
    """CREATE SCHEMA, create tenant tables, stamp alembic_version."""
    import app.models  # noqa: F401

    if not _SCHEMA_SAFE.match(schema_name):
        raise ValueError(f"Unsafe schema name: {schema_name}")

    engine = get_engine()
    tenant_tables = [
        table
        for table in Base.metadata.sorted_tables
        if table.name in _tenant_table_names()
    ]

    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        await conn.execute(text(f'SET search_path TO "{schema_name}", public'))
        for table in tenant_tables:
            await conn.run_sync(table.create, checkfirst=True)
        await conn.execute(
            text(
                f"""
                CREATE TABLE IF NOT EXISTS "{schema_name}".alembic_version (
                    version_num VARCHAR(32) NOT NULL PRIMARY KEY
                )
                """
            )
        )
        await conn.execute(text(f'DELETE FROM "{schema_name}".alembic_version'))
        await conn.execute(
            text(
                f"INSERT INTO \"{schema_name}\".alembic_version (version_num) VALUES (:v)"
            ),
            {"v": TENANT_MIGRATION_HEAD},
        )
        await conn.execute(text("SET search_path TO public"))


async def repair_tenant_schema_async(schema_name: str) -> None:
    """Add new tables/columns for existing tenants (IDEA MVP expand)."""
    import app.models  # noqa: F401

    if not _SCHEMA_SAFE.match(schema_name):
        raise ValueError(f"Unsafe schema name: {schema_name}")

    engine = get_engine()
    alters = [
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS owner_name VARCHAR(120)",
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(30)",
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS area VARCHAR(120)",
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS route_name VARCHAR(120)",
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS category VARCHAR(60)",
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0.00",
        "ALTER TABLE retailers ADD COLUMN IF NOT EXISTS preferred_delivery_time VARCHAR(40)",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS vehicle_id UUID",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS rate_per_kg NUMERIC(12,2)",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2)",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2)",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)",
        "ALTER TABLE farms ADD COLUMN IF NOT EXISTS owner_name VARCHAR(120)",
        "ALTER TABLE farms ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
        "ALTER TABLE farms ADD COLUMN IF NOT EXISTS capacity INTEGER",
        "ALTER TABLE retailer_daily_orders ADD COLUMN IF NOT EXISTS bird_size VARCHAR(50)",
        "ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS delivered_bird_count INTEGER",
        "ALTER TABLE delivery_bills ADD COLUMN IF NOT EXISTS checkout_id VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE",
    ]
    async with engine.begin() as conn:
        await conn.execute(text("SET TIME ZONE 'Asia/Kolkata'"))
        await conn.execute(text(f'SET search_path TO "{schema_name}", public'))
        for table in Base.metadata.sorted_tables:
            if table.name in {"vehicles", "org_settings", "expense_categories", "expenses"}:
                await conn.run_sync(table.create, checkfirst=True)
        for stmt in alters:
            await conn.execute(text(stmt))
        await conn.execute(
            text(
                """
                UPDATE delivery_bills
                SET checkout_id = bill_number
                WHERE checkout_id IS NULL OR checkout_id = ''
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_delivery_bill_checkout'
                  ) THEN
                    ALTER TABLE delivery_bills
                      ADD CONSTRAINT uq_delivery_bill_checkout UNIQUE (checkout_id);
                  END IF;
                END $$;
                """
            )
        )
        await conn.execute(text(f'DELETE FROM "{schema_name}".alembic_version'))
        await conn.execute(
            text(f'INSERT INTO "{schema_name}".alembic_version (version_num) VALUES (:v)'),
            {"v": TENANT_MIGRATION_HEAD},
        )
        await conn.execute(text("SET search_path TO public"))
