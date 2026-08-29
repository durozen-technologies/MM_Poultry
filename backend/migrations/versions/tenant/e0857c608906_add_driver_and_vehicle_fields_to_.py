"""add driver and vehicle fields to delivery_run

Revision ID: e0857c608906
Revises: 36325e542abe
Create Date: 2026-08-29 12:41:37.346176

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0857c608906'
down_revision: Union[str, Sequence[str], None] = '36325e542abe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('delivery_runs', sa.Column('driver_user_id', sa.UUID(), nullable=True))
    op.add_column('delivery_runs', sa.Column('driver_name', sa.String(length=120), nullable=True))
    op.add_column('delivery_runs', sa.Column('vehicle_id', sa.UUID(), nullable=True))
    op.add_column('delivery_runs', sa.Column('vehicle_number', sa.String(length=40), nullable=True))
    op.create_foreign_key('fk_delivery_runs_vehicle_id', 'delivery_runs', 'vehicles', ['vehicle_id'], ['id'])
    op.alter_column('delivery_runs', 'farm_load_id', nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('delivery_runs', 'farm_load_id', nullable=False)
    op.drop_constraint('fk_delivery_runs_vehicle_id', 'delivery_runs', type_='foreignkey')
    op.drop_column('delivery_runs', 'vehicle_number')
    op.drop_column('delivery_runs', 'vehicle_id')
    op.drop_column('delivery_runs', 'driver_name')
    op.drop_column('delivery_runs', 'driver_user_id')
