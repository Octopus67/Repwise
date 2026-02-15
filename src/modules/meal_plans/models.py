"""Meal plan SQLAlchemy models."""

import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class MealPlan(SoftDeleteMixin, Base):
    """A saved weekly meal plan with macro summaries."""

    __tablename__ = "meal_plans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    num_days: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    slot_splits: Mapped[dict] = mapped_column(JSONB, nullable=False)
    weekly_calories: Mapped[float] = mapped_column(Float, nullable=False)
    weekly_protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    weekly_carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    weekly_fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    items: Mapped[list["MealPlanItem"]] = relationship(
        "MealPlanItem",
        back_populates="plan",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_meal_plans_user_id", "user_id"),)


class MealPlanItem(Base):
    """A single food assignment within a meal plan."""

    __tablename__ = "meal_plan_items"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False
    )
    day_index: Mapped[int] = mapped_column(Integer, nullable=False)
    slot: Mapped[str] = mapped_column(String(20), nullable=False)
    food_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False
    )
    scale_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    plan: Mapped["MealPlan"] = relationship("MealPlan", back_populates="items")

    __table_args__ = (Index("ix_meal_plan_items_plan_id", "plan_id"),)
