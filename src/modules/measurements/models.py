"""SQLAlchemy models for body measurements and measurement progress photos."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin  # Audit fix 8.6


class BodyMeasurement(SoftDeleteMixin, Base):  # Audit fix 8.6
    """A single body measurement entry for a user."""

    __tablename__ = "body_measurements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    body_fat_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    waist_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    neck_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hips_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bicep_left_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bicep_right_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    thigh_left_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    thigh_right_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calf_left_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calf_right_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    photos: Mapped[list["MeasurementProgressPhoto"]] = relationship(
        back_populates="measurement",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_body_measurements_user_id", "user_id"),
        # Audit fix 8.5 — composite index for user measurement history queries
        Index("ix_body_measurements_user_measured", "user_id", "measured_at"),
        Index(
            "ix_body_measurements_not_deleted", "id", postgresql_where=text("deleted_at IS NULL")
        ),
    )


class MeasurementProgressPhoto(Base):
    """A progress photo linked to a body measurement."""

    __tablename__ = "measurement_progress_photos"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    measurement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("body_measurements.id", ondelete="CASCADE"),
        nullable=False,
    )
    photo_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    photo_type: Mapped[str] = mapped_column(String(10), nullable=False)
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_private: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    measurement: Mapped["BodyMeasurement"] = relationship(back_populates="photos")

    __table_args__ = (
        CheckConstraint(
            "photo_type IN ('front', 'side', 'back', 'other')", name="ck_photo_type_valid"
        ),
        Index("ix_measurement_photos_user_id", "user_id"),
        Index("ix_measurement_photos_measurement_id", "measurement_id"),
    )
