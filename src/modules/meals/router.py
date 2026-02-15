"""Meal library routes — custom meals and favorites CRUD + pre-fill endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.meals.schemas import (
    CustomMealCreate,
    CustomMealResponse,
    CustomMealUpdate,
    MealFavoriteCreate,
    MealFavoriteResponse,
    NutritionEntryPreFill,
)
from src.modules.meals.service import MealService
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_meal_service(db: AsyncSession = Depends(get_db)) -> MealService:
    return MealService(db)


# ---------------------------------------------------------------------------
# Custom Meals
# ---------------------------------------------------------------------------


@router.post("/custom", response_model=CustomMealResponse, status_code=201)
async def create_custom_meal(
    data: CustomMealCreate,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> CustomMealResponse:
    """Create a new custom meal for the authenticated user."""
    meal = await service.create_custom_meal(user.id, data)
    return CustomMealResponse.model_validate(meal)


@router.get("/custom", response_model=PaginatedResult[CustomMealResponse])
async def list_custom_meals(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> PaginatedResult[CustomMealResponse]:
    """List the authenticated user's custom meals (paginated)."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.get_custom_meals(user.id, pagination)
    return PaginatedResult(
        items=[CustomMealResponse.model_validate(m) for m in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.put("/custom/{meal_id}", response_model=CustomMealResponse)
async def update_custom_meal(
    meal_id: uuid.UUID,
    data: CustomMealUpdate,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> CustomMealResponse:
    """Update an existing custom meal definition."""
    meal = await service.update_custom_meal(user.id, meal_id, data)
    return CustomMealResponse.model_validate(meal)


@router.delete("/custom/{meal_id}", status_code=204, response_model=None)
async def delete_custom_meal(
    meal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> None:
    """Soft-delete a custom meal."""
    await service.delete_custom_meal(user.id, meal_id)


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


@router.post("/favorites", response_model=MealFavoriteResponse, status_code=201)
async def add_favorite(
    data: MealFavoriteCreate,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> MealFavoriteResponse:
    """Add a meal to the user's favorites."""
    favorite = await service.add_favorite(user.id, data)
    return MealFavoriteResponse.model_validate(favorite)


@router.get("/favorites", response_model=PaginatedResult[MealFavoriteResponse])
async def list_favorites(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> PaginatedResult[MealFavoriteResponse]:
    """List the authenticated user's meal favorites (paginated)."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.get_favorites(user.id, pagination)
    return PaginatedResult(
        items=[MealFavoriteResponse.model_validate(f) for f in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.delete("/favorites/{favorite_id}", status_code=204, response_model=None)
async def remove_favorite(
    favorite_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> None:
    """Remove a meal from the user's favorites."""
    await service.remove_favorite(user.id, favorite_id)


# ---------------------------------------------------------------------------
# Pre-fill
# ---------------------------------------------------------------------------


@router.get("/custom/{meal_id}/prefill", response_model=NutritionEntryPreFill)
async def prefill_from_custom_meal(
    meal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> NutritionEntryPreFill:
    """Get pre-fill data from a custom meal for nutrition logging."""
    return await service.prefill_from_custom_meal(user.id, meal_id)


@router.get("/favorites/{favorite_id}/prefill", response_model=NutritionEntryPreFill)
async def prefill_from_favorite(
    favorite_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MealService = Depends(_get_meal_service),
) -> NutritionEntryPreFill:
    """Get pre-fill data from a favorite for nutrition logging."""
    return await service.prefill_from_favorite(user.id, favorite_id)
