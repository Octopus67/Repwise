"""seed body_measurements feature flag

Revision ID: l1a2b3c4d5e6
Revises: k1a2b3c4d5e6
Create Date: 2026-04-01 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l1a2b3c4d5e6"
down_revision: Union[str, None] = "k1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO feature_flags (id, flag_name, is_enabled, description, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'body_measurements',
            false,
            'Enable body measurements tracking with Navy body fat calculator and progress photos.',
            now(),
            now()
        )
        ON CONFLICT (flag_name) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM feature_flags WHERE flag_name = 'body_measurements'")
