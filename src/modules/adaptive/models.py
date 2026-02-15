"""Adaptive module SQLAlchemy models."""

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Date, Float, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class AdaptiveSnapshot(Base):
    """Persisted adaptive engine snapshots.

    Stores the computed caloric/macro targets alongside the full set of
    input parameters used for the computation (Requirement 7.2).
    The input_parameters JSONB column allows future engine changes
    without schema migration.

    Indexes
    -------
    - (user_id, created_at DESC) for efficient history queries.
    """

    __tablename__ = "adaptive_snapshots"

    user_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    target_calories: Mapped[float] = mapped_column(Float, nullable=False)
    target_protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    target_carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    target_fat_g: Mapped[float] = mapped_column(Float, nullable=False)
    ema_current: Mapped[float] = mapped_column(Float, nullable=False)
    adjustment_factor: Mapped[float] = mapped_column(Float, nullable=False)
    input_parameters: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )

    __table_args__ = (
        Index(
            "ix_adaptive_snapshots_user_created",
            "user_id",
            text("created_at DESC"),
        ),
    )


class CoachingSuggestion(Base):
    """Coaching suggestion for collaborative mode (Feature 3).

    Stores proposed macro targets from the adaptive engine alongside
    optional user modifications. Status tracks the suggestion lifecycle:
    pending → accepted | modified | dismissed.
    """

    __tablename__ = "coaching_suggestions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("adaptive_snapshots.id", ondelete="CASCADE"), nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
    )

    # Proposed targets from the engine
    proposed_calories: Mapped[float] = mapped_column(Float, nullable=False)
    proposed_protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    proposed_carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    proposed_fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    # User modifications (collaborative mode)
    modified_calories: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    modified_protein_g: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    modified_carbs_g: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    modified_fat_g: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_coaching_suggestions_user_status", "user_id", "status"),
    )


class DailyTargetOverride(Base):
    """User override for daily adjusted targets (Nutrition-Training Sync)."""

    __tablename__ = "daily_target_overrides"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (
        Index(
            "ix_daily_target_overrides_user_date",
            "user_id",
            "target_date",
            unique=True,
        ),
    )
