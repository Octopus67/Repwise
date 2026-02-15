"""User routes — profile, metrics, bodyweight, and goals management."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from typing import Optional

from src.modules.user.schemas import (
    BodyweightLogCreate,
    BodyweightLogResponse,
    RecalculateRequest,
    RecalculateResponse,
    UserGoalResponse,
    UserGoalSet,
    UserMetricCreate,
    UserMetricResponse,
    UserProfileResponse,
    UserProfileUpdate,
)
from src.modules.user.service import UserService
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


# ------------------------------------------------------------------
# Profile
# ------------------------------------------------------------------


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> UserProfileResponse:
    """Return the authenticated user's profile (auto-creates if missing)."""
    return await service.get_profile(user.id)


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> UserProfileResponse:
    """Update the authenticated user's profile."""
    return await service.update_profile(user.id, data)


# ------------------------------------------------------------------
# Metrics
# ------------------------------------------------------------------


@router.post("/metrics", response_model=UserMetricResponse, status_code=201)
async def log_metrics(
    data: UserMetricCreate,
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> UserMetricResponse:
    """Log a new physiological metrics snapshot."""
    return await service.log_metrics(user.id, data)


@router.get("/metrics/history", response_model=PaginatedResult[UserMetricResponse])
async def get_metrics_history(
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[UserMetricResponse]:
    """Return paginated metrics history for the authenticated user."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_metrics_history(user.id, pagination)


# ------------------------------------------------------------------
# Bodyweight
# ------------------------------------------------------------------


@router.post("/bodyweight", response_model=BodyweightLogResponse, status_code=201)
async def log_bodyweight(
    data: BodyweightLogCreate,
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> BodyweightLogResponse:
    """Log a bodyweight entry."""
    return await service.log_bodyweight(user.id, data)


@router.get("/bodyweight/history", response_model=PaginatedResult[BodyweightLogResponse])
async def get_bodyweight_history(
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[BodyweightLogResponse]:
    """Return paginated bodyweight history for the authenticated user."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_bodyweight_history(user.id, pagination)


# ------------------------------------------------------------------
# Goals
# ------------------------------------------------------------------


@router.put("/goals", response_model=UserGoalResponse)
async def set_goals(
    data: UserGoalSet,
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> UserGoalResponse:
    """Set or update the authenticated user's goals."""
    return await service.set_goals(user.id, data)


@router.get("/goals", response_model=Optional[UserGoalResponse])
async def get_goals(
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> Optional[UserGoalResponse]:
    """Return the authenticated user's current goals."""
    return await service.get_goals(user.id)

# ------------------------------------------------------------------
# Recalculate
# ------------------------------------------------------------------


@router.post("/recalculate", response_model=RecalculateResponse)
async def recalculate(
    data: RecalculateRequest,
    user: User = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> RecalculateResponse:
    """Save metrics/goals and return updated adaptive targets."""
    return await service.recalculate(user.id, data)

