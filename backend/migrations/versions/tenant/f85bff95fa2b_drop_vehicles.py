"""drop vehicles

Revision ID: f85bff95fa2b
Revises: b3c4d5e6f7g8
Create Date: 2026-09-08 09:44:33.234824

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f85bff95fa2b'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE farm_loads DROP COLUMN IF EXISTS vehicle_id CASCADE")
    op.execute("ALTER TABLE farm_loads DROP COLUMN IF EXISTS vehicle_number")
    op.execute("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS vehicle_id CASCADE")
    op.execute("ALTER TABLE delivery_runs DROP COLUMN IF EXISTS vehicle_number")
    op.execute("DROP TABLE IF EXISTS vehicles CASCADE")


def downgrade() -> None:
    """Downgrade schema."""
    pass
