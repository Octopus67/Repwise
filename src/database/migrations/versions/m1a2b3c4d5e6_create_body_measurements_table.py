"""create body_measurements table

Revision ID: m1a2b3c4d5e6
Revises: l1a2b3c4d5e6
Create Date: 2026-04-01 10:01:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "m1a2b3c4d5e6"
down_revision: Union[str, None] = "l1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "body_measurements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("body_fat_pct", sa.Float(), nullable=True),
        sa.Column("waist_cm", sa.Float(), nullable=True),
        sa.Column("neck_cm", sa.Float(), nullable=True),
        sa.Column("hips_cm", sa.Float(), nullable=True),
        sa.Column("chest_cm", sa.Float(), nullable=True),
        sa.Column("bicep_left_cm", sa.Float(), nullable=True),
        sa.Column("bicep_right_cm", sa.Float(), nullable=True),
        sa.Column("thigh_left_cm", sa.Float(), nullable=True),
        sa.Column("thigh_right_cm", sa.Float(), nullable=True),
        sa.Column("calf_left_cm", sa.Float(), nullable=True),
        sa.Column("calf_right_cm", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_body_measurements_user_id", "body_measurements", ["user_id"])
    # PostgreSQL: timezone-aware datetime cast to date requires explicit timezone
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute(
            sa.text(
                "CREATE UNIQUE INDEX uq_body_measurements_user_date "
                "ON body_measurements (user_id, CAST(measured_at AT TIME ZONE 'UTC' AS date))"
            )
        )
    else:
        op.create_index(
            "uq_body_measurements_user_date",
            "body_measurements",
            ["user_id", sa.text("DATE(measured_at)")],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index("uq_body_measurements_user_date", table_name="body_measurements")
    op.drop_index("ix_body_measurements_user_id", table_name="body_measurements")
    op.drop_table("body_measurements")
