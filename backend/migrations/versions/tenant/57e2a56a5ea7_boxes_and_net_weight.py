"""boxes_and_net_weight

Revision ID: 57e2a56a5ea7
Revises: b2c3d4e5f6g7
Create Date: 2026-08-27 20:50:27.340944

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '57e2a56a5ea7'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    import os
    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS delivered_boxes INTEGER"))
    conn.execute(sa.text("ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,3)"))
    conn.execute(sa.text("ALTER TABLE delivery_stop_items ADD COLUMN IF NOT EXISTS empty_box_weight_kg NUMERIC(12,3)"))
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_delivery_stop_run_retailer') THEN
            ALTER TABLE delivery_stops ADD CONSTRAINT uq_delivery_stop_run_retailer UNIQUE (delivery_run_id, retailer_id);
          END IF;
        END $$;
    """))
    conn.execute(sa.text("ALTER TABLE retailer_daily_order_items ALTER COLUMN requested_kg DROP NOT NULL"))
    conn.execute(sa.text("ALTER TABLE retailer_item_rates ADD COLUMN IF NOT EXISTS item_id UUID"))
    # Make item_id NOT NULL idempotently
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retailer_item_rates' AND column_name='item_id' AND is_nullable='YES') THEN
            UPDATE retailer_item_rates SET item_id = (SELECT id FROM items LIMIT 1) WHERE item_id IS NULL;
            IF EXISTS (SELECT 1 FROM items LIMIT 1) THEN
              BEGIN
                ALTER TABLE retailer_item_rates ALTER COLUMN item_id SET NOT NULL;
              EXCEPTION WHEN others THEN NULL;
              END;
            END IF;
          END IF;
        END $$;
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_retailer_item_rates_item_id ON retailer_item_rates (item_id)"))
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_retailer_item_rate') THEN
            ALTER TABLE retailer_item_rates ADD CONSTRAINT uq_retailer_item_rate UNIQUE (retailer_id, item_id, effective_from);
          END IF;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_retailer_item_rates_item_id') THEN
            ALTER TABLE retailer_item_rates ADD CONSTRAINT fk_retailer_item_rates_item_id FOREIGN KEY (item_id) REFERENCES items(id);
          END IF;
        END $$;
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_retailer_returns_item_id ON retailer_returns (item_id)"))
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_retailer_returns_item_id') THEN
            ALTER TABLE retailer_returns ADD CONSTRAINT fk_retailer_returns_item_id FOREIGN KEY (item_id) REFERENCES items(id);
          END IF;
        END $$;
    """))


def downgrade() -> None:
    """Downgrade schema."""
    import os
    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE retailer_returns DROP CONSTRAINT IF EXISTS fk_retailer_returns_item_id"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_retailer_returns_item_id"))
    conn.execute(sa.text("ALTER TABLE retailer_item_rates DROP CONSTRAINT IF EXISTS fk_retailer_item_rates_item_id"))
    conn.execute(sa.text("ALTER TABLE retailer_item_rates DROP CONSTRAINT IF EXISTS uq_retailer_item_rate"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_retailer_item_rates_item_id"))
    conn.execute(sa.text("ALTER TABLE retailer_item_rates ALTER COLUMN item_id DROP NOT NULL"))
    conn.execute(sa.text("ALTER TABLE retailer_daily_order_items ALTER COLUMN requested_kg SET NOT NULL"))
    conn.execute(sa.text("ALTER TABLE delivery_stops DROP CONSTRAINT IF EXISTS uq_delivery_stop_run_retailer"))
    conn.execute(sa.text("ALTER TABLE delivery_stop_items DROP COLUMN IF EXISTS empty_box_weight_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_stop_items DROP COLUMN IF EXISTS gross_weight_kg"))
    conn.execute(sa.text("ALTER TABLE delivery_stop_items DROP COLUMN IF EXISTS delivered_boxes"))
