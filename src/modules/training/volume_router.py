"""Muscle-volume heat-map & volume-landmark routes."""

from __future__ import annotations
from typing import Optional, Union

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.training.volume_schemas import (
    ExerciseVolumeDetail,
    LandmarkConfigResponse,
    LandmarkUpdateRequest,
    MuscleGroupDetail,
    VolumeLandmark,
    WeeklyVolumeResponse,
    WNSWeeklyResponse,
)
from src.modules.training.volume_service import VolumeCalculatorService
from src.modules.training.landmark_store import LandmarkStore
from src.shared.errors import NotFoundError

router = APIRouter()


def _default_week_start() -> date:
    """Return the Monday of the current ISO week."""
    today = date.today()
    return today - timedelta(days=today.weekday())


def _snap_to_monday(d: date) -> date:
    """Auto-correct a date to its ISO Monday."""
    if d.weekday() != 0:
        return d - timedelta(days=d.weekday())
    return d


# ─── Muscle Volume Heat Map ──────────────────────────────────────────────────


@router.get("/analytics/muscle-volume")
async def get_muscle_volume(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    week_start: Optional[date] = Query(default=None),
) -> Union[WeeklyVolumeResponse, WNSWeeklyResponse]:
    """Get weekly muscle group volume with landmark comparisons."""
    if week_start is None:
        week_start = _default_week_start()
    else:
        week_start = _snap_to_monday(week_start)

    week_end = week_start + timedelta(days=6)

    from src.modules.feature_flags.service import FeatureFlagService
    ff_svc = FeatureFlagService(db)
    use_wns = await ff_svc.is_feature_enabled("wns_engine", user)

    if use_wns:
        from src.modules.training.wns_volume_service import WNSVolumeService
        from src.modules.user.models import UserGoal
        from sqlalchemy import select

        goal_result = await db.execute(select(UserGoal).where(UserGoal.user_id == user.id))
        user_goal = goal_result.scalar_one_or_none()
        goal_type = user_goal.goal_type if user_goal else None
        goal_rate = user_goal.goal_rate_per_week if user_goal else None

        wns_svc = WNSVolumeService(db)
        muscle_groups = await wns_svc.get_weekly_muscle_volume(user.id, week_start, goal_type, goal_rate)
        return WNSWeeklyResponse(
            week_start=week_start,
            week_end=week_end,
            muscle_groups=muscle_groups,
        )

    svc = VolumeCalculatorService(db)
    muscle_groups = await svc.get_weekly_muscle_volume(user.id, week_start)
    return WeeklyVolumeResponse(
        week_start=week_start,
        week_end=week_end,
        muscle_groups=muscle_groups,
    )


@router.get(
    "/analytics/muscle-volume/{muscle_group}/detail",
    response_model=MuscleGroupDetail,
)
async def get_muscle_volume_detail(
    muscle_group: str = Path(..., max_length=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    week_start: Optional[date] = Query(default=None),
) -> MuscleGroupDetail:
    """Get per-exercise volume breakdown for a muscle group."""
    if week_start is None:
        week_start = _default_week_start()
    else:
        week_start = _snap_to_monday(week_start)

    from src.modules.feature_flags.service import FeatureFlagService
    ff_svc = FeatureFlagService(db)
    use_wns = await ff_svc.is_feature_enabled("wns_engine", user)

    if use_wns:
        from src.modules.training.wns_volume_service import WNSVolumeService
        from src.modules.user.models import UserGoal
        from sqlalchemy import select

        goal_result = await db.execute(select(UserGoal).where(UserGoal.user_id == user.id))
        user_goal = goal_result.scalar_one_or_none()
        goal_type = user_goal.goal_type if user_goal else None
        goal_rate = user_goal.goal_rate_per_week if user_goal else None

        wns_svc = WNSVolumeService(db)
        all_muscles = await wns_svc.get_weekly_muscle_volume(user.id, week_start, goal_type, goal_rate)
        target = next((m for m in all_muscles if m.muscle_group == muscle_group), None)
        if target is None:
            raise NotFoundError(f"Muscle group '{muscle_group}' not found")

        return MuscleGroupDetail(
            muscle_group=muscle_group,
            effective_sets=target.net_stimulus,
            frequency=target.frequency,
            volume_status=target.status,
            mev=int(target.landmarks.mev),
            mav=int(target.landmarks.mav_high),
            mrv=int(target.landmarks.mrv),
            exercises=[
                ExerciseVolumeDetail(
                    exercise_name=ec.exercise_name,
                    working_sets=ec.sets_count,
                    effective_sets=ec.contribution_hu,
                    sets=[],
                )
                for ec in target.exercises
            ],
        )

    svc = VolumeCalculatorService(db)
    return await svc.get_muscle_group_detail(user.id, muscle_group, week_start)


# ─── Volume Landmarks ────────────────────────────────────────────────────────


@router.get("/analytics/volume-landmarks", response_model=LandmarkConfigResponse)
async def get_volume_landmarks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LandmarkConfigResponse:
    """Get merged volume landmarks (defaults + user customizations)."""
    store = LandmarkStore(db)
    landmarks = await store.get_landmarks(user.id)
    return LandmarkConfigResponse(landmarks=list(landmarks.values()))


@router.put("/analytics/volume-landmarks", response_model=VolumeLandmark)
async def set_volume_landmark(
    data: LandmarkUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VolumeLandmark:
    """Set custom volume landmarks for a muscle group."""
    store = LandmarkStore(db)
    return await store.set_landmark(user.id, data.muscle_group, data.mev, data.mav, data.mrv)


@router.delete(
    "/analytics/volume-landmarks/{muscle_group}",
    status_code=204,
    response_model=None,
)
async def delete_volume_landmark(
    muscle_group: str = Path(..., max_length=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete custom landmarks for a muscle group, reverting to defaults."""
    store = LandmarkStore(db)
    await store.delete_landmark(user.id, muscle_group)
