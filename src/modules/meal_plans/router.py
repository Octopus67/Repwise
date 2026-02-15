"""Meal plan API routes."""

import logging
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.meal_plans.schemas import (
    DuplicatePlanRequest,
    GeneratePlanRequest,
    GeneratedPlanResponse,
    DayPlanResponse,
    MacroSummaryResponse,
    MealAssignmentResponse,
    MealPlanResponse,
    SavePlanRequest,
    ScaleRecipeRequest,
    ScaledIngredientResponse,
    ScaledRecipeResponse,
    ShoppingItemResponse,
    ShoppingListResponse,
)
from src.modules.meal_plans.service import MealPlanService
from src.shared.errors import ValidationError
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> MealPlanService:
    return MealPlanService(db)


@router.post("/generate", response_model=GeneratedPlanResponse)
async def generate_plan(
    body: GeneratePlanRequest,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> GeneratedPlanResponse:
    """Generate a new meal plan from adaptive targets."""
    try:
        plan = await service.generate_plan(user.id, body.slot_splits, body.num_days)
    except ValueError as e:
        raise ValidationError(str(e))

    return GeneratedPlanResponse(
        days=[
            DayPlanResponse(
                day_index=d.day_index,
                assignments=[
                    MealAssignmentResponse(
                        slot=a.slot,
                        food_item_id=a.food_item_id,
                        name=a.name,
                        calories=a.calories,
                        protein_g=a.protein_g,
                        carbs_g=a.carbs_g,
                        fat_g=a.fat_g,
                        scale_factor=a.scale_factor,
                        is_recipe=a.is_recipe,
                    )
                    for a in d.assignments
                ],
                unfilled_slots=d.unfilled_slots,
                summary=MacroSummaryResponse(
                    calories=plan.daily_macro_summaries[d.day_index].calories,
                    protein_g=plan.daily_macro_summaries[d.day_index].protein_g,
                    carbs_g=plan.daily_macro_summaries[d.day_index].carbs_g,
                    fat_g=plan.daily_macro_summaries[d.day_index].fat_g,
                ),
            )
            for d in plan.days
        ],
        daily_macro_summaries=[
            MacroSummaryResponse(
                calories=s.calories,
                protein_g=s.protein_g,
                carbs_g=s.carbs_g,
                fat_g=s.fat_g,
            )
            for s in plan.daily_macro_summaries
        ],
        weekly_macro_summary=MacroSummaryResponse(
            calories=plan.weekly_macro_summary.calories,
            protein_g=plan.weekly_macro_summary.protein_g,
            carbs_g=plan.weekly_macro_summary.carbs_g,
            fat_g=plan.weekly_macro_summary.fat_g,
        ),
    )


@router.post("/save", response_model=MealPlanResponse, status_code=201)
async def save_plan(
    body: SavePlanRequest,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> MealPlanResponse:
    """Save a generated plan."""
    plan_data = {"days": [d.model_dump() for d in body.days]}
    plan = await service.save_plan(
        user.id, plan_data, body.name, body.start_date, body.slot_splits
    )
    return MealPlanResponse.model_validate(plan)


@router.get("", response_model=PaginatedResult[MealPlanResponse])
async def list_plans(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> PaginatedResult[MealPlanResponse]:
    """List saved meal plans (paginated)."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.list_plans(user.id, pagination)
    return PaginatedResult(
        items=[MealPlanResponse.model_validate(p) for p in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/{plan_id}", response_model=MealPlanResponse)
async def get_plan(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> MealPlanResponse:
    """Get a saved plan with items."""
    plan = await service.get_plan(user.id, plan_id)
    return MealPlanResponse.model_validate(plan)


@router.post("/{plan_id}/duplicate", response_model=MealPlanResponse, status_code=201)
async def duplicate_plan(
    plan_id: uuid.UUID,
    body: DuplicatePlanRequest,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> MealPlanResponse:
    """Duplicate a plan with a new start date."""
    plan = await service.duplicate_plan(user.id, plan_id, body.new_start_date)
    return MealPlanResponse.model_validate(plan)


@router.delete("/{plan_id}", status_code=204, response_model=None)
async def delete_plan(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> None:
    """Soft-delete a meal plan."""
    await service.delete_plan(user.id, plan_id)


@router.post("/scale-recipe", response_model=ScaledRecipeResponse)
async def scale_recipe(
    body: ScaleRecipeRequest,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> ScaledRecipeResponse:
    """Scale a recipe to a target macro value."""
    try:
        scaled = await service.scale_recipe_endpoint(
            body.recipe_id, body.target_value, body.target_macro
        )
    except ValueError as e:
        raise ValidationError(str(e))

    return ScaledRecipeResponse(
        original_recipe_id=scaled.original_recipe_id,
        scale_factor=scaled.scale_factor,
        ingredients=[
            ScaledIngredientResponse(
                food_item_id=i.food_item_id,
                name=i.name,
                original_quantity=i.original_quantity,
                scaled_quantity=i.scaled_quantity,
                unit=i.unit,
            )
            for i in scaled.ingredients
        ],
        calories=scaled.calories,
        protein_g=scaled.protein_g,
        carbs_g=scaled.carbs_g,
        fat_g=scaled.fat_g,
    )


@router.get("/{plan_id}/shopping-list", response_model=ShoppingListResponse)
async def get_shopping_list(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealPlanService = Depends(_get_service),
) -> ShoppingListResponse:
    """Get consolidated shopping list for a plan."""
    shopping = await service.get_shopping_list(user.id, plan_id)
    return ShoppingListResponse(
        items=[
            ShoppingItemResponse(
                name=i.name, quantity=i.quantity, unit=i.unit, category=i.category
            )
            for i in shopping.items
        ]
    )
