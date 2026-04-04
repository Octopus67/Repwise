"""merge social tables and user metadata branches

Revision ID: 28c15b684365
Revises: add_user_metadata, s0c1_social_tables
Create Date: 2026-03-19 22:56:59.977962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28c15b684365'
down_revision: Union[str, None] = ('add_user_metadata', 's0c1_social_tables')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
