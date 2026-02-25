"""add_provider_sub_id_index

Revision ID: g1a2b3c4d5e6
Revises: f1a2b3c4d5e6
Create Date: 2026-03-15 10:01:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_subscriptions_provider_sub_id',
        'subscriptions',
        ['provider_subscription_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_subscriptions_provider_sub_id', table_name='subscriptions')
