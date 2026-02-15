"""Readiness API router."""

from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.readiness.readiness_schemas import (
    CheckinRequest,
    CheckinResponse,
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


@router.get("/history", response_model=ReadinessHistoryResponse)
async def get_history(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadinessHistoryResponse:
    service = ReadinessService(db)
    return await service.get_history(user.id, start_date, end_date)
