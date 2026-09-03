"""dispatch reconciliation: allocations, remaining kg, audit

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-03 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import os

    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS planned_kg NUMERIC(12,3)"))
    conn.execute(
        sa.text(
            "UPDATE farm_loads SET planned_kg = loaded_weight_kg WHERE planned_kg IS NULL"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS route_id UUID"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS planned_kg NUMERIC(12,3)"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS actual_loaded_kg NUMERIC(12,3)"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS returned_kg NUMERIC(12,3)"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS wastage_kg NUMERIC(12,3)"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS reconciliation_notes VARCHAR(500)"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS remaining_kg NUMERIC(12,3)"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE delivery_stop_items SET remaining_kg = ordered_kg WHERE remaining_kg IS NULL"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(500)"
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS delivery_run_farm_loads (
                delivery_run_id UUID NOT NULL REFERENCES delivery_runs(id) ON DELETE CASCADE,
                farm_load_id UUID NOT NULL REFERENCES farm_loads(id),
                allocated_kg NUMERIC(12,3) NOT NULL,
                PRIMARY KEY (delivery_run_id, farm_load_id)
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS stock_quantity_events (
                id UUID NOT NULL PRIMARY KEY,
                entity_type VARCHAR(40) NOT NULL,
                entity_id UUID NOT NULL,
                field VARCHAR(60) NOT NULL,
                old_value NUMERIC(12,3),
                new_value NUMERIC(12,3),
                reason VARCHAR(500),
                actor_user_id UUID,
                ref_type VARCHAR(40),
                ref_id UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_stock_quantity_events_entity ON stock_quantity_events (entity_type, entity_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_delivery_runs_route_id ON delivery_runs (route_id)"
        )
    )
    # Backfill join table from existing farm_load_id links
    conn.execute(
        sa.text(
            """
            INSERT INTO delivery_run_farm_loads (delivery_run_id, farm_load_id, allocated_kg)
            SELECT dr.id, dr.farm_load_id,
                   COALESCE(dr.planned_kg,
                            (SELECT COALESCE(SUM(dsi.ordered_kg), 0)
                             FROM delivery_stops ds
                             JOIN delivery_stop_items dsi ON dsi.delivery_stop_id = ds.id
                             WHERE ds.delivery_run_id = dr.id))
            FROM delivery_runs dr
            WHERE dr.farm_load_id IS NOT NULL
            ON CONFLICT DO NOTHING
            """
        )
    )


def downgrade() -> None:
    import os

    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS stock_quantity_events"))
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery_run_farm_loads"))
    conn.execute(sa.text("ALTER TABLE delivery_stops DROP COLUMN IF EXISTS failure_reason"))
    conn.execute(sa.text("ALTER TABLE delivery_stop_items DROP COLUMN IF EXISTS remaining_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS reconciliation_notes"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS reconciled_at"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS wastage_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS returned_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS actual_loaded_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS planned_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS route_id"))
    conn.execute(sa.text("ALTER TABLE farm_loads DROP COLUMN IF EXISTS planned_kg"))
