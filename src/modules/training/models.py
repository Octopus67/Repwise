"""Training module SQLAlchemy models."""

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Date, ForeignKey, Index, String, Text, text
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

    user_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
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
    start_time: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(nullable=True)

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

    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
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
    )


class CustomExercise(SoftDeleteMixin, Base):
    """User-created custom exercises.

    Stores user-specific exercises that appear alongside system exercises
    in the exercise picker and search results (Requirement 13).
    """

    __tablename__ = "custom_exercises"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
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


