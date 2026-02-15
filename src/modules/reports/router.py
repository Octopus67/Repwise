"""Report routes — weekly intelligence report endpoint."""

from __future__ import annotations

import logging
from typing import Optional

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.reports.schemas import WeeklyReportResponse
from src.modules.reports.service import WeeklyReportService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> WeeklyReportService:
    return WeeklyReportService(db)


@router.get("/weekly", response_model=WeeklyReportResponse)
async def get_weekly_report(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    week: Optional[int] = Query(None, ge=1, le=53),
    user: User = Depends(get_current_user),
    service: WeeklyReportService = Depends(_get_service),
) -> WeeklyReportResponse:
    """Get the weekly intelligence report for a given ISO week."""
    today = date.today()
    current_iso = today.isocalendar()

    if year is None or week is None:
        year = current_iso.year
        week = current_iso.week

    # Validate week is valid for the given year (ISO years can have 52 or 53 weeks)
    max_week = date(year, 12, 28).isocalendar().week  # Dec 28 is always in the last ISO week
    if week > max_week:
        raise HTTPException(
            status_code=400,
            detail=f"ISO year {year} only has {max_week} weeks",
        )

    # Validate not in the future
    if (year, week) > (current_iso.year, current_iso.week):
        raise HTTPException(status_code=400, detail="Cannot generate report for a future week")

    try:
        report = await service.get_weekly_report(user_id=user.id, year=year, week=week)
    except Exception:
        logger.exception("Failed to generate weekly report for user=%s year=%d week=%d", user.id, year, week)
        raise HTTPException(status_code=500, detail="Failed to generate weekly report")

    return report
