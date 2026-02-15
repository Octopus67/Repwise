"""Food database SQLAlchemy models."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Float, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class FoodItem(SoftDeleteMixin, Base):
    """A food item with macro and micro-nutrient profiles.

    Supports both individual food items and recipes (is_recipe=True).
    Nutritional data is stored in relational columns for macros and
    an extensible JSONB column for micro-nutrients (Requirement 5.6).
    """

    __tablename__ = "food_items"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False, default="IN")
    serving_size: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    serving_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="g")
    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)
    micro_nutrients: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default=text("NULL")
    )
    is_recipe: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Competitive-parity-v1 columns (Req 8.1.1, 8.1.5) ──
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="community", index=True
    )  # valid: usda, verified, community, custom
    barcode: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, unique=True, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_servings: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, default=1.0
    )  # only meaningful when is_recipe=True

    # Owner tracking for user-created recipes
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationship to recipe ingredients (only populated when is_recipe=True)
    ingredients: Mapped[list[RecipeIngredient]] = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        foreign_keys="RecipeIngredient.recipe_id",
        lazy="selectin",
    )

    __table_args__ = (
        # GIN index for fuzzy text search on name (pg_trgm)
        Index("ix_food_items_name_gin", "name", postgresql_using="gin",
              postgresql_ops={"name": "gin_trgm_ops"}),
        # B-tree index for filtered browsing by region and category
        Index("ix_food_items_region_category", "region", "category"),
    )


class RecipeIngredient(Base):
    """Links a recipe (FoodItem with is_recipe=True) to its ingredient food items.

    Stores the quantity and unit for each ingredient so nutritional values
    can be aggregated by scaling each ingredient's per-serving values.
    """

    __tablename__ = "recipe_ingredients"

    recipe_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False
    )
    food_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="g")

    # Relationships
    recipe: Mapped[FoodItem] = relationship(
        "FoodItem",
        back_populates="ingredients",
        foreign_keys=[recipe_id],
    )
    food_item: Mapped[FoodItem] = relationship(
        "FoodItem",
        foreign_keys=[food_item_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_recipe_ingredients_recipe_id", "recipe_id"),
    )


class BarcodeCache(Base):
    """Cache for barcode lookup results from external APIs (OFF, USDA).

    Ephemeral cache — no soft-delete needed. Entries are keyed by barcode
    and store the raw API response for debugging / re-parsing.
    """

    __tablename__ = "barcode_cache"

    barcode: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    food_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False
    )
    source_api: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "off" or "usda"
    raw_response: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Override Base timestamps with plain Python defaults (no server_default
    # needed for a cache table — keeps SQLite happy without patching).
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
