"""seed push_notifications feature flag

Revision ID: j1a2b3c4d5e6
Revises: i1a2b3c4d5e6
Create Date: 2026-03-20 10:02:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j1a2b3c4d5e6"
down_revision: Union[str, None] = "i1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO feature_flags (id, flag_name, is_enabled, description, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'push_notifications',
            false,
            'Enable push notifications for workout reminders, PR celebrations, etc.',
            now(),
            now()
        )
        ON CONFLICT (flag_name) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM feature_flags WHERE flag_name = 'push_notifications'")
