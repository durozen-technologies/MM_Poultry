"""remove delivery runs feature

Revision ID: a1b2c3d40001
Revises: f85bff95fa2b
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d40001"
down_revision: Union[str, Sequence[str], None] = "f85bff95fa2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import os

    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()

    # Step 1: Add retailer_daily_order_id column (nullable first for backfill)
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_bills ADD COLUMN IF NOT EXISTS retailer_daily_order_id UUID"
        )
    )

    # Step 2: Backfill from delivery_stops.daily_order_id via JOIN
    conn.execute(
        sa.text(
            """
            UPDATE delivery_bills db
            SET retailer_daily_order_id = ds.daily_order_id
            FROM delivery_stops ds
            WHERE db.delivery_stop_id = ds.id
              AND db.retailer_daily_order_id IS NULL
            """
        )
    )

    # Step 3: For any remaining NULL values, set to a placeholder (shouldn't happen in production)
    # We skip this - if data exists without a daily_order_id, it would need manual resolution

    # Step 4: Add NOT NULL constraint and FK
    conn.execute(
        sa.text(
            "ALTER TABLE delivery_bills ALTER COLUMN retailer_daily_order_id SET NOT NULL"
        )
    )
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_delivery_bills_order'
              ) THEN
                ALTER TABLE delivery_bills
                  ADD CONSTRAINT fk_delivery_bills_order
                  FOREIGN KEY (retailer_daily_order_id) REFERENCES retailer_daily_orders(id);
              END IF;
            END $$;
            """
        )
    )
    conn.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_bills_order ON delivery_bills (retailer_daily_order_id)"
        )
    )

    # Step 5: Drop delivery_stop_id column
    conn.execute(sa.text("ALTER TABLE delivery_bills DROP COLUMN IF EXISTS delivery_stop_id"))

    # Step 6: Drop tables in FK-respecting order
    conn.execute(sa.text("DROP TABLE IF EXISTS trip_weight_losses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery_stop_items CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery_stops CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery_run_farm_loads CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery_runs CASCADE"))


def downgrade() -> None:
    pass
