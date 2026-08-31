"""add item_id to farm loads

Revision ID: 5028779dda41
Revises: 57e2a56a5ea7
Create Date: 2026-08-27 21:22:06.381368

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5028779dda41'
down_revision: Union[str, Sequence[str], None] = '57e2a56a5ea7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    import os
    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS item_id UUID"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_farm_loads_item_id ON farm_loads (item_id)"))
    # Add FK if not exists
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='farm_loads_item_id_fkey') THEN
            ALTER TABLE farm_loads ADD CONSTRAINT farm_loads_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id);
          END IF;
        END $$;
    """))
    # Handle empty items case: create default item if needed, then backfill
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM items LIMIT 1) THEN
            INSERT INTO items (id, name, uom, default_price, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Default Bird', 'KG', 0.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          END IF;
          UPDATE farm_loads SET item_id = (SELECT id FROM items LIMIT 1) WHERE item_id IS NULL;
        END $$;
    """))
    # Make NOT NULL if possible (idempotent)
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farm_loads' AND column_name='item_id' AND is_nullable='YES') THEN
            BEGIN
              ALTER TABLE farm_loads ALTER COLUMN item_id SET NOT NULL;
            EXCEPTION WHEN others THEN NULL;
            END;
          END IF;
        END $$;
    """))


def downgrade() -> None:
    """Downgrade schema."""
    import os
    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE farm_loads DROP CONSTRAINT IF EXISTS farm_loads_item_id_fkey"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_farm_loads_item_id"))
    conn.execute(sa.text("ALTER TABLE farm_loads DROP COLUMN IF EXISTS item_id"))
