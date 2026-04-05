"""Add GIN indexes on JSONB columns and composite B-tree indexes.

Revision ID: g1b2_gin_indexes
Revises: fts5_auto_sync
Create Date: 2026-07-15 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "g1b2_gin_indexes"
down_revision: Union[str, None] = "fts5_auto_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Audit fix 8.7 — GIN indexes are PostgreSQL-only; skip on SQLite
    if op.get_bind().dialect.name == "sqlite":
        return
    # GIN indexes for JSONB query performance
    op.create_index(
        "ix_training_sessions_exercises_gin",
        "training_sessions",
        ["exercises"],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_food_items_micro_nutrients_gin",
        "food_items",
        ["micro_nutrients"],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_user_profiles_preferences_gin",
        "user_profiles",
        ["preferences"],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_content_articles_tags_gin",
        "content_articles",
        ["tags"],
        postgresql_using="gin",
    )

    # Composite B-tree index for token blacklist cleanup queries
    op.create_index(
        "ix_token_blacklist_expires",
        "token_blacklist",
        ["expires_at"],
    )


def downgrade() -> None:
    # Audit fix 8.7 — GIN indexes are PostgreSQL-only; skip on SQLite
    if op.get_bind().dialect.name == "sqlite":
        return
    op.drop_index("ix_token_blacklist_expires", table_name="token_blacklist")
    op.drop_index("ix_content_articles_tags_gin", table_name="content_articles")
    op.drop_index("ix_user_profiles_preferences_gin", table_name="user_profiles")
    op.drop_index("ix_food_items_micro_nutrients_gin", table_name="food_items")
    op.drop_index("ix_training_sessions_exercises_gin", table_name="training_sessions")
