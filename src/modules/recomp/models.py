"""Recomp module SQLAlchemy models."""

import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from typing import Optional


class RecompMeasurement(Base):
    """Body composition measurement for recomp tracking."""

    __tablename__ = "recomp_measurements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    waist_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    arm_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_recomp_measurements_user_date", "user_id", "recorded_date"),
    )
