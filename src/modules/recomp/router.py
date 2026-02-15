"""Recomp API router — measurements, metrics, and check-in endpoints."""

from __future__ import annotations
from typing import List, Optional

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.feature_flags.service import FeatureFlagService
from src.modules.recomp.schemas import (
    RecompCheckinResponse,
    RecompMeasurementCreate,
    RecompMeasurementResponse,
    RecompMetricsResponse,
)
from src.modules.recomp.service import RecompService
from src.modules.user.models import UserGoal
from sqlalchemy import select

router = APIRouter()
logger = logging.getLogger(__name__)


async def _check_recomp_guards(user: User, db: AsyncSession) -> None:
    """Feature flag + goal type guard. Raises 403 or 400."""
    ff_service = FeatureFlagService(db)
    if not await ff_service.is_feature_enabled("recomp_mode_enabled", user):
        raise HTTPException(status_code=403, detail="Body recomposition mode is not available")

    stmt = select(UserGoal).where(UserGoal.user_id == user.id)
    result = await db.execute(stmt)
    goal = result.scalar_one_or_none()
    if goal is None or goal.goal_type != "recomposition":
        raise HTTPException(status_code=400, detail="Recomp endpoints require recomposition goal mode")


def _get_service(db: AsyncSession = Depends(get_db)) -> RecompService:
    return RecompService(db)


@router.post("/measurements", response_model=RecompMeasurementResponse, status_code=201)
async def log_measurement(
    data: RecompMeasurementCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: RecompService = Depends(_get_service),
) -> RecompMeasurementResponse:
    await _check_recomp_guards(user, db)
    try:
        entry = await service.log_measurement(user.id, data)
        await db.commit()
        return RecompMeasurementResponse.model_validate(entry)
    except Exception:
        logger.exception("Error logging recomp measurement for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to log measurement")


@router.get("/measurements", response_model=List[RecompMeasurementResponse])
async def get_measurements(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: RecompService = Depends(_get_service),
) -> List[RecompMeasurementResponse]:
    await _check_recomp_guards(user, db)
    entries = await service.get_measurements(user.id, start_date, end_date)
    return [RecompMeasurementResponse.model_validate(e) for e in entries]


@router.get("/metrics", response_model=RecompMetricsResponse)
async def get_metrics(
    lookback_days: int = Query(default=28, ge=7, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: RecompService = Depends(_get_service),
) -> RecompMetricsResponse:
    await _check_recomp_guards(user, db)
    try:
        output = await service.get_recomp_metrics(user.id, lookback_days)
    except Exception:
        logger.exception("Error computing recomp metrics for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to compute metrics")
    return RecompMetricsResponse(
        waist_trend=_trend_to_dict(output.waist_trend),
        arm_trend=_trend_to_dict(output.arm_trend),
        chest_trend=_trend_to_dict(output.chest_trend),
        weight_trend=_trend_to_dict(output.weight_trend),
        muscle_gain_indicator=output.muscle_gain_indicator,
        fat_loss_indicator=output.fat_loss_indicator,
        recomp_score=output.recomp_score,
        has_sufficient_data=output.has_sufficient_data,
    )


@router.get("/checkin", response_model=RecompCheckinResponse)
async def get_checkin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: RecompService = Depends(_get_service),
) -> RecompCheckinResponse:
    await _check_recomp_guards(user, db)
    try:
        output = await service.get_weekly_checkin(user.id)
    except Exception:
        logger.exception("Error computing recomp checkin for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to compute check-in")
    return RecompCheckinResponse(
        recommendation=output.recommendation,
        recomp_score=output.recomp_score,
        suggested_surplus_adjustment=output.suggested_surplus_adjustment,
        suggested_deficit_adjustment=output.suggested_deficit_adjustment,
    )


def _trend_to_dict(trend) -> Optional[dict]:
    if trend is None:
        return None
    return {
        "slope_per_week": trend.slope_per_week,
        "direction": trend.direction,
        "data_points": trend.data_points,
    }
