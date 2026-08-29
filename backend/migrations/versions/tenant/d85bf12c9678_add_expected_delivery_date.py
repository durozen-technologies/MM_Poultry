"""add expected_delivery_date

Revision ID: d85bf12c9678
Revises: e0857c608906
Create Date: 2026-08-29 15:51:31.295427

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd85bf12c9678'
down_revision: Union[str, Sequence[str], None] = 'e0857c608906'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('retailer_daily_orders', sa.Column('expected_delivery_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('retailer_daily_orders', 'expected_delivery_date')
