"""Achievement routes — read-only endpoints for achievement state."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.achievements.engine import AchievementEngine
from src.modules.achievements.schemas import (
    AchievementWithStatus,
    ManualFreezeRequest,
    ManualFreezeResponse,
    StreakFreezeRecord,
    StreakFreezeStatusResponse,
    StreakResponse,
    UserAchievementResponse,
)
from src.modules.achievements.service import AchievementService
from src.modules.achievements import streak_freeze_service
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> AchievementService:
    return AchievementService(db)


@router.get("", response_model=List[AchievementWithStatus])
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


@router.get("/streak/freezes", response_model=StreakFreezeStatusResponse)
async def get_streak_freezes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreakFreezeStatusResponse:
    """Return freeze availability and history for the current user."""
    month_str = date.today().strftime("%Y-%m")
    available = await streak_freeze_service.get_available_freezes(db, user.id, month_str)
    history = await streak_freeze_service.get_freeze_history(db, user.id)
    used_this_month = sum(1 for f in history if f.month == month_str)
    return StreakFreezeStatusResponse(
        available=available,
        used_this_month=used_this_month,
        history=[
            StreakFreezeRecord(
                id=str(f.id),
                freeze_date=f.freeze_date.isoformat(),
                month=f.month,
                used_at=f.used_at,
            )
            for f in history
        ],
    )


@router.post("/streak/freeze", response_model=ManualFreezeResponse)
async def manual_freeze(
    body: ManualFreezeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ManualFreezeResponse:
    """Manually freeze a specific date."""
    from sqlalchemy.exc import IntegrityError

    from src.modules.achievements.models import StreakFreeze

    try:
        freeze_date = date.fromisoformat(body.date)
    except ValueError:
        return ManualFreezeResponse(success=False, message="Invalid date format. Use YYYY-MM-DD.")

    if freeze_date > date.today():
        return ManualFreezeResponse(success=False, message="Cannot freeze future dates.")

    if freeze_date < date.today() - timedelta(days=7):
        return ManualFreezeResponse(success=False, message="Cannot freeze dates older than 7 days.")

    month_str = freeze_date.strftime("%Y-%m")
    available = await streak_freeze_service.get_available_freezes(db, user.id, month_str)
    if available < 1:
        return ManualFreezeResponse(success=False, message="No freezes available for this month.")

    freeze = StreakFreeze(user_id=user.id, freeze_date=freeze_date, month=month_str, used_at=datetime.utcnow())
    try:
        db.add(freeze)
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return ManualFreezeResponse(success=False, message="This date is already frozen.")

    # Recalculate streak with the new freeze
    try:
        engine = AchievementEngine(db)
        await engine.recalculate_streak(user.id)
    except (SQLAlchemyError, ValueError):
        import logging
        logging.getLogger(__name__).exception("recalculate_streak failed for user %s", user.id)

    return ManualFreezeResponse(
        success=True,
        freeze=StreakFreezeRecord(
            id=str(freeze.id),
            freeze_date=freeze.freeze_date.isoformat(),
            month=freeze.month,
            used_at=freeze.used_at,
        ),
        message="Freeze applied successfully.",
    )


@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    user: User = Depends(get_current_user),
    service: AchievementService = Depends(_get_service),
) -> StreakResponse:
    """Return the user's current and longest streak counts."""
    return await service.get_streak(user_id=user.id)
