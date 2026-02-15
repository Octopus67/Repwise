"""Meal library SQLAlchemy models."""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin
from src.shared.types import MealSourceType
from typing import Optional


class CustomMeal(SoftDeleteMixin, Base):
    """User-created custom meals with macro and micro-nutrient data.

    Users can create reusable meal definitions that can be quickly logged
    as nutrition entries without re-entering all the data.
    """

    __tablename__ = "custom_meals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    calories: Mapped[float] = mapped_column(nullable=False)
    protein_g: Mapped[float] = mapped_column(nullable=False)
    carbs_g: Mapped[float] = mapped_column(nullable=False)
    fat_g: Mapped[float] = mapped_column(nullable=False)
    micro_nutrients: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    source_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=MealSourceType.CUSTOM
    )

    __table_args__ = (
        Index("ix_custom_meals_user_id", "user_id"),
    )


class MealFavorite(Base):
    """User's favorited meals — either custom meals or food database items.

    Stores a snapshot of nutritional data so favorites can be used for
    pre-filling nutrition entries even if the source is later modified.
    """

    __tablename__ = "meal_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    meal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("custom_meals.id", ondelete="SET NULL"), nullable=True
    )
    food_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    calories: Mapped[float] = mapped_column(nullable=False)
    protein_g: Mapped[float] = mapped_column(nullable=False)
    carbs_g: Mapped[float] = mapped_column(nullable=False)
    fat_g: Mapped[float] = mapped_column(nullable=False)
    micro_nutrients: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_meal_favorites_user_id", "user_id"),
    )
