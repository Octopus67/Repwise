"""Training analytics and previous-performance routes."""

from __future__ import annotations
from typing import List, Optional

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.auth.models import User
from src.modules.training.analytics_schemas import (
    E1RMHistoryPoint,
    MuscleGroupFrequency,
    PreviousPerformance,
    StrengthProgressionPoint,
    StrengthStandardsResponse,
    VolumeTrendPoint,
)
from src.modules.training.analytics_service import TrainingAnalyticsService
from src.modules.training.schemas import (
    BatchPreviousPerformanceRequest,
    BatchPreviousPerformanceResponse,
    PRHistoryResponse,
)

router = APIRouter()


def _validate_date_range(start_date: date, end_date: date) -> None:
    """Raise 400 if start_date is after end_date."""
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be less than or equal to end_date",
        )


@router.get("/analytics/volume-trend", response_model=list[VolumeTrendPoint])
async def get_volume_trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    muscle_group: Optional[str] = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VolumeTrendPoint]:
    """Return daily training volume over a date range."""
    _validate_date_range(start_date, end_date)
    await check_user_endpoint_rate_limit(str(user.id), "training_analytics", 20, 60)
    service = TrainingAnalyticsService(db)
    return await service.get_volume_trend(
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
        muscle_group=muscle_group,
    )


@router.get(
    "/analytics/strength-progression",
    response_model=list[StrengthProgressionPoint],
)
async def get_strength_progression(
    exercise_name: str = Query(..., max_length=200),
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StrengthProgressionPoint]:
    """Return strength progression for a specific exercise."""
    _validate_date_range(start_date, end_date)
    await check_user_endpoint_rate_limit(str(user.id), "training_analytics", 20, 60)
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
    await check_user_endpoint_rate_limit(str(user.id), "training_analytics", 20, 60)
    service = TrainingAnalyticsService(db)
    return await service.get_muscle_group_frequency(
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/previous-performance",
    response_model=Optional[PreviousPerformance],
)
async def get_previous_performance(
    exercise_name: str = Query(..., max_length=200),
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


# ─── E1RM & Strength Standards ────────────────────────────────────────────────


@router.get("/analytics/e1rm-history", response_model=List[E1RMHistoryPoint])
async def get_e1rm_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    exercise_name: str = Query(..., max_length=200),
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> list[E1RMHistoryPoint]:
    """Get e1RM trend for a specific exercise over a date range."""
    _validate_date_range(start_date, end_date)
    service = TrainingAnalyticsService(db)
    return await service.get_e1rm_history(user.id, exercise_name, start_date, end_date)


@router.get("/analytics/strength-standards", response_model=StrengthStandardsResponse)
async def get_strength_standards(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StrengthStandardsResponse:
    """Get strength classification and milestones for all supported lifts."""
    service = TrainingAnalyticsService(db)
    return await service.get_strength_standards(user.id)


# ─── Personal Records ────────────────────────────────────────────────────────


@router.get("/personal-records", response_model=List[PRHistoryResponse])
async def get_personal_records(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    exercise_name: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[PRHistoryResponse]:
    """Return paginated PR history, optionally filtered by exercise name."""
    from src.modules.training.models import PersonalRecord as PRModel, TrainingSession

    stmt = (
        select(PRModel)
        .join(TrainingSession, PRModel.session_id == TrainingSession.id)
        .where(PRModel.user_id == user.id, TrainingSession.deleted_at.is_(None))
    )
    if exercise_name is not None:
        stmt = stmt.where(PRModel.exercise_name == exercise_name)
    stmt = stmt.order_by(PRModel.achieved_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return [PRHistoryResponse.model_validate(row) for row in result.scalars().all()]


# ─── Batch Previous Performance ───────────────────────────────────────────────


@router.post(
    "/previous-performance/batch",
    response_model=BatchPreviousPerformanceResponse,
)
async def get_batch_previous_performance(
    data: BatchPreviousPerformanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BatchPreviousPerformanceResponse:
    """Get previous performance for multiple exercises in a single request."""
    from src.modules.training.previous_performance import BatchPreviousPerformanceResolver

    resolver = BatchPreviousPerformanceResolver(db)
    results = await resolver.get_batch_previous_performance(user.id, data.exercise_names)
    return BatchPreviousPerformanceResponse(results=results)
