"""Adaptive engine routes — snapshot generation, history, recalculation status, coaching, and daily targets."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.adaptive.coaching_service import CoachingService
from typing import Dict, List, Optional

from src.modules.adaptive.schemas import (
    CoachingSuggestionResponse,
    DailyTargetResponse,
    MacroModifications,
    OverrideCreate,
    OverrideResponse,
    RecalculationStatusResponse,
    SnapshotRequest,
    SnapshotResponse,
    WeeklyCheckinResponse,
)
from src.modules.adaptive.service import AdaptiveService
from src.modules.adaptive.sync_service import SyncEngineService
from src.modules.auth.models import User
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import TrainingPhase

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> AdaptiveService:
    return AdaptiveService(db)


def _get_coaching_service(db: AsyncSession = Depends(get_db)) -> CoachingService:
    return CoachingService(db)


def _get_sync_service(db: AsyncSession = Depends(get_db)) -> SyncEngineService:
    return SyncEngineService(db)


@router.post("/snapshots", response_model=SnapshotResponse, status_code=201)
async def generate_snapshot(
    data: SnapshotRequest,
    user: User = Depends(get_current_user),
    service: AdaptiveService = Depends(_get_service),
) -> SnapshotResponse:
    """Generate a new adaptive snapshot (Requirement 7.1, 7.2)."""
    return await service.generate_snapshot(user_id=user.id, data=data)


@router.get("/snapshots", response_model=PaginatedResult[SnapshotResponse])
async def get_snapshots(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    service: AdaptiveService = Depends(_get_service),
) -> PaginatedResult[SnapshotResponse]:
    """Get paginated snapshot history (Requirement 7.4)."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_snapshots(user_id=user.id, pagination=pagination)


@router.get("/recalculation-status", response_model=RecalculationStatusResponse)
async def recalculation_status(
    current_ema: Optional[float] = Query(default=None, description="Current EMA bodyweight"),
    current_training_load: Optional[float] = Query(default=None, ge=0, le=100),
    current_goal_type: Optional[str] = Query(default=None),
    current_goal_rate: Optional[float] = Query(default=None),
    user: User = Depends(get_current_user),
    service: AdaptiveService = Depends(_get_service),
) -> RecalculationStatusResponse:
    """Check if a recalculation is recommended (Requirement 7.3)."""
    return await service.check_recalculation_needed(
        user_id=user.id,
        current_ema=current_ema,
        current_training_load=current_training_load,
        current_goal_type=current_goal_type,
        current_goal_rate=current_goal_rate,
    )


# ---------------------------------------------------------------------------
# Daily Targets Endpoints (Nutrition-Training Sync Engine)
# ---------------------------------------------------------------------------


@router.get("/daily-targets", response_model=DailyTargetResponse)
async def get_daily_targets(
    date: date = Query(default=None, description="Target date (defaults to today)"),
    training_phase: TrainingPhase = Query(default=TrainingPhase.NONE),
    user: User = Depends(get_current_user),
    service: SyncEngineService = Depends(_get_sync_service),
) -> DailyTargetResponse:
    """Get adjusted daily targets for a date."""
    from datetime import date as date_type

    target_date = date if date else date_type.today()
    return await service.get_daily_targets(
        user_id=user.id, target_date=target_date, training_phase=training_phase,
    )


@router.post("/daily-targets/override", response_model=OverrideResponse, status_code=201)
async def set_daily_target_override(
    data: OverrideCreate,
    user: User = Depends(get_current_user),
    service: SyncEngineService = Depends(_get_sync_service),
) -> OverrideResponse:
    """Set a manual override for a date's targets."""
    return await service.set_override(user_id=user.id, data=data)


@router.delete("/daily-targets/override", status_code=204)
async def remove_daily_target_override(
    date: date = Query(..., description="Date to remove override for"),
    user: User = Depends(get_current_user),
    service: SyncEngineService = Depends(_get_sync_service),
) -> None:
    """Remove a manual override for a date."""
    await service.remove_override(user_id=user.id, target_date=date)


# ---------------------------------------------------------------------------
# Coaching Tier Endpoints (Feature 3)
# ---------------------------------------------------------------------------


@router.post("/weekly-checkin", response_model=WeeklyCheckinResponse)
async def weekly_checkin(
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_coaching_service),
) -> WeeklyCheckinResponse:
    """Trigger a weekly check-in for the current user (Requirement 3.2.1)."""
    return await service.generate_weekly_checkin(user_id=user.id)


@router.get("/suggestions", response_model=List[CoachingSuggestionResponse])
async def get_suggestions(
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_coaching_service),
) -> list[CoachingSuggestionResponse]:
    """Get pending coaching suggestions (Requirement 3.3.1)."""
    return await service.get_pending_suggestions(user_id=user.id)


@router.post("/suggestions/{suggestion_id}/accept", status_code=200)
async def accept_suggestion(
    suggestion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_coaching_service),
) -> Dict[str, str]:
    """Accept a coaching suggestion (Requirement 3.3.2)."""
    await service.accept_suggestion(user_id=user.id, suggestion_id=suggestion_id)
    return {"status": "accepted"}


@router.post("/suggestions/{suggestion_id}/modify", status_code=200)
async def modify_suggestion(
    suggestion_id: uuid.UUID,
    modifications: MacroModifications,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_coaching_service),
) -> Dict[str, str]:
    """Modify a coaching suggestion (Requirement 3.3.2)."""
    await service.modify_suggestion(
        user_id=user.id,
        suggestion_id=suggestion_id,
        modifications=modifications,
    )
    return {"status": "modified"}


@router.post("/suggestions/{suggestion_id}/dismiss", status_code=200)
async def dismiss_suggestion(
    suggestion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_coaching_service),
) -> Dict[str, str]:
    """Dismiss a coaching suggestion (Requirement 3.3.2)."""
    await service.dismiss_suggestion(user_id=user.id, suggestion_id=suggestion_id)
    return {"status": "dismissed"}
