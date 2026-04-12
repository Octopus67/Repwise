"""Add password_changed_at column to users table for session invalidation.

Revision ID: b16a1_password_changed_at
Revises: r2a1_weekly_challenges
Create Date: 2026-07-01 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b16a1_password_changed_at"
down_revision: Union[str, None] = "r2a1_weekly_challenges"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "password_changed_at")
