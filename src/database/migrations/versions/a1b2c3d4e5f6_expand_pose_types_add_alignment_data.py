"""expand_pose_types_add_alignment_data

Revision ID: a1b2c3d4e5f6
Revises: 200bb7aeebca
Create Date: 2026-03-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '200bb7aeebca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add alignment_data JSON column (nullable)
    op.add_column(
        'progress_photos',
        sa.Column('alignment_data', sa.JSON(), nullable=True),
    )

    # Widen pose_type column from String(20) to String(30)
    op.alter_column(
        'progress_photos',
        'pose_type',
        existing_type=sa.String(20),
        type_=sa.String(30),
        existing_nullable=False,
    )

    # Data migration: rename legacy 'front' to 'front_relaxed'
    op.execute(
        "UPDATE progress_photos SET pose_type = 'front_relaxed' WHERE pose_type = 'front'"
    )


def downgrade() -> None:
    # Revert 'front_relaxed' back to 'front'
    op.execute(
        "UPDATE progress_photos SET pose_type = 'front' WHERE pose_type = 'front_relaxed'"
    )

    # Shrink pose_type column back to String(20)
    op.alter_column(
        'progress_photos',
        'pose_type',
        existing_type=sa.String(30),
        type_=sa.String(20),
        existing_nullable=False,
    )

    # Drop alignment_data column
    op.drop_column('progress_photos', 'alignment_data')
