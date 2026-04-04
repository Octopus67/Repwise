"""Food database routes — search, get, barcode lookup, recipe detail, and admin CRUD."""

import logging
import uuid

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.authorize import require_role
from src.modules.auth.models import User
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.food_database.barcode_service import BarcodeService
from typing import Optional

logger = logging.getLogger(__name__)

from src.modules.food_database.schemas import (
    BarcodeResponse,
    FoodItemCreate,
    FoodItemResponse,
    FoodItemUpdate,
    RecipeCreateRequest,
    RecipeDetailResponse,
    RecipeUpdateRequest,
)
from src.modules.food_database.service import FoodDatabaseService
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import UserRole

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> FoodDatabaseService:
    return FoodDatabaseService(db)


# ---------------------------------------------------------------------------
# Public endpoints (authenticated)
# ---------------------------------------------------------------------------


@router.get("/search", response_model=PaginatedResult[FoodItemResponse])
async def search_food_items(
    q: str = Query(default="", max_length=200, description="Search query for food item name"),
    category: Optional[str] = Query(default=None, max_length=100),
    region: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> PaginatedResult[FoodItemResponse]:
    """Search food items by name with optional category/region filters."""
    check_user_endpoint_rate_limit(str(user.id), "food_search", 30, 60)
    # Guard against empty queries
    if not q or not q.strip():
        return PaginatedResult(
            items=[],
            total_count=0,
            page=page,
            limit=limit,
        )
    
    # Load user Food DNA preferences for search personalization
    from src.modules.user.models import UserProfile
    from sqlalchemy import select as sa_select
    user_prefs = None
    try:
        db = service.db
        stmt = sa_select(UserProfile.preferences).where(UserProfile.user_id == user.id)
        result_prefs = await db.execute(stmt)
        row = result_prefs.scalar_one_or_none()
        if row:
            user_prefs = row
    except (SQLAlchemyError, AttributeError):
        logger.warning("Failed to load user preferences for food search", exc_info=True)

    pagination = PaginationParams(page=page, limit=limit)
    result = await service.search(q, pagination, category=category, region=region, user_prefs=user_prefs, user_id=user.id)
    return PaginatedResult(
        items=[FoodItemResponse.model_validate(item) for item in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/recipes", response_model=PaginatedResult[FoodItemResponse])
async def list_user_recipes(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> PaginatedResult[FoodItemResponse]:
    """List the current user's recipes, paginated."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.list_user_recipes(user.id, pagination)
    return PaginatedResult(
        items=[FoodItemResponse.model_validate(item) for item in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
async def get_recipe(
    recipe_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> RecipeDetailResponse:
    """Get a recipe with ingredients and aggregated nutritional values."""
    return await service.get_recipe(recipe_id, user_id=user.id)


@router.post("/recipes", response_model=RecipeDetailResponse, status_code=201)
async def create_recipe(
    data: RecipeCreateRequest,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> RecipeDetailResponse:
    """Create a new recipe from ingredients. Auth required."""
    recipe = await service.create_recipe(
        user_id=user.id,
        name=data.name,
        description=data.description,
        total_servings=data.total_servings,
        ingredients=data.ingredients,
    )
    return await service.get_recipe(recipe.id, user_id=user.id)


@router.put("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
async def update_recipe(
    recipe_id: uuid.UUID,
    data: RecipeUpdateRequest,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> RecipeDetailResponse:
    """Update a recipe. Owner only. Recomputes nutrition on change."""
    await service.update_recipe(
        user_id=user.id,
        recipe_id=recipe_id,
        name=data.name,
        description=data.description,
        total_servings=data.total_servings,
        ingredients=data.ingredients,
    )
    return await service.get_recipe(recipe_id, user_id=user.id)


@router.delete("/recipes/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> None:
    """Soft-delete a recipe. Owner only."""
    await service.delete_recipe(user_id=user.id, recipe_id=recipe_id)


@router.get("/barcode/{barcode}", response_model=BarcodeResponse)
async def lookup_barcode(
    barcode: str = Path(..., pattern=r'^[0-9]{8,14}$', description="Product barcode (8-14 digits)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BarcodeResponse:
    """Look up a food item by barcode. Cache-first with OFF → USDA fallback."""
    service = BarcodeService(db)
    return await service.lookup_barcode(barcode, user_id=str(user.id))


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


@router.post("/favorites/{food_item_id}/toggle")
async def toggle_favorite(
    food_item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> dict:
    """Toggle a food item as favorite. Returns new state."""
    is_fav = await service.toggle_favorite(user.id, food_item_id)
    return {"is_favorite": is_fav}


@router.get("/favorites", response_model=list[FoodItemResponse])
async def get_favorites(
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> list[FoodItemResponse]:
    """Return user's favorite food items ordered by frequency."""
    items = await service.get_favorites(user.id, limit)
    return [FoodItemResponse.model_validate(item) for item in items]


@router.get("/{food_item_id}", response_model=FoodItemResponse)
async def get_food_item(
    food_item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> FoodItemResponse:
    """Get a single food item by ID."""
    item = await service.get_by_id(food_item_id, user_id=user.id)
    return FoodItemResponse.model_validate(item)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=FoodItemResponse, status_code=201)
async def create_food_item(
    data: FoodItemCreate,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: FoodDatabaseService = Depends(_get_service),
) -> FoodItemResponse:
    """Create a new food item (admin only)."""
    item = await service.create_food_item(data)
    return FoodItemResponse.model_validate(item)


@router.put("/{food_item_id}", response_model=FoodItemResponse)
async def update_food_item(
    food_item_id: uuid.UUID,
    data: FoodItemUpdate,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: FoodDatabaseService = Depends(_get_service),
) -> FoodItemResponse:
    """Update an existing food item (admin only)."""
    item = await service.update_food_item(food_item_id, data)
    return FoodItemResponse.model_validate(item)
