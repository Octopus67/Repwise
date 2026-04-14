"""add daily_steps table

Revision ID: st1a2b3c4d5e
Revises: cleanup_orphaned_pii
Create Date: 2026-04-14 13:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "st1a2b3c4d5e"
down_revision: Union[str, None] = "cleanup_orphaned_pii"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_steps",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("step_count", sa.Integer(), nullable=False),
        sa.Column("step_goal", sa.Integer(), server_default="8000", nullable=False),
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
        sa.UniqueConstraint("user_id", "date", name="uq_daily_steps_user_date"),
        sa.CheckConstraint("step_count >= 0", name="ck_daily_steps_count_non_negative"),
    )
    op.create_index("ix_daily_steps_user_date", "daily_steps", ["user_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_daily_steps_user_date", table_name="daily_steps")
    op.drop_table("daily_steps")
