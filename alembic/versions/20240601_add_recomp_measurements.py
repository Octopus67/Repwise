"""Add recomp_measurements table and seed recomp_mode_enabled feature flag.

Revision ID: recomp_001
Revises:
Create Date: 2024-06-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "recomp_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recomp_measurements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recorded_date", sa.Date, nullable=False),
        sa.Column("waist_cm", sa.Float, nullable=True),
        sa.Column("arm_cm", sa.Float, nullable=True),
        sa.Column("chest_cm", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "waist_cm IS NOT NULL OR arm_cm IS NOT NULL OR chest_cm IS NOT NULL",
            name="chk_at_least_one_measurement",
        ),
    )
    op.create_index(
        "ix_recomp_measurements_user_date",
        "recomp_measurements",
        ["user_id", "recorded_date"],
    )

    # Seed recomp_mode_enabled feature flag
    op.execute(
        """
        INSERT INTO feature_flags (id, flag_name, is_enabled, description, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'recomp_mode_enabled',
            false,
            'Enable body recomposition mode with calorie cycling',
            now(),
            now()
        )
        ON CONFLICT (flag_name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_recomp_measurements_user_date", table_name="recomp_measurements")
    op.drop_table("recomp_measurements")
    op.execute("DELETE FROM feature_flags WHERE flag_name = 'recomp_mode_enabled'")
