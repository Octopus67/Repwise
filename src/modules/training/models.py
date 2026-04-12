"""Training module SQLAlchemy models."""

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class TrainingSession(SoftDeleteMixin, AuditLogMixin, Base):
    """Training sessions table.

    Stores per-user training sessions with structured exercise data
    in JSONB for extensibility (Requirement 6.5).

    Exercises JSONB structure::

        [
            {
                "exercise_name": "Bench Press",
                "sets": [
                    {"reps": 8, "weight_kg": 80.0, "rpe": 7.5},
                    {"reps": 6, "weight_kg": 85.0, "rpe": 8.0}
                ]
            }
        ]
    """

    __tablename__ = "training_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    session_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    exercises: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        server_default=text("'{}'::jsonb"),
    )
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(default=1, server_default="1")

    __mapper_args__ = {"version_id_col": version}

    __table_args__ = (
        Index(
            "ix_training_sessions_user_date",
            "user_id",
            text("session_date DESC"),
        ),
        Index(
            "ix_training_sessions_not_deleted",
            "deleted_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class WorkoutTemplate(SoftDeleteMixin, AuditLogMixin, Base):
    """User-created workout templates.

    Stores reusable workout blueprints with exercise lists, set counts,
    target weights/reps, and notes (Requirement 11.2).

    Exercises JSONB structure matches TrainingSession.exercises format.
    """

    __tablename__ = "workout_templates"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    exercises: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        server_default=text("'{}'::jsonb"),
    )
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    __table_args__ = (
        Index(
            "ix_workout_templates_user_id",
            "user_id",
        ),
        Index(
            "ix_workout_templates_user_sort",
            "user_id",
            "sort_order",
        ),
        # Audit fix 8.4 — partial index for active (non-deleted) templates
        Index(
            "ix_workout_templates_active", "user_id", postgresql_where=text("deleted_at IS NULL")
        ),
    )


class CustomExercise(SoftDeleteMixin, Base):
    """User-created custom exercises.

    Stores user-specific exercises that appear alongside system exercises
    in the exercise picker and search results (Requirement 13).
    """

    __tablename__ = "custom_exercises"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(50), nullable=False)
    secondary_muscles: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    equipment: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="compound")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "ix_custom_exercises_not_deleted",
            "deleted_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class PersonalRecord(Base):
    """Persisted personal records for PR history (Requirement F2).

    Each row captures a single PR event: the exercise, rep count,
    new value, and optional link back to the training session.
    """

    __tablename__ = "personal_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_name: Mapped[str] = mapped_column(String(200), nullable=False)
    pr_type: Mapped[str] = mapped_column(String(20), nullable=False, default="weight")
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    value_kg: Mapped[float] = mapped_column(Float, nullable=False)
    previous_value_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True
    )
    achieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_personal_records_user_id", "user_id"),
        Index("ix_personal_records_user_exercise", "user_id", "exercise_name"),
    )
