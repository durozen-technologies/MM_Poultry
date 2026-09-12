"""make_deliverystopitem_rate_nullable

Revision ID: 6d4effcde8ef
Revises: a1b2c3d40006
Create Date: 2026-09-12 17:05:10.858939

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d4effcde8ef'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d40006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('delivery_stop_items', 'rate_per_kg',
               existing_type=sa.Numeric(precision=12, scale=2),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('delivery_stop_items', 'rate_per_kg',
               existing_type=sa.Numeric(precision=12, scale=2),
               nullable=False)
