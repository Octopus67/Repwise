"""Add social tables: follows, feed_events, reactions, leaderboard_entries, shared_templates.

Revision ID: s0c1_social_tables
Revises: g1b2_gin_indexes
Create Date: 2026-07-16 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "s0c1_social_tables"
down_revision: Union[str, None] = "g1b2_gin_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- follows --
    op.create_table(
        "follows",
        sa.Column("id", sa.Uuid(), nullable=True),
        sa.Column("follower_id", sa.Uuid(), nullable=False),
        sa.Column("following_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["following_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("follower_id != following_id", name="no_self_follow"),
        sa.PrimaryKeyConstraint("follower_id", "following_id"),
    )
    op.create_index("idx_follows_following", "follows", ["following_id"])

    # -- feed_events --
    op.create_table(
        "feed_events",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("ref_id", sa.Uuid(), nullable=False),
        sa.Column(
            "metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_feed_user_time", "feed_events", ["user_id", "created_at"])

    # -- reactions --
    op.create_table(
        "reactions",
        sa.Column("id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("feed_event_id", sa.Uuid(), nullable=False),
        sa.Column("emoji", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["feed_event_id"], ["feed_events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "feed_event_id"),
    )

    # -- leaderboard_entries --
    op.create_table(
        "leaderboard_entries",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("board_type", sa.String(20), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("score", sa.Numeric(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("board_type", "period_start", "user_id", name="uq_leaderboard_entry"),
    )
    op.create_index(
        "idx_lb_board_period_rank", "leaderboard_entries", ["board_type", "period_start", "rank"]
    )

    # -- shared_templates --
    op.create_table(
        "shared_templates",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("share_code", sa.String(12), nullable=False),
        sa.Column("copy_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["workout_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("share_code"),
    )
    op.create_index("idx_shared_templates_owner", "shared_templates", ["owner_id"])
    op.create_index("idx_shared_templates_template", "shared_templates", ["template_id"])


def downgrade() -> None:
    op.drop_table("shared_templates")
    op.drop_table("leaderboard_entries")
    op.drop_table("reactions")
    op.drop_table("feed_events")
    op.drop_table("follows")
