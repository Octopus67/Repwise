"""add_start_time_end_time_to_training_sessions

Revision ID: da3a088e9188
Revises: 
Create Date: 2026-02-14 19:38:18.090660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da3a088e9188'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('training_sessions', sa.Column('start_time', sa.DateTime(), nullable=True))
    op.add_column('training_sessions', sa.Column('end_time', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('training_sessions', 'end_time')
    op.drop_column('training_sessions', 'start_time')
