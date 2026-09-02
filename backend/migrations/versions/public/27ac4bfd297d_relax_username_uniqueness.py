"""relax_username_uniqueness

Revision ID: 27ac4bfd297d
Revises: d85bf12c9678
Create Date: 2026-09-02 13:57:48.167320

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27ac4bfd297d'
down_revision: Union[str, Sequence[str], None] = '2422fde3c720'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the unique index on username_lower
    op.drop_index('ix_user_auth_index_username_lower', table_name='user_auth_index')
    # Re-create it as a non-unique index
    op.create_index('ix_user_auth_index_username_lower', 'user_auth_index', ['username_lower'], unique=False)
    # Add the composite unique constraint
    op.create_unique_constraint('uq_user_auth_index_username_org', 'user_auth_index', ['username_lower', 'organization_id'])


def downgrade() -> None:
    # Drop the composite unique constraint
    op.drop_constraint('uq_user_auth_index_username_org', 'user_auth_index', type_='unique')
    # Drop the non-unique index
    op.drop_index('ix_user_auth_index_username_lower', table_name='user_auth_index')
    # Re-create the unique index
    op.create_index('ix_user_auth_index_username_lower', 'user_auth_index', ['username_lower'], unique=True)
