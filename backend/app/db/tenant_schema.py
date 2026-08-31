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
TENANT_MIGRATION_HEAD = "d85bf12c9678"

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
async def tenant_schema_scope(session: AsyncSession, schema_name: str) -> AsyncIterator[None]:
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
        "items",
        "retailer_item_rates",
        "retailer_daily_orders",
        "retailer_daily_order_items",
        "farms",
        "vehicles",
        "org_settings",
        "farm_loads",
        "delivery_runs",
        "delivery_stops",
        "delivery_stop_items",
        "delivery_bills",
        "delivery_bill_items",
        "payments",
        "trip_weight_losses",
        "bill_sequences",
        "expense_categories",
        "expenses",
        "retailer_returns",
        "order_sequences",
    }


def _platform_table_names() -> set[str]:
    return {"organizations", "user_auth_index", "users"}


async def reset_test_database_async() -> None:
    """Drop tenant schemas and truncate public control-plane tables (test isolation).

    Uses advisory xact lock + retry to avoid deadlock when parallel pytest workers
    (backend/tests + test/) reset the same DB concurrently.
    """
    import asyncio as _asyncio

    for attempt in range(3):
        try:
            engine = get_engine()
            async with engine.begin() as conn:
                try:
                    await conn.execute(text("SELECT pg_advisory_xact_lock(87654321)"))
                except Exception:
                    pass
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
                try:
                    await conn.execute(
                        text("TRUNCATE TABLE user_auth_index, users, organizations RESTART IDENTITY CASCADE")
                    )
                except Exception as e:
                    if "does not exist" not in str(e).lower():
                        raise
            return
        except Exception as e:
            if "deadlock" in str(e).lower() and attempt < 2:
                await _asyncio.sleep(0.5 * (attempt + 1))
                continue
            if attempt == 2 and "does not exist" in str(e).lower():
                return
            raise


async def create_platform_tables() -> None:
    """Create public control-plane tables (organizations + auth index + platform users)."""
    import app.models  # noqa: F401 — register metadata

    engine = get_engine()
    platform_tables = [
        table for table in Base.metadata.sorted_tables if table.name in _platform_table_names()
    ]
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        await conn.execute(text("SET search_path TO public"))
        for table in platform_tables:
            await conn.run_sync(table.create, checkfirst=True)
        # Stamp alembic_version so `alembic upgrade head` becomes no-op (idempotent with manage.py)
        await conn.execute(
            text("CREATE TABLE IF NOT EXISTS public.alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)")
        )
        # Public head is 2422fde3c720; use config if available otherwise hard-coded
        try:
            from alembic.config import Config as _AC
            from alembic.script import ScriptDirectory as _SD

            cfg = _AC("alembic.ini")
            sd = _SD.from_config(cfg)
            head = sd.get_current_head()
            if head and isinstance(head, str):
                await conn.execute(
                    text("INSERT INTO public.alembic_version (version_num) VALUES (:v) ON CONFLICT DO NOTHING"),
                    {"v": head},
                )
        except Exception:
            await conn.execute(
                text("INSERT INTO public.alembic_version (version_num) VALUES ('2422fde3c720') ON CONFLICT DO NOTHING")
            )
    await repair_platform_schema_async()


async def repair_platform_schema_async() -> None:
    """Align public control-plane columns and global username uniqueness."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("SET search_path TO public"))
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(30)")
        )
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 0"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE"
            )
        )
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
        table for table in Base.metadata.sorted_tables if table.name in _tenant_table_names()
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
        await conn.execute(
            text(
                f'INSERT INTO "{schema_name}".alembic_version (version_num) VALUES (:v) ON CONFLICT (version_num) DO NOTHING'
            ),
            {"v": TENANT_MIGRATION_HEAD},
        )
        await conn.execute(
            text(f'DELETE FROM "{schema_name}".alembic_version WHERE version_num != :v'),
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
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS total_boxes INTEGER",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS item_id UUID",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS empty_box_weight NUMERIC(8,3)",
        "ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS weight_loss_kg NUMERIC(12,3)",
        "ALTER TABLE retailer_daily_orders DROP COLUMN IF EXISTS requested_kg",
        "ALTER TABLE retailer_daily_orders DROP COLUMN IF EXISTS bird_size",
        "ALTER TABLE delivery_stops DROP COLUMN IF EXISTS ordered_kg",
        "ALTER TABLE delivery_stops DROP COLUMN IF EXISTS delivered_weight_kg",
        "ALTER TABLE delivery_stops DROP COLUMN IF EXISTS rate_per_kg",
        "ALTER TABLE delivery_stops DROP COLUMN IF EXISTS gross_amount",
        "ALTER TABLE delivery_stops DROP COLUMN IF EXISTS delivered_bird_count",
        "ALTER TABLE delivery_stops DROP COLUMN IF EXISTS weight_override_reason",
        "ALTER TABLE delivery_bills DROP COLUMN IF EXISTS weight_kg",
        "ALTER TABLE delivery_bills DROP COLUMN IF EXISTS rate_per_kg",
        "ALTER TABLE delivery_bills ADD COLUMN IF NOT EXISTS checkout_id VARCHAR(64)",
        "ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS delivered_boxes INTEGER",
        "ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,3)",
        "ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS empty_box_weight_kg NUMERIC(12,3)",
        "ALTER TABLE delivery_bill_items ADD COLUMN IF NOT EXISTS box_charge NUMERIC(12,2) NOT NULL DEFAULT 0.00",
        "ALTER TABLE retailer_daily_order_items ADD COLUMN IF NOT EXISTS locked_rate_per_kg NUMERIC(12,2)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_credit BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE retailer_daily_orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(32)",
        "ALTER TABLE retailer_item_rates ADD COLUMN IF NOT EXISTS item_id UUID",
        "ALTER TABLE retailer_returns ADD COLUMN IF NOT EXISTS item_id UUID",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) NOT NULL DEFAULT 'KG'",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS default_price NUMERIC(12,2) NOT NULL DEFAULT 0.00",
        "ALTER TABLE retailer_daily_order_items ALTER COLUMN requested_kg DROP NOT NULL",
        "ALTER TABLE retailer_daily_order_items ALTER COLUMN total_boxes DROP NOT NULL",
        "ALTER TABLE retailer_daily_order_items ALTER COLUMN bird_size DROP NOT NULL",
        "ALTER TABLE retailer_daily_order_items ALTER COLUMN bird_count DROP NOT NULL",
        "ALTER TABLE retailer_daily_order_items ALTER COLUMN notes DROP NOT NULL",
    ]
    async with engine.begin() as conn:
        await conn.execute(text("SET TIME ZONE 'Asia/Kolkata'"))
        await conn.execute(text(f'SET search_path TO "{schema_name}", public'))
        for table in Base.metadata.sorted_tables:
            if table.name in {
                "vehicles",
                "org_settings",
                "expense_categories",
                "expenses",
                "retailer_returns",
                "order_sequences",
                "items",
                "retailer_daily_order_items",
                "delivery_stop_items",
                "delivery_bill_items",
            }:
                await conn.run_sync(table.create, checkfirst=True)
        for stmt in alters:
            await conn.execute(text(stmt))
        # Backfill missing item_id references
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retailer_item_rates' AND column_name='item_id') THEN
                    UPDATE retailer_item_rates SET item_id = (SELECT id FROM items LIMIT 1) WHERE item_id IS NULL;
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
                  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farm_loads' AND column_name='item_id') THEN
                    UPDATE farm_loads SET item_id = (SELECT id FROM items LIMIT 1) WHERE item_id IS NULL;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farm_loads' AND column_name='item_id' AND is_nullable='NO') THEN
                      BEGIN
                        ALTER TABLE farm_loads ALTER COLUMN item_id SET NOT NULL;
                      EXCEPTION WHEN others THEN
                        NULL;
                      END;
                    END IF;
                  END IF;
                END $$;
                """
            )
        )
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
        await conn.execute(
            text(
                f'INSERT INTO "{schema_name}".alembic_version (version_num) VALUES (:v) ON CONFLICT (version_num) DO NOTHING'
            ),
            {"v": TENANT_MIGRATION_HEAD},
        )
        await conn.execute(
            text(f'DELETE FROM "{schema_name}".alembic_version WHERE version_num != :v'),
            {"v": TENANT_MIGRATION_HEAD},
        )
        await conn.execute(text("SET search_path TO public"))
