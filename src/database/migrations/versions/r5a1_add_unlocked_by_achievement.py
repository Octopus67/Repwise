"""Add unlocked_by_achievement column to content_articles table.

Revision ID: r5a1_unlocked_by_achievement
Revises: f9a1_is_favorite
Create Date: 2026-05-01 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "r5a1_unlocked_by_achievement"
down_revision: Union[str, None] = "f9a1_is_favorite"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "content_articles",
        sa.Column("unlocked_by_achievement", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("content_articles", "unlocked_by_achievement")
