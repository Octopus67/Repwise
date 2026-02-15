"""Training analytics and previous-performance routes."""

from __future__ import annotations
from typing import Optional

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.training.analytics_schemas import (
    MuscleGroupFrequency,
    PreviousPerformance,
    StrengthProgressionPoint,
    VolumeTrendPoint,
)
from src.modules.training.analytics_service import TrainingAnalyticsService

router = APIRouter()


def _validate_date_range(start_date: date, end_date: date) -> None:
    """Raise 400 if start_date is after end_date."""
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be less than or equal to end_date",
        )


@router.get("/analytics/volume", response_model=list[VolumeTrendPoint])
async def get_volume_trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    muscle_group: Optional[str] = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VolumeTrendPoint]:
    """Return daily training volume over a date range."""
    _validate_date_range(start_date, end_date)
    service = TrainingAnalyticsService(db)
    return await service.get_volume_trend(
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
        muscle_group=muscle_group,
    )


@router.get(
    "/analytics/strength/{exercise_name}",
    response_model=list[StrengthProgressionPoint],
)
async def get_strength_progression(
    exercise_name: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StrengthProgressionPoint]:
    """Return strength progression for a specific exercise."""
    _validate_date_range(start_date, end_date)
    service = TrainingAnalyticsService(db)
    return await service.get_strength_progression(
        user_id=user.id,
        exercise_name=exercise_name,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/analytics/muscle-frequency", response_model=list[MuscleGroupFrequency])
async def get_muscle_group_frequency(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MuscleGroupFrequency]:
    """Return muscle group training frequency per ISO week."""
    _validate_date_range(start_date, end_date)
    service = TrainingAnalyticsService(db)
    return await service.get_muscle_group_frequency(
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/previous-performance/{exercise_name}",
    response_model=Optional[PreviousPerformance],
)
async def get_previous_performance(
    exercise_name: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[PreviousPerformance]:
    """Return the most recent performance data for an exercise."""
    from src.modules.training.previous_performance import PreviousPerformanceResolver

    resolver = PreviousPerformanceResolver(db)
    return await resolver.get_previous_performance(
        user_id=user.id,
        exercise_name=exercise_name,
    )
