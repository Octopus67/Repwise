"""Daily step tracking router.

POST /sync    — Sync (upsert) a day's step data
GET  /history — Get step history with optional date range
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.steps.schemas import DailyStepsResponse, StepsHistoryResponse, SyncStepsRequest
from src.modules.steps.service import StepsService

router = APIRouter()


def _get_steps_service(db: AsyncSession = Depends(get_db)) -> StepsService:
    return StepsService(db)


@router.post("/sync", response_model=DailyStepsResponse, status_code=200)
async def sync_steps(
    data: SyncStepsRequest,
    user: User = Depends(get_current_user),
    service: StepsService = Depends(_get_steps_service),
) -> DailyStepsResponse:
    row = await service.sync_steps(user_id=user.id, data=data)
    return DailyStepsResponse.model_validate(row)


@router.get("/history", response_model=StepsHistoryResponse)
async def get_history(
    user: User = Depends(get_current_user),
    service: StepsService = Depends(_get_steps_service),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=365),
) -> StepsHistoryResponse:
    items = await service.get_history(
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )
    return StepsHistoryResponse(items=[DailyStepsResponse.model_validate(i) for i in items])
