"""Add is_favorite column to user_food_frequency table.

Revision ID: f9a1_is_favorite
Revises: f2a1_pr_history
Create Date: 2026-04-15 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f9a1_is_favorite"
down_revision: Union[str, None] = "f6a1_streak_freezes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_food_frequency",
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("user_food_frequency", "is_favorite")
