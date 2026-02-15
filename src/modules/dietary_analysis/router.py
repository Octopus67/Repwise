"""Dietary analysis routes — trend analysis and gap detection."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.freemium_gate import require_premium
from src.modules.auth.models import User
from src.modules.dietary_analysis.service import (
    DietaryAnalysisService,
    FoodRecommendation,
    NutritionGap,
)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> DietaryAnalysisService:
    return DietaryAnalysisService(db)


@router.get("/trends")
async def analyze_trends(
    user: User = Depends(get_current_user),
    service: DietaryAnalysisService = Depends(_get_service),
    window_days: int = Query(default=7, ge=1, le=90),
) -> dict:
    """Analyze dietary trends over a time window. Req 9.1, 9.4.

    Basic trend data is available to all users.
    """
    report = await service.analyze_trends(user_id=user.id, window_days=window_days)
    return {
        "window_days": report.window_days,
        "daily_summaries": [asdict(s) for s in report.daily_summaries],
        "averages": asdict(report.averages),
    }


@router.get("/gaps")
async def identify_gaps(
    user: User = Depends(require_premium),
    service: DietaryAnalysisService = Depends(_get_service),
    window_days: int = Query(default=7, ge=1, le=90),
) -> list[dict]:
    """Identify nutritional gaps (premium-gated). Req 9.3, 9.5."""
    gaps = await service.identify_gaps(user_id=user.id, window_days=window_days)
    return [asdict(g) for g in gaps]


@router.get("/recommendations")
async def get_recommendations(
    user: User = Depends(require_premium),
    service: DietaryAnalysisService = Depends(_get_service),
    window_days: int = Query(default=7, ge=1, le=90),
) -> list[dict]:
    """Get food recommendations for nutritional gaps (premium-gated). Req 9.5."""
    gaps = await service.identify_gaps(user_id=user.id, window_days=window_days)
    recs = await service.get_recommendations(user_id=user.id, gaps=gaps)
    return [asdict(r) for r in recs]
