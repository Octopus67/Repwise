"""Create body_measurements and measurement_progress_photos tables.

Revision ID: body_measurements_001
Revises: meal_plans_001
"""

from alembic import op
import sqlalchemy as sa

revision = "body_measurements_001"
down_revision = "meal_plans_001"
branch_labels = None
depends_on = None


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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_body_measurements_user_id", "body_measurements", ["user_id"])
    op.execute(
        "ALTER TABLE body_measurements "
        "ADD CONSTRAINT uq_body_measurements_user_date UNIQUE (user_id, (DATE(measured_at)))"
    )

    op.create_table(
        "measurement_progress_photos",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("measurement_id", sa.Uuid(), nullable=False),
        sa.Column("photo_url", sa.String(1024), nullable=False),
        sa.Column("photo_type", sa.String(10), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_private", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["measurement_id"], ["body_measurements.id"], ondelete="CASCADE"),
        sa.CheckConstraint("photo_type IN ('front', 'side', 'back', 'other')", name="ck_photo_type_valid"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_measurement_photos_user_id", "measurement_progress_photos", ["user_id"])
    op.create_index("ix_measurement_photos_measurement_id", "measurement_progress_photos", ["measurement_id"])


def downgrade() -> None:
    op.drop_index("ix_measurement_photos_measurement_id", table_name="measurement_progress_photos")
    op.drop_index("ix_measurement_photos_user_id", table_name="measurement_progress_photos")
    op.drop_table("measurement_progress_photos")
    op.drop_constraint("uq_body_measurements_user_date", "body_measurements", type_="unique")
    op.drop_index("ix_body_measurements_user_id", table_name="body_measurements")
    op.drop_table("body_measurements")
