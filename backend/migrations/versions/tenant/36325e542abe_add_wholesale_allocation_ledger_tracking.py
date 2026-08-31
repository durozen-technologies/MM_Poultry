"""Add wholesale allocation ledger tracking

Revision ID: 36325e542abe
Revises: 5028779dda41
Create Date: 2026-08-27 23:04:31.939543

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36325e542abe'
down_revision: Union[str, Sequence[str], None] = '5028779dda41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    import os
    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID NOT NULL PRIMARY KEY,
            username VARCHAR(80) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(120),
            mobile_number VARCHAR(30),
            role VARCHAR(20) NOT NULL,
            organization_id UUID,
            retailer_id UUID,
            is_active BOOLEAN DEFAULT true NOT NULL,
            permissions_version INTEGER DEFAULT 0 NOT NULL,
            last_login_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_created_at ON users (created_at)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_organization_id ON users (organization_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_retailer_id ON users (retailer_id)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
    conn.execute(sa.text("ALTER TABLE delivery_bill_items ADD COLUMN IF NOT EXISTS box_charge NUMERIC(12,2) NOT NULL DEFAULT 0.00"))
    conn.execute(sa.text("ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS empty_box_weight NUMERIC(8,3)"))
    conn.execute(sa.text("ALTER TABLE farm_loads ADD COLUMN IF NOT EXISTS weight_loss_kg NUMERIC(12,3)"))
    conn.execute(sa.text("ALTER TABLE retailer_daily_order_items ADD COLUMN IF NOT EXISTS locked_rate_per_kg NUMERIC(12,2)"))


def downgrade() -> None:
    """Downgrade schema."""
    import os
    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE retailer_daily_order_items DROP COLUMN IF EXISTS locked_rate_per_kg"))
    conn.execute(sa.text("ALTER TABLE farm_loads DROP COLUMN IF EXISTS weight_loss_kg"))
    conn.execute(sa.text("ALTER TABLE farm_loads DROP COLUMN IF EXISTS empty_box_weight"))
    conn.execute(sa.text("ALTER TABLE delivery_bill_items DROP COLUMN IF EXISTS box_charge"))
    # users table downgrade is no-op to avoid data loss; kept for idempotency
