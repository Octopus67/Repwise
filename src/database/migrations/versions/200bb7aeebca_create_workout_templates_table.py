"""create_workout_templates_table

Revision ID: 200bb7aeebca
Revises: da3a088e9188
Create Date: 2026-02-14 19:50:04.171878

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '200bb7aeebca'
down_revision: Union[str, None] = 'da3a088e9188'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workout_templates',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('exercises', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_workout_templates_user_id', 'workout_templates', ['user_id'], unique=False)
    op.create_index('ix_workout_templates_user_sort', 'workout_templates', ['user_id', 'sort_order'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_workout_templates_user_sort', table_name='workout_templates')
    op.drop_index('ix_workout_templates_user_id', table_name='workout_templates')
    op.drop_table('workout_templates')
