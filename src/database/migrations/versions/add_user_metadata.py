"""Add metadata column to users table

Revision ID: add_user_metadata
Revises: fts5_auto_sync
Create Date: 2026-03-09

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "add_user_metadata"
down_revision = "fts5_auto_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add metadata JSONB column to users table
    op.add_column(
        "users",
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("NULL"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "metadata")
