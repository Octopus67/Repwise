"""Readiness module SQLAlchemy models."""

import uuid
from datetime import date

from sqlalchemy import Date, Integer, Float, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from typing import Optional


class RecoveryCheckin(Base):
    """Recovery check-in table — one per user per day (upsert on conflict)."""

    __tablename__ = "recovery_checkins"

    user_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    soreness: Mapped[int] = mapped_column(Integer, nullable=False)
    stress: Mapped[int] = mapped_column(Integer, nullable=False)
    sleep_quality: Mapped[int] = mapped_column(Integer, nullable=False)
    checkin_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "checkin_date", name="uq_checkin_user_date"),
    )


class ReadinessScore(Base):
    """Readiness score table — one per user per day."""

    __tablename__ = "readiness_scores"

    user_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    hrv_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    resting_hr_bpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sleep_duration_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sleep_quality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    soreness: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stress: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    factors_json: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "score_date", name="uq_score_user_date"),
        Index("ix_readiness_scores_user_date_desc", "user_id", text("score_date DESC")),
    )
