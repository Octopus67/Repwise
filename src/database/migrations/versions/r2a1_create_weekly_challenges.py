"""Create weekly_challenges table for R2 weekly micro-challenges.

Revision ID: r2a1_weekly_challenges
Revises: r5a1_unlocked_by_achievement
Create Date: 2026-06-15 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "r2a1_weekly_challenges"
down_revision: Union[str, None] = "r5a1_unlocked_by_achievement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_challenges",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("challenge_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("target_value", sa.Integer(), nullable=False),
        sa.Column("current_value", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "week_start", "challenge_type", name="uq_challenge_user_week_type"),
    )
    op.create_index("ix_weekly_challenges_user_id", "weekly_challenges", ["user_id"])
    op.create_index("ix_weekly_challenges_user_week", "weekly_challenges", ["user_id", "week_start"])


def downgrade() -> None:
    op.drop_index("ix_weekly_challenges_user_week", table_name="weekly_challenges")
    op.drop_index("ix_weekly_challenges_user_id", table_name="weekly_challenges")
    op.drop_table("weekly_challenges")
