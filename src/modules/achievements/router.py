"""Achievement routes — read-only endpoints for achievement state."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.achievements.schemas import (
    AchievementWithStatus,
    StreakResponse,
    UserAchievementResponse,
)
from src.modules.achievements.service import AchievementService
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> AchievementService:
    return AchievementService(db)


@router.get("/", response_model=List[AchievementWithStatus])
async def get_all_achievements(
    user: User = Depends(get_current_user),
    service: AchievementService = Depends(_get_service),
) -> List[AchievementWithStatus]:
    """Return all achievement definitions with the user's unlock status and progress."""
    return await service.get_all_achievements(user_id=user.id)


@router.get("/unlocked", response_model=PaginatedResult[UserAchievementResponse])
async def get_unlocked_achievements(
    user: User = Depends(get_current_user),
    service: AchievementService = Depends(_get_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[UserAchievementResponse]:
    """Return only the user's unlocked achievements, paginated."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_unlocked_achievements(user_id=user.id, pagination=pagination)


@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    user: User = Depends(get_current_user),
    service: AchievementService = Depends(_get_service),
) -> StreakResponse:
    """Return the user's current and longest streak counts."""
    return await service.get_streak(user_id=user.id)
