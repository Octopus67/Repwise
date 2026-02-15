"""Fatigue detection API router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.training.fatigue_schemas import FatigueAnalysisResponse
from src.modules.training.fatigue_service import FatigueService

router = APIRouter()


@router.get("/fatigue", response_model=FatigueAnalysisResponse)
async def get_fatigue_analysis(
    lookback_days: int = Query(default=28, ge=7, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FatigueAnalysisResponse:
    service = FatigueService(db)
    return await service.analyze_fatigue(user.id, lookback_days)
