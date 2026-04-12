"""add push notification columns to device_tokens and notification_preferences

Revision ID: h1a2b3c4d5e6
Revises: g1a2b3c4d5e6
Create Date: 2026-03-20 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h1a2b3c4d5e6"
down_revision: Union[str, None] = "g1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # device_tokens: add expo_push_token and last_used_at
    op.execute("""
        ALTER TABLE device_tokens
        ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(512),
        ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ
    """)

    # notification_preferences: add granular preference columns
    op.execute("""
        ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS workout_reminders BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS meal_reminders BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS pr_celebrations BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS weekly_checkin_alerts BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS volume_warnings BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
        ADD COLUMN IF NOT EXISTS quiet_hours_end TIME
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE notification_preferences
        DROP COLUMN IF EXISTS quiet_hours_end,
        DROP COLUMN IF EXISTS quiet_hours_start,
        DROP COLUMN IF EXISTS volume_warnings,
        DROP COLUMN IF EXISTS weekly_checkin_alerts,
        DROP COLUMN IF EXISTS pr_celebrations,
        DROP COLUMN IF EXISTS meal_reminders,
        DROP COLUMN IF EXISTS workout_reminders
    """)

    op.execute("""
        ALTER TABLE device_tokens
        DROP COLUMN IF EXISTS last_used_at,
        DROP COLUMN IF EXISTS expo_push_token
    """)
