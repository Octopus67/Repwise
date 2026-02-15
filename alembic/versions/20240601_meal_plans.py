"""Create meal_plans and meal_plan_items tables.

Revision ID: meal_plans_001
Revises: (latest)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "meal_plans_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meal_plans",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("num_days", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("slot_splits", postgresql.JSONB(), nullable=False,
                  server_default='{"breakfast":0.25,"lunch":0.30,"dinner":0.35,"snack":0.10}'),
        sa.Column("weekly_calories", sa.Float(), nullable=False),
        sa.Column("weekly_protein_g", sa.Float(), nullable=False),
        sa.Column("weekly_carbs_g", sa.Float(), nullable=False),
        sa.Column("weekly_fat_g", sa.Float(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meal_plans_user_id", "meal_plans", ["user_id"])

    op.create_table(
        "meal_plan_items",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("day_index", sa.Integer(), nullable=False),
        sa.Column("slot", sa.String(20), nullable=False),
        sa.Column("food_item_id", sa.Uuid(), nullable=False),
        sa.Column("scale_factor", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("calories", sa.Float(), nullable=False),
        sa.Column("protein_g", sa.Float(), nullable=False),
        sa.Column("carbs_g", sa.Float(), nullable=False),
        sa.Column("fat_g", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["meal_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["food_item_id"], ["food_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meal_plan_items_plan_id", "meal_plan_items", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_meal_plan_items_plan_id", table_name="meal_plan_items")
    op.drop_table("meal_plan_items")
    op.drop_index("ix_meal_plans_user_id", table_name="meal_plans")
    op.drop_table("meal_plans")
