"""create measurement_progress_photos table

Revision ID: n1a2b3c4d5e6
Revises: m1a2b3c4d5e6
Create Date: 2026-04-01 10:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'n1a2b3c4d5e6'
down_revision: Union[str, None] = 'm1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'measurement_progress_photos',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('measurement_id', sa.Uuid(), nullable=False),
        sa.Column('photo_url', sa.String(length=1024), nullable=False),
        sa.Column('photo_type', sa.String(length=10), nullable=False),
        sa.Column('taken_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['measurement_id'], ['body_measurements.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("photo_type IN ('front', 'side', 'back', 'other')", name='ck_photo_type_valid'),
    )
    op.create_index('ix_measurement_photos_user_id', 'measurement_progress_photos', ['user_id'])
    op.create_index('ix_measurement_photos_measurement_id', 'measurement_progress_photos', ['measurement_id'])


def downgrade() -> None:
    op.drop_index('ix_measurement_photos_measurement_id', table_name='measurement_progress_photos')
    op.drop_index('ix_measurement_photos_user_id', table_name='measurement_progress_photos')
    op.drop_table('measurement_progress_photos')
