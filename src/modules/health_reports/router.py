"""Health report routes — premium-gated CRUD with JWT authentication."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.freemium_gate import require_premium
from src.modules.auth.models import User
from src.modules.health_reports.schemas import (
    HealthReportCreate,
    HealthReportResponse,
    NutritionCorrelation,
)
from src.modules.health_reports.service import HealthReportService
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> HealthReportService:
    return HealthReportService(db)


@router.post("/reports", response_model=HealthReportResponse, status_code=201)
async def upload_report(
    data: HealthReportCreate,
    user: User = Depends(require_premium),
    service: HealthReportService = Depends(_get_service),
) -> HealthReportResponse:
    """Upload a new health report (premium-gated). Req 8.1."""
    report = await service.upload_report(user_id=user.id, data=data)
    return HealthReportResponse.model_validate(report)


@router.get("/reports", response_model=PaginatedResult[HealthReportResponse])
async def get_reports(
    user: User = Depends(require_premium),
    service: HealthReportService = Depends(_get_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[HealthReportResponse]:
    """Get health report history in chronological order (premium-gated). Req 8.4."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.get_reports(user_id=user.id, pagination=pagination)
    return PaginatedResult[HealthReportResponse](
        items=[HealthReportResponse.model_validate(r) for r in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/reports/samples")
async def get_sample_reports(
    user: User = Depends(get_current_user),
    service: HealthReportService = Depends(_get_service),
) -> List[dict]:
    """Get sample/demo reports for feature exploration. Req 8.5."""
    return await service.get_sample_reports()


@router.get("/reports/{report_id}", response_model=HealthReportResponse)
async def get_report_detail(
    report_id: uuid.UUID,
    user: User = Depends(require_premium),
    service: HealthReportService = Depends(_get_service),
) -> HealthReportResponse:
    """Get a single health report by ID (premium-gated). Req 8.4."""
    report = await service.get_report_detail(user_id=user.id, report_id=report_id)
    return HealthReportResponse.model_validate(report)


@router.get("/reports/{report_id}/correlations", response_model=List[NutritionCorrelation])
async def cross_reference_nutrition(
    report_id: uuid.UUID,
    user: User = Depends(require_premium),
    service: HealthReportService = Depends(_get_service),
) -> list[NutritionCorrelation]:
    """Cross-reference flagged markers with nutrition data (premium-gated). Req 8.3."""
    return await service.cross_reference_nutrition(user_id=user.id, report_id=report_id)
