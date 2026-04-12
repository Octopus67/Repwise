"""Recomp module SQLAlchemy models."""

import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin  # Audit fix 8.6
from typing import Optional


class RecompMeasurement(SoftDeleteMixin, Base):  # Audit fix 8.6
    """Body composition measurement for recomp tracking."""

    __tablename__ = "recomp_measurements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    waist_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    arm_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_recomp_measurements_user_date", "user_id", "recorded_date"),
        Index(
            "ix_recomp_measurements_not_deleted", "id", postgresql_where=text("deleted_at IS NULL")
        ),
    )
