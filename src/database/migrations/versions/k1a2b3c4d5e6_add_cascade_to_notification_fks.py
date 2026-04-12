"""add cascade to notification fks

Revision ID: k1a2b3c4d5e6
Revises: j1a2b3c4d5e6
Create Date: 2026-03-25 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k1a2b3c4d5e6"
down_revision: Union[str, None] = "j1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # device_tokens: add ON DELETE CASCADE
    op.drop_constraint("device_tokens_user_id_fkey", "device_tokens", type_="foreignkey")
    op.create_foreign_key(
        "device_tokens_user_id_fkey",
        "device_tokens",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # notification_preferences: add ON DELETE CASCADE
    op.drop_constraint(
        "notification_preferences_user_id_fkey", "notification_preferences", type_="foreignkey"
    )
    op.create_foreign_key(
        "notification_preferences_user_id_fkey",
        "notification_preferences",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # notification_preferences: remove CASCADE
    op.drop_constraint(
        "notification_preferences_user_id_fkey", "notification_preferences", type_="foreignkey"
    )
    op.create_foreign_key(
        "notification_preferences_user_id_fkey",
        "notification_preferences",
        "users",
        ["user_id"],
        ["id"],
    )

    # device_tokens: remove CASCADE
    op.drop_constraint("device_tokens_user_id_fkey", "device_tokens", type_="foreignkey")
    op.create_foreign_key(
        "device_tokens_user_id_fkey",
        "device_tokens",
        "users",
        ["user_id"],
        ["id"],
    )
