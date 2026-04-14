"""SQLAlchemy model for daily step tracking."""

from __future__ import annotations

import uuid
from datetime import date as date_type

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class DailyStep(Base):
    """A single daily step count entry for a user."""

    __tablename__ = "daily_steps"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    step_count: Mapped[int] = mapped_column(Integer, nullable=False)
    step_goal: Mapped[int] = mapped_column(
        Integer, nullable=False, default=8000, server_default="8000"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_steps_user_date"),
        CheckConstraint("step_count >= 0", name="ck_daily_steps_count_non_negative"),
        # Composite index for efficient history queries (most recent first)
        Index("ix_daily_steps_user_date", "user_id", "date"),
    )
