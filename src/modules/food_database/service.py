"""Food database service — thin facade delegating to focused sub-services."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.favorites_service import FavoritesService
from src.modules.food_database.models import FoodItem
from src.modules.food_database.recipe_service import (
    RecipeService,
    aggregate_recipe_nutrition,
)
from src.modules.food_database.schemas import (
    FoodItemCreate,
    FoodItemUpdate,
    RecipeDetailResponse,
    RecipeIngredientInput,
)
from src.modules.food_database.search_service import SearchService
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams


class FoodDatabaseService:
    """Manages food items, recipes, and nutritional data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._search = SearchService(db)
        self._recipes = RecipeService(db)
        self._favorites = FavoritesService(db)

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    @staticmethod
    def _personalize_results(items: list, user_prefs: dict | None) -> list:
        """Delegate to SearchService for backward compatibility with tests."""
        return SearchService._personalize_results(items, user_prefs)

    async def search(
        self,
        query: str,
        pagination: PaginationParams,
        category: Optional[str] = None,
        region: Optional[str] = None,
        user_prefs: Optional[dict] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> PaginatedResult[Any]:
        """Search food items by name.

        Uses FTS5 on SQLite for fast full-text search (~5ms vs ~3s for LIKE).
        Falls back to LIKE for PostgreSQL or when FTS table doesn't exist.
        When user_id is provided and food_search_ranking flag is enabled,
        applies frequency-based weighted ranking.
        """
        return await self._search.search(query, pagination, category, region, user_prefs, user_id)

    # ------------------------------------------------------------------
    # Favorites
    # ------------------------------------------------------------------

    async def toggle_favorite(self, user_id: uuid.UUID, food_item_id: uuid.UUID) -> bool:
        """Toggle is_favorite on a UserFoodFrequency row. Creates row if missing. Returns new state."""
        return await self._favorites.toggle_favorite(user_id, food_item_id)

    async def get_favorites(self, user_id: uuid.UUID, limit: int = 10) -> list[Any]:
        """Return favorite food items ordered by log_count desc."""
        return await self._favorites.get_favorites(user_id, limit)

    # ------------------------------------------------------------------
    # Get by ID
    # ------------------------------------------------------------------

    async def get_by_id(self, food_item_id: uuid.UUID, user_id: Optional[uuid.UUID] = None, *, allow_any_owner: bool = False) -> FoodItem:
        """Retrieve a single food item by ID."""
        stmt = select(FoodItem).where(FoodItem.id == food_item_id)
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        item = result.scalar_one_or_none()
        if item is None:
            raise NotFoundError("Food item not found")
        if not allow_any_owner and item.created_by is not None and (user_id is None or item.created_by != user_id):
            raise NotFoundError("Food item not found")
        return item

    # ------------------------------------------------------------------
    # Recipe CRUD
    # ------------------------------------------------------------------

    async def create_recipe(
        self,
        user_id: uuid.UUID,
        name: str,
        description: Optional[str],
        total_servings: float,
        ingredients: list[RecipeIngredientInput],
    ) -> FoodItem:
        """Create a recipe as a FoodItem with is_recipe=True.

        1. Create FoodItem(is_recipe=True, source='custom', total_servings)
        2. Create RecipeIngredient rows for each ingredient
        3. Compute aggregate nutrition via aggregate_recipe_nutrition()
        4. Store per-serving macros on FoodItem (denormalized for search)
        """
        return await self._recipes.create_recipe(user_id, name, description, total_servings, ingredients)

    async def list_user_recipes(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
    ) -> PaginatedResult[Any]:
        """List recipes created by this user (FoodItems with is_recipe=True)."""
        return await self._recipes.list_user_recipes(user_id, pagination)

    async def update_recipe(
        self,
        user_id: uuid.UUID,
        recipe_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        total_servings: Optional[float] = None,
        ingredients: Optional[list[RecipeIngredientInput]] = None,
    ) -> FoodItem:
        """Update a recipe's name, description, servings, or ingredients.

        Recomputes nutrition if ingredients or total_servings change.
        Only the recipe owner can update.
        """
        return await self._recipes.update_recipe(user_id, recipe_id, name, description, total_servings, ingredients)

    async def delete_recipe(
        self,
        user_id: uuid.UUID,
        recipe_id: uuid.UUID,
    ) -> None:
        """Soft-delete a recipe. Only the owner can delete."""
        return await self._recipes.delete_recipe(user_id, recipe_id)

    # ------------------------------------------------------------------
    # Recipe with nutritional aggregation
    # ------------------------------------------------------------------

    async def get_recipe(self, recipe_id: uuid.UUID, user_id: uuid.UUID | None = None) -> RecipeDetailResponse:
        """Retrieve a recipe with its ingredients and aggregated nutrition.

        Nutritional aggregation: for each ingredient, scale its per-serving
        nutritional values by (quantity / serving_size), then sum across
        all ingredients (Requirement 5.3).
        """
        return await self._recipes.get_recipe(recipe_id, user_id)

    # ------------------------------------------------------------------
    # Admin CRUD
    # ------------------------------------------------------------------

    async def create_food_item(self, data: FoodItemCreate) -> FoodItem:
        """Create a new food item (admin only)."""
        item = FoodItem(
            name=data.name,
            category=data.category,
            region=data.region,
            serving_size=data.serving_size,
            serving_unit=data.serving_unit,
            calories=data.calories,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
            micro_nutrients=data.micro_nutrients,
            is_recipe=data.is_recipe,
            source="custom",  # Server-enforced: always "custom" for user-created items
            barcode=data.barcode,
            description=data.description,
            total_servings=data.total_servings,
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update_food_item(
        self, food_item_id: uuid.UUID, data: FoodItemUpdate
    ) -> FoodItem:
        """Update an existing food item (admin only)."""
        item = await self.get_by_id(food_item_id, allow_any_owner=True)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        await self.db.flush()
        await self.db.refresh(item)
        return item
