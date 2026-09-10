"""remove unused fields from retailer and farm

Revision ID: a1b2c3d40004
Revises: a1b2c3d40003
Create Date: 2026-09-10 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d40006'
down_revision = 'a1b2c3d40005'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Retailers table
    op.drop_column('retailers', 'owner_name')
    op.drop_column('retailers', 'alternate_phone')
    op.drop_column('retailers', 'whatsapp')
    op.drop_column('retailers', 'address')
    op.drop_column('retailers', 'area')
    op.drop_column('retailers', 'category')
    op.drop_column('retailers', 'notes')
    op.drop_column('retailers', 'preferred_delivery_time')

    # Farms table
    op.drop_column('farms', 'owner_name')
    op.drop_column('farms', 'address')

def downgrade() -> None:
    # Retailers table
    op.add_column('retailers', sa.Column('owner_name', sa.String(length=120), nullable=True))
    op.add_column('retailers', sa.Column('alternate_phone', sa.String(length=30), nullable=True))
    op.add_column('retailers', sa.Column('whatsapp', sa.String(length=30), nullable=True))
    op.add_column('retailers', sa.Column('address', sa.String(length=500), nullable=True))
    op.add_column('retailers', sa.Column('area', sa.String(length=120), nullable=True))
    op.add_column('retailers', sa.Column('category', sa.String(length=60), nullable=True))
    op.add_column('retailers', sa.Column('notes', sa.String(length=500), nullable=True))
    op.add_column('retailers', sa.Column('preferred_delivery_time', sa.String(length=40), nullable=True))

    # Farms table
    op.add_column('farms', sa.Column('owner_name', sa.String(length=120), nullable=True))
    op.add_column('farms', sa.Column('address', sa.String(length=500), nullable=True))
