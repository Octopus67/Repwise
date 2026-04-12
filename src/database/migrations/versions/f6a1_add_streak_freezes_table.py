"""Add streak_freezes table for F6 streak freeze mechanism.

Revision ID: f6a1_streak_freezes
Revises: f2a1_pr_history
Create Date: 2026-06-01 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a1_streak_freezes"
down_revision: Union[str, None] = "f2a1_pr_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "streak_freezes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("freeze_date", sa.Date(), nullable=False),
        sa.Column(
            "used_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "freeze_date", name="uq_streak_freeze_user_date"),
    )
    op.create_index("ix_streak_freezes_user_id", "streak_freezes", ["user_id"])
    op.create_index("ix_streak_freezes_user_month", "streak_freezes", ["user_id", "month"])


def downgrade() -> None:
    op.drop_index("ix_streak_freezes_user_month", table_name="streak_freezes")
    op.drop_index("ix_streak_freezes_user_id", table_name="streak_freezes")
    op.drop_table("streak_freezes")
