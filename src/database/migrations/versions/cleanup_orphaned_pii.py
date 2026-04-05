"""Cleanup orphaned PII rows — Audit fix 1.2

Delete rows from child tables where user_id references a non-existent user.

Revision ID: cleanup_orphaned_pii
Revises: 28c15b684365
Create Date: 2026-04-05 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "cleanup_orphaned_pii"
down_revision: Union[str, None] = "28c15b684365"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables with user_id FK that may contain orphaned rows
_CHILD_TABLES = [
    "nutrition_entries",
    "training_sessions",
    "subscriptions",
    "adaptive_snapshots",
    "user_achievements",
    "achievement_progress",
    "health_reports",
    "payment_transactions",
    "recovery_checkins",
    "readiness_scores",
    "workout_templates",
    "password_reset_codes",
    "email_verification_codes",
    "user_volume_landmarks",
    # Audit fix 1.2 — additional tables with user_id FK
    "bodyweight_logs",
    "user_profiles",
    "user_goals",
    "user_metrics",
    "progress_photos",
    "training_blocks",
    "custom_exercises",
    "personal_records",
    "device_tokens",
    "notification_preferences",
    "notification_log",
    "meal_plans",
    "body_measurements",
    "measurement_progress_photos",
    "recomp_measurements",
    "export_requests",
    "coach_profiles",
    "coaching_requests",
    "coaching_sessions",
    "feed_events",
    "reactions",
    "leaderboard_entries",
    "article_favorites",
    "user_food_frequency",
    "weekly_challenges",
    "custom_meals",
    "meal_favorites",
    "coaching_suggestions",
    "daily_target_overrides",
    "share_events",
    "streak_freezes",
]

# Tables with non-standard user FK columns (not "user_id")
_SPECIAL_FK_TABLES = [
    ("follows", "follower_id"),
    ("follows", "following_id"),
    ("shared_templates", "owner_id"),
    ("referrals", "referrer_id"),
]


def upgrade() -> None:
    conn = op.get_bind()
    # SQLite is dev-only; skip to avoid dialect issues
    if conn.dialect.name == "sqlite":
        return
    for table in _CHILD_TABLES:
        op.execute(
            text(f"DELETE FROM {table} WHERE user_id NOT IN (SELECT id FROM users)")
        )
    for table, fk_col in _SPECIAL_FK_TABLES:
        op.execute(
            text(f"DELETE FROM {table} WHERE {fk_col} NOT IN (SELECT id FROM users)")
        )


def downgrade() -> None:
    # Deleted data cannot be restored — no-op
    pass
