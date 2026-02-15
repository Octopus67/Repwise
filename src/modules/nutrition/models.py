"""SQLAlchemy model for nutrition entries."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date

from sqlalchemy import Date, Float, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class NutritionEntry(Base, SoftDeleteMixin, AuditLogMixin):
    """A single nutrition log entry for a user.

    Stores macro-nutrient values as relational columns and micro-nutrients
    in an extensible JSONB column so new fields can be added without
    schema migration (Requirement 3.6).
    """

    __tablename__ = "nutrition_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    meal_name: Mapped[str] = mapped_column(String(255))
    calories: Mapped[float] = mapped_column(Float)
    protein_g: Mapped[float] = mapped_column(Float)
    carbs_g: Mapped[float] = mapped_column(Float)
    fat_g: Mapped[float] = mapped_column(Float)
    micro_nutrients: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        server_default=text("NULL"),
    )
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    source_meal_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)

    __table_args__ = (
        # Composite index for querying a user's entries by date (descending)
        Index("ix_nutrition_entries_user_date", "user_id", entry_date.desc()),
        # Partial index on deleted_at for fast soft-delete filtering
        Index(
            "ix_nutrition_entries_not_deleted",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
