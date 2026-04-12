"""add_trial_fields_to_users

Revision ID: o1a2b3c4d5e6
Revises: n1a2b3c4d5e6
Create Date: 2026-04-01 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "o1a2b3c4d5e6"
down_revision: Union[str, None] = "n1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("has_used_trial", sa.Boolean(), nullable=False, server_default="false")
    )
    op.add_column("users", sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "trial_ends_at")
    op.drop_column("users", "trial_started_at")
    op.drop_column("users", "has_used_trial")
