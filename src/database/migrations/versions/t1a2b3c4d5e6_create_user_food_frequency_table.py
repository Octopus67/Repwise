"""Create user_food_frequency table for personalized food search ranking.

Revision ID: t1a2b3c4d5e6
Revises: s1a2b3c4d5e6
Create Date: 2026-04-01 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "t1a2b3c4d5e6"
down_revision: Union[str, None] = "s1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_food_frequency",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("food_item_id", sa.Uuid(), nullable=False),
        sa.Column("log_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_logged_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["food_item_id"], ["food_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "food_item_id", name="uq_user_food_frequency"),
    )
    # Composite index covers user_id lookups; standalone user_id index omitted
    op.create_index(
        "ix_user_food_frequency_user_food",
        "user_food_frequency",
        ["user_id", "food_item_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_food_frequency_user_food", table_name="user_food_frequency")
    op.drop_table("user_food_frequency")
