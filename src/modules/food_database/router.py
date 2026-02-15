"""Food database routes — search, get, barcode lookup, recipe detail, and admin CRUD."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.authorize import require_role
from src.modules.auth.models import User
from src.modules.food_database.barcode_service import BarcodeService
from typing import Optional

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

# Barcode format: 8-14 digits (EAN-8, EAN-13, UPC-A, UPC-E)
_BARCODE_RE = re.compile(r"^\d{8,14}$")


def _get_service(db: AsyncSession = Depends(get_db)) -> FoodDatabaseService:
    return FoodDatabaseService(db)


# ---------------------------------------------------------------------------
# Public endpoints (authenticated)
# ---------------------------------------------------------------------------


@router.get("/search", response_model=PaginatedResult[FoodItemResponse])
async def search_food_items(
    q: str = Query(default="", description="Search query for food item name"),
    category: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> PaginatedResult[FoodItemResponse]:
    """Search food items by name with optional category/region filters."""
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
    except Exception:
        pass  # Graceful degradation — search works without personalization

    pagination = PaginationParams(page=page, limit=limit)
    result = await service.search(q, pagination, category=category, region=region, user_prefs=user_prefs)
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
    return await service.get_recipe(recipe_id)


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
    return await service.get_recipe(recipe.id)


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
    return await service.get_recipe(recipe_id)


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
    barcode: str = Path(..., description="Product barcode (8-14 digits)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BarcodeResponse:
    """Look up a food item by barcode. Cache-first with OFF → USDA fallback."""
    if not _BARCODE_RE.match(barcode):
        raise HTTPException(
            status_code=422,
            detail="Invalid barcode format. Expected 8-14 digits.",
        )
    service = BarcodeService(db)
    return await service.lookup_barcode(barcode)


@router.get("/{food_item_id}", response_model=FoodItemResponse)
async def get_food_item(
    food_item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: FoodDatabaseService = Depends(_get_service),
) -> FoodItemResponse:
    """Get a single food item by ID."""
    item = await service.get_by_id(food_item_id)
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
