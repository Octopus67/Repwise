"""Meal plan service — orchestration + persistence."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.food_database.models import FoodItem, RecipeIngredient
from src.modules.meal_plans.generator import (
    FoodCandidate,
    GeneratedPlan,
    MacroSummary,
    generate_plan,
)
from src.modules.meal_plans.models import MealPlan, MealPlanItem
from src.modules.meal_plans.scaler import IngredientInput, scale_recipe
from src.modules.meal_plans.shopping import (
    IngredientEntry,
    ShoppingList,
    consolidate_ingredients,
)
from src.modules.meals.models import MealFavorite
from src.shared.errors import NotFoundError, ValidationError
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)


class MealPlanService:
    """Manages meal plan generation, persistence, scaling, and shopping lists."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Generate
    # ------------------------------------------------------------------

    async def generate_plan(
        self,
        user_id: uuid.UUID,
        slot_splits: Optional[dict[str, float]] = None,
        num_days: int = 5,
    ) -> GeneratedPlan:
        """Generate a meal plan from adaptive targets and available candidates."""
        if num_days < 1 or num_days > 14:
            raise ValidationError(f"num_days must be between 1 and 14, got {num_days}")

        # Validate slot_splits if provided
        if slot_splits is not None:
            for key, val in slot_splits.items():
                if val < 0:
                    raise ValidationError(f"Slot split for '{key}' must be non-negative, got {val}")

        # Fetch latest adaptive snapshot
        stmt = (
            select(AdaptiveSnapshot)
            .where(AdaptiveSnapshot.user_id == user_id)
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        snapshot = result.scalar_one_or_none()
        if snapshot is None:
            raise NotFoundError(
                "No macro targets available. Complete an adaptive snapshot first."
            )

        daily_targets = MacroSummary(
            calories=snapshot.target_calories,
            protein_g=snapshot.target_protein_g,
            carbs_g=snapshot.target_carbs_g,
            fat_g=snapshot.target_fat_g,
        )

        candidates = await self._build_candidates(user_id)
        logger.info(
            "Generating meal plan for user %s: %d days, %d candidates",
            user_id, num_days, len(candidates),
        )
        return generate_plan(daily_targets, candidates, slot_splits, num_days)

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    async def save_plan(
        self,
        user_id: uuid.UUID,
        plan_data: dict[str, Any],
        name: str,
        start_date: date,
        slot_splits: Optional[dict[str, float]] = None,
    ) -> MealPlan:
        """Persist a plan from the SavePlanRequest payload."""
        from src.modules.meal_plans.generator import DEFAULT_SLOT_SPLITS

        splits = slot_splits or DEFAULT_SLOT_SPLITS
        days = plan_data.get("days", [])

        # Compute weekly totals
        weekly_cal = weekly_pro = weekly_carb = weekly_fat = 0.0
        items: list[MealPlanItem] = []
        for day in days:
            for a in day.get("assignments", []):
                weekly_cal += a.get("calories", 0)
                weekly_pro += a.get("protein_g", 0)
                weekly_carb += a.get("carbs_g", 0)
                weekly_fat += a.get("fat_g", 0)
                items.append(
                    MealPlanItem(
                        day_index=day["day_index"],
                        slot=a["slot"],
                        food_item_id=a["food_item_id"],
                        scale_factor=a.get("scale_factor", 1.0),
                        calories=a.get("calories", 0),
                        protein_g=a.get("protein_g", 0),
                        carbs_g=a.get("carbs_g", 0),
                        fat_g=a.get("fat_g", 0),
                    )
                )

        plan = MealPlan(
            user_id=user_id,
            name=name,
            start_date=start_date,
            num_days=len(days),
            slot_splits=splits,
            weekly_calories=round(weekly_cal, 2),
            weekly_protein_g=round(weekly_pro, 2),
            weekly_carbs_g=round(weekly_carb, 2),
            weekly_fat_g=round(weekly_fat, 2),
        )
        self.db.add(plan)
        await self.db.flush()

        for item in items:
            item.plan_id = plan.id
            self.db.add(item)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    # ------------------------------------------------------------------
    # Get / List
    # ------------------------------------------------------------------

    async def get_plan(self, user_id: uuid.UUID, plan_id: uuid.UUID) -> MealPlan:
        stmt = (
            select(MealPlan)
            .where(MealPlan.id == plan_id, MealPlan.user_id == user_id)
            .options(selectinload(MealPlan.items))
        )
        stmt = MealPlan.not_deleted(stmt)
        result = await self.db.execute(stmt)
        plan = result.scalar_one_or_none()
        if plan is None:
            raise NotFoundError("Meal plan not found")
        return plan

    async def list_plans(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[Any]:
        base = select(MealPlan).where(MealPlan.user_id == user_id)
        base = MealPlan.not_deleted(base)

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(MealPlan.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.db.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult(
            items=items, total_count=total, page=pagination.page, limit=pagination.limit
        )

    # ------------------------------------------------------------------
    # Duplicate
    # ------------------------------------------------------------------

    async def duplicate_plan(
        self, user_id: uuid.UUID, plan_id: uuid.UUID, new_start_date: date
    ) -> MealPlan:
        original = await self.get_plan(user_id, plan_id)

        new_plan = MealPlan(
            user_id=user_id,
            name=f"{original.name} (copy)",
            start_date=new_start_date,
            num_days=original.num_days,
            slot_splits=original.slot_splits,
            weekly_calories=original.weekly_calories,
            weekly_protein_g=original.weekly_protein_g,
            weekly_carbs_g=original.weekly_carbs_g,
            weekly_fat_g=original.weekly_fat_g,
        )
        self.db.add(new_plan)
        await self.db.flush()

        for item in original.items:
            new_item = MealPlanItem(
                plan_id=new_plan.id,
                day_index=item.day_index,
                slot=item.slot,
                food_item_id=item.food_item_id,
                scale_factor=item.scale_factor,
                calories=item.calories,
                protein_g=item.protein_g,
                carbs_g=item.carbs_g,
                fat_g=item.fat_g,
            )
            self.db.add(new_item)
        await self.db.flush()
        await self.db.refresh(new_plan)
        return new_plan

    # ------------------------------------------------------------------
    # Delete (soft)
    # ------------------------------------------------------------------

    async def delete_plan(self, user_id: uuid.UUID, plan_id: uuid.UUID) -> None:
        plan = await self.get_plan(user_id, plan_id)
        plan.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ------------------------------------------------------------------
    # Scale recipe
    # ------------------------------------------------------------------

    async def scale_recipe_endpoint(
        self, recipe_id: uuid.UUID, target_value: float, target_macro: str
    ):
        """Load recipe from food_database, call scaler."""
        stmt = (
            select(FoodItem)
            .where(FoodItem.id == recipe_id)
            .options(selectinload(FoodItem.ingredients).selectinload(RecipeIngredient.food_item))
        )
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        recipe = result.scalar_one_or_none()
        if recipe is None:
            raise NotFoundError("Recipe not found")

        ingredients = [
            IngredientInput(
                food_item_id=ing.food_item_id,
                name=ing.food_item.name if ing.food_item else "Unknown",
                quantity=ing.quantity,
                unit=ing.unit,
            )
            for ing in (recipe.ingredients or [])
        ]

        return scale_recipe(
            recipe_id=recipe.id,
            recipe_calories=recipe.calories,
            recipe_protein_g=recipe.protein_g,
            recipe_carbs_g=recipe.carbs_g,
            recipe_fat_g=recipe.fat_g,
            ingredients=ingredients,
            target_value=target_value,
            target_macro=target_macro,
        )

    # ------------------------------------------------------------------
    # Shopping list
    # ------------------------------------------------------------------

    async def get_shopping_list(
        self, user_id: uuid.UUID, plan_id: uuid.UUID
    ) -> ShoppingList:
        plan = await self.get_plan(user_id, plan_id)
        all_ingredients: list[IngredientEntry] = []

        for item in plan.items:
            # Load the food item
            stmt = select(FoodItem).where(FoodItem.id == item.food_item_id)
            result = await self.db.execute(stmt)
            food = result.scalar_one_or_none()
            if food is None:
                continue

            if food.is_recipe:
                # Resolve recipe ingredients
                ing_stmt = (
                    select(RecipeIngredient)
                    .where(RecipeIngredient.recipe_id == food.id)
                    .options(selectinload(RecipeIngredient.food_item))
                )
                ing_result = await self.db.execute(ing_stmt)
                for ring in ing_result.scalars().all():
                    if ring.food_item:
                        all_ingredients.append(
                            IngredientEntry(
                                name=ring.food_item.name,
                                quantity=ring.quantity * item.scale_factor,
                                unit=ring.unit,
                                food_category=ring.food_item.category,
                            )
                        )
            else:
                all_ingredients.append(
                    IngredientEntry(
                        name=food.name,
                        quantity=food.serving_size * item.scale_factor,
                        unit=food.serving_unit,
                        food_category=food.category,
                    )
                )

        return consolidate_ingredients(all_ingredients)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _build_candidates(self, user_id: uuid.UUID) -> list[FoodCandidate]:
        """Build candidate pool: favorites (priority 0), then food DB items (priority 2)."""
        candidates: list[FoodCandidate] = []

        # Favorites
        fav_stmt = select(MealFavorite).where(MealFavorite.user_id == user_id).limit(50)
        fav_result = await self.db.execute(fav_stmt)
        for fav in fav_result.scalars().all():
            candidates.append(
                FoodCandidate(
                    food_item_id=fav.food_item_id or fav.meal_id or fav.id,
                    name=fav.name,
                    calories=fav.calories,
                    protein_g=fav.protein_g,
                    carbs_g=fav.carbs_g,
                    fat_g=fav.fat_g,
                    is_recipe=False,
                    source_priority=0,
                )
            )

        # Food database items (top 50 by calorie content)
        food_stmt = (
            select(FoodItem)
            .where(FoodItem.calories > 0)
            .order_by(FoodItem.name)
            .limit(50)
        )
        food_stmt = FoodItem.not_deleted(food_stmt)
        food_result = await self.db.execute(food_stmt)
        for food in food_result.scalars().all():
            candidates.append(
                FoodCandidate(
                    food_item_id=food.id,
                    name=food.name,
                    calories=food.calories,
                    protein_g=food.protein_g,
                    carbs_g=food.carbs_g,
                    fat_g=food.fat_g,
                    is_recipe=food.is_recipe,
                    source_priority=2,
                )
            )

        return candidates
