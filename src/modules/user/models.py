"""User module SQLAlchemy models.

Tables: UserProfiles, UserMetrics, BodyweightLogs, UserGoals.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.base_model import Base
from src.shared.types import ActivityLevel, GoalType
from typing import Optional


class UserProfile(Base):
    """One-to-one profile for a user.

    Stores display preferences, region, and an extensible JSONB
    preferences blob.
    """

    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    preferred_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=None)
    coaching_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="coached",
    )


class UserMetric(Base):
    """Append-only physiological metrics log.

    Each row is a point-in-time snapshot — previous records are never
    overwritten (Requirement 2.5).
    """

    __tablename__ = "user_metrics"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    body_fat_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    activity_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    additional_metrics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=None)
    recorded_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        default=None,
    )

    __table_args__ = (
        Index("ix_user_metrics_user_recorded", "user_id", recorded_at.desc()),
    )


class BodyweightLog(Base):
    """Daily bodyweight entries.

    Append-only — previous entries are never overwritten (Requirement 2.5).
    """

    __tablename__ = "bodyweight_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        Index("ix_bodyweight_logs_user_date", "user_id", recorded_date.desc()),
    )


class UserGoal(Base):
    """One-to-one goal record for a user.

    Stores target weight, body fat, goal type, and weekly rate.
    """

    __tablename__ = "user_goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    goal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    target_body_fat_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    goal_rate_per_week: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    additional_goals: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=None)
