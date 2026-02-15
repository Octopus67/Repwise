"""Nutrition entry routes — CRUD with JWT authentication."""

from __future__ import annotations
from typing import List, Optional

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.nutrition.schemas import (
    BatchEntryCreate,
    CopyEntriesRequest,
    DateRangeFilter,
    NutritionEntryCreate,
    NutritionEntryResponse,
    NutritionEntryUpdate,
)
from src.modules.nutrition.service import NutritionService
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> NutritionService:
    return NutritionService(db)


@router.post("/entries", response_model=NutritionEntryResponse, status_code=201)
async def create_entry(
    data: NutritionEntryCreate,
    user: User = Depends(get_current_user),
    service: NutritionService = Depends(_get_service),
) -> NutritionEntryResponse:
    """Create a new nutrition entry for the authenticated user."""
    entry = await service.create_entry(user_id=user.id, data=data)
    resp = NutritionEntryResponse.model_validate(entry)
    # Attach achievement unlocks if present
    raw_unlocks = getattr(entry, "_newly_unlocked", [])
    if raw_unlocks:
        from src.modules.nutrition.schemas import NewlyUnlockedAchievement

        resp.newly_unlocked = [
            NewlyUnlockedAchievement(
                achievement_id=u.achievement_id,
                title=u.title,
                description=u.description,
                icon=u.icon,
                category=u.category,
            )
            for u in raw_unlocks
        ]
    return resp


@router.get("/entries", response_model=PaginatedResult[NutritionEntryResponse])
async def get_entries(
    user: User = Depends(get_current_user),
    service: NutritionService = Depends(_get_service),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[NutritionEntryResponse]:
    """Get nutrition entries with optional date range filter and pagination."""
    filters = None
    if start_date and end_date:
        filters = DateRangeFilter(start_date=start_date, end_date=end_date)
    elif start_date:
        filters = DateRangeFilter(start_date=start_date, end_date=start_date)
    elif end_date:
        filters = DateRangeFilter(start_date=end_date, end_date=end_date)

    pagination = PaginationParams(page=page, limit=limit)
    result = await service.get_entries(
        user_id=user.id, filters=filters, pagination=pagination
    )

    return PaginatedResult[NutritionEntryResponse](
        items=[NutritionEntryResponse.model_validate(e) for e in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.put("/entries/{entry_id}", response_model=NutritionEntryResponse)
async def update_entry(
    entry_id: uuid.UUID,
    data: NutritionEntryUpdate,
    user: User = Depends(get_current_user),
    service: NutritionService = Depends(_get_service),
) -> NutritionEntryResponse:
    """Update an existing nutrition entry."""
    entry = await service.update_entry(user_id=user.id, entry_id=entry_id, data=data)
    return NutritionEntryResponse.model_validate(entry)


@router.delete("/entries/{entry_id}", status_code=204, response_model=None)
async def delete_entry(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: NutritionService = Depends(_get_service),
) -> None:
    """Soft-delete a nutrition entry."""
    await service.soft_delete_entry(user_id=user.id, entry_id=entry_id)


@router.post("/entries/batch", response_model=List[NutritionEntryResponse], status_code=201)
async def create_entries_batch(
    data: BatchEntryCreate,
    user: User = Depends(get_current_user),
    service: NutritionService = Depends(_get_service),
) -> list[NutritionEntryResponse]:
    """Atomically create multiple nutrition entries as a meal batch."""
    entries = await service.create_entries_batch(user_id=user.id, data=data)
    return [NutritionEntryResponse.model_validate(e) for e in entries]


@router.post("/entries/copy", response_model=List[NutritionEntryResponse], status_code=201)
async def copy_entries(
    data: CopyEntriesRequest,
    user: User = Depends(get_current_user),
    service: NutritionService = Depends(_get_service),
) -> list[NutritionEntryResponse]:
    """Copy all entries from source_date to target_date."""
    entries = await service.copy_entries_from_date(
        user_id=user.id,
        source_date=data.source_date,
        target_date=data.target_date,
    )
    return [NutritionEntryResponse.model_validate(e) for e in entries]
