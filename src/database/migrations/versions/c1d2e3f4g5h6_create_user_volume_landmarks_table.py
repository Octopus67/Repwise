"""create_user_volume_landmarks_table

Revision ID: c1d2e3f4g5h6
Revises: b1c2d3e4f5g6
Create Date: 2026-03-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4g5h6"
down_revision: Union[str, None] = "b1c2d3e4f5g6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_volume_landmarks",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("muscle_group", sa.String(length=50), nullable=False),
        sa.Column("mev", sa.Integer(), nullable=False),
        sa.Column("mav", sa.Integer(), nullable=False),
        sa.Column("mrv", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "muscle_group", name="uq_user_muscle_landmark"),
    )
    op.create_index("ix_user_volume_landmarks_user_id", "user_volume_landmarks", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_volume_landmarks_user_id", table_name="user_volume_landmarks")
    op.drop_table("user_volume_landmarks")
