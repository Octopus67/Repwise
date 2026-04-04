"""Dashboard summary endpoint — consolidates 12 API calls into 1."""

from __future__ import annotations

from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.dashboard.schemas import DashboardSummaryResponse
from src.modules.dashboard.service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSummaryResponse)
@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummaryResponse:
    """Get all dashboard data in a single request.
    
    Consolidates:
    - Nutrition entries for date
    - Adaptive targets
    - Training sessions for date
    - Bodyweight history (last 30 days)
    - Streak count
    - Readiness score
    - Fatigue alerts
    - Nudges
    - Volume summary
    - Milestone messages
    """
    service = DashboardService(db)
    target_date = date if date else str(date_type.today())
    return await service.get_summary(current_user.id, target_date)
