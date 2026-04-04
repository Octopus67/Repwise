"""Report routes — weekly + monthly intelligence report endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.auth.models import User
from src.modules.reports.monthly_schemas import MonthlyReportResponse
from src.modules.reports.monthly_service import MonthlyReportService
from src.modules.reports.schemas import WeeklyReportResponse
from src.modules.reports.service import WeeklyReportService
from src.modules.reports.yearly_schemas import YearlyReportResponse
from src.modules.reports.yearly_service import YearlyReportService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> WeeklyReportService:
    return WeeklyReportService(db)


def _get_monthly_service(db: AsyncSession = Depends(get_db)) -> MonthlyReportService:
    return MonthlyReportService(db)


def _get_yearly_service(db: AsyncSession = Depends(get_db)) -> YearlyReportService:
    return YearlyReportService(db)


@router.get("/weekly", response_model=WeeklyReportResponse)
async def get_weekly_report(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    week: Optional[int] = Query(None, ge=1, le=53),
    user: User = Depends(get_current_user),
    service: WeeklyReportService = Depends(_get_service),
) -> WeeklyReportResponse:
    """Get the weekly intelligence report for a given ISO week."""
    check_user_endpoint_rate_limit(str(user.id), "report_gen", 10, 60)
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
    except SQLAlchemyError:
        logger.exception("DB error generating weekly report for user=%s year=%d week=%d", user.id, year, week)
        raise HTTPException(status_code=500, detail="Failed to generate weekly report")
    except (ValueError, KeyError, TypeError, ZeroDivisionError):
        logger.exception("Computation error in weekly report for user=%s year=%d week=%d", user.id, year, week)
        raise HTTPException(status_code=500, detail="Failed to generate weekly report")

    return report


@router.get("/monthly", response_model=MonthlyReportResponse)
async def get_monthly_report(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    user: User = Depends(get_current_user),
    service: MonthlyReportService = Depends(_get_monthly_service),
) -> MonthlyReportResponse:
    """Get the monthly recap report for a given calendar month."""
    check_user_endpoint_rate_limit(str(user.id), "report_gen", 10, 60)
    today = date.today()

    if year is None or month is None:
        year = today.year
        month = today.month

    # Validate not in the future
    if (year, month) > (today.year, today.month):
        raise HTTPException(status_code=400, detail="Cannot generate report for a future month")

    try:
        report = await service.get_monthly_report(user_id=user.id, year=year, month=month)
    except (ValueError, KeyError):
        raise
    except SQLAlchemyError:
        logger.exception("DB error generating monthly report for user=%s year=%d month=%d", user.id, year, month)
        raise HTTPException(status_code=500, detail="Failed to generate monthly report")
    except (TypeError, ZeroDivisionError):
        logger.exception("Computation error in monthly report for user=%s year=%d month=%d", user.id, year, month)
        raise HTTPException(status_code=500, detail="Failed to generate monthly report")

    return report


@router.get("/yearly", response_model=YearlyReportResponse)
async def get_yearly_report(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    user: User = Depends(get_current_user),
    service: YearlyReportService = Depends(_get_yearly_service),
) -> YearlyReportResponse:
    """Get the year in review report for a given calendar year."""
    check_user_endpoint_rate_limit(str(user.id), "report_gen", 10, 60)
    today = date.today()

    if year is None:
        year = today.year

    if year > today.year:
        raise HTTPException(status_code=400, detail="Cannot generate report for a future year")

    try:
        report = await service.get_yearly_report(user_id=user.id, year=year)
    except (ValueError, KeyError):
        raise
    except SQLAlchemyError:
        logger.exception("DB error generating yearly report for user=%s year=%d", user.id, year)
        raise HTTPException(status_code=500, detail="Failed to generate yearly report")
    except (TypeError, ZeroDivisionError):
        logger.exception("Computation error in yearly report for user=%s year=%d", user.id, year)
        raise HTTPException(status_code=500, detail="Failed to generate yearly report")

    return report
