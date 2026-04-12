"""Create personal_records table for PR history persistence.

Revision ID: f2a1_pr_history
Revises: t1a2b3c4d5e6
Create Date: 2026-04-01 11:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f2a1_pr_history"
down_revision: Union[str, None] = "t1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personal_records",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_name", sa.String(200), nullable=False),
        sa.Column("pr_type", sa.String(20), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("value_kg", sa.Float(), nullable=False),
        sa.Column("previous_value_kg", sa.Float(), nullable=True),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column(
            "achieved_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(["session_id"], ["training_sessions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_personal_records_user_id", "personal_records", ["user_id"])
    op.create_index(
        "ix_personal_records_user_exercise",
        "personal_records",
        ["user_id", "exercise_name"],
    )


def downgrade() -> None:
    op.drop_index("ix_personal_records_user_exercise", table_name="personal_records")
    op.drop_index("ix_personal_records_user_id", table_name="personal_records")
    op.drop_table("personal_records")
