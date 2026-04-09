"""Readiness API router."""

from __future__ import annotations

import logging
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.readiness.readiness_schemas import (
    CheckinRequest,
    CheckinResponse,
    CombinedRecoveryFactorResponse,
    CombinedRecoveryResponse,
    HealthMetricsRequest,
    ReadinessHistoryResponse,
    ReadinessScoreResponse,
)
from src.modules.readiness.readiness_service import ReadinessService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/checkin", response_model=CheckinResponse, status_code=201)
async def submit_checkin(
    data: CheckinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckinResponse:
    service = ReadinessService(db)
    return await service.submit_checkin(user.id, data)


@router.post("/score", response_model=ReadinessScoreResponse)
async def compute_score(
    data: HealthMetricsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadinessScoreResponse:
    service = ReadinessService(db)
    return await service.compute_score(user.id, data)


@router.get("/scores", response_model=List[ReadinessScoreResponse])
async def get_scores(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> List[ReadinessScoreResponse]:
    """Return recent readiness scores. Empty list for new users."""
    from datetime import timedelta

    service = ReadinessService(db)
    end = date.today()
    start = end - timedelta(days=30)
    history = await service.get_history(user.id, start, end)
    return history.items[offset:offset + limit]


@router.get("/history", response_model=ReadinessHistoryResponse)
async def get_history(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadinessHistoryResponse:
    service = ReadinessService(db)
    return await service.get_history(user.id, start_date, end_date)


@router.get("/combined", response_model=CombinedRecoveryResponse)
async def get_combined_recovery(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CombinedRecoveryResponse:
    """Combined fatigue + readiness score with volume multiplier.

    Gated behind the 'combined_readiness' feature flag.
    """
    from src.modules.feature_flags.service import FeatureFlagService

    flag_service = FeatureFlagService(db)
    if not await flag_service.is_feature_enabled("combined_readiness", user):
        from src.shared.errors import NotFoundError
        raise NotFoundError("Combined readiness endpoint not available")

    from src.modules.readiness.readiness_schemas import HealthMetricsRequest
    from src.modules.training.fatigue_service import FatigueService
    from src.modules.readiness.combined_score import compute_combined_recovery

    # Get readiness score (use defaults for health metrics if none provided)
    readiness_service = ReadinessService(db)
    try:
        readiness_resp = await readiness_service.compute_score(
            user.id, HealthMetricsRequest()
        )
        readiness_score = readiness_resp.score
    except (SQLAlchemyError, ValueError):
        readiness_score = None

    # Get fatigue scores
    fatigue_service = FatigueService(db)
    try:
        fatigue_resp = await fatigue_service.analyze_fatigue(user.id)
        fatigue_scores = fatigue_resp.scores
    except (SQLAlchemyError, ValueError):
        fatigue_scores = []

    result = compute_combined_recovery(
        readiness_score=readiness_score,
        fatigue_scores=fatigue_scores,
    )

    return CombinedRecoveryResponse(
        score=result.score,
        volume_multiplier=result.volume_multiplier,
        label=result.label,
        factors=[
            CombinedRecoveryFactorResponse(name=f.name, value=f.value, source=f.source)
            for f in result.factors
        ],
    )
