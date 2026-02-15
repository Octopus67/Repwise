"""User module business logic.

Provides profile management, metrics logging, bodyweight logging,
and goal management with paginated history queries.
"""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.engine import AdaptiveInput, compute_snapshot
from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.user.models import BodyweightLog, UserGoal, UserMetric, UserProfile
from src.modules.user.schemas import (
    AdaptiveTargetResponse,
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
from src.shared.errors import NotFoundError, ValidationError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import ActivityLevel, GoalType


class UserService:
    """Stateless service — receives a session per call."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------

    async def get_profile(self, user_id: uuid.UUID) -> UserProfileResponse:
        """Return the profile for *user_id*, creating a blank one if needed."""
        stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            profile = UserProfile(user_id=user_id)
            self.db.add(profile)
            await self.db.flush()

        return UserProfileResponse.model_validate(profile)

    async def update_profile(
        self, user_id: uuid.UUID, data: UserProfileUpdate
    ) -> UserProfileResponse:
        """Update (or create) the profile and return the updated record."""
        stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            profile = UserProfile(user_id=user_id)
            self.db.add(profile)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)

        await self.db.flush()
        await self.db.refresh(profile)
        return UserProfileResponse.model_validate(profile)

    # ------------------------------------------------------------------
    # Metrics (append-only history — Requirement 2.5)
    # ------------------------------------------------------------------

    async def log_metrics(
        self, user_id: uuid.UUID, data: UserMetricCreate
    ) -> UserMetricResponse:
        """Append a new metrics snapshot."""
        metric = UserMetric(
            user_id=user_id,
            height_cm=data.height_cm,
            weight_kg=data.weight_kg,
            body_fat_pct=data.body_fat_pct,
            activity_level=data.activity_level.value if data.activity_level else None,
            additional_metrics=data.additional_metrics,
        )
        self.db.add(metric)
        await self.db.flush()
        return UserMetricResponse.model_validate(metric)

    async def get_metrics_history(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[UserMetricResponse]:
        """Return paginated metrics history, newest first."""
        base = select(UserMetric).where(UserMetric.user_id == user_id)

        # total count
        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.db.execute(count_stmt)).scalar_one()

        # page slice
        items_stmt = (
            base.order_by(UserMetric.recorded_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        rows = (await self.db.execute(items_stmt)).scalars().all()

        return PaginatedResult[UserMetricResponse](
            items=[UserMetricResponse.model_validate(r) for r in rows],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Bodyweight logs (append-only — Requirement 2.5)
    # ------------------------------------------------------------------

    async def log_bodyweight(
        self, user_id: uuid.UUID, data: BodyweightLogCreate
    ) -> BodyweightLogResponse:
        """Append a bodyweight entry."""
        log = BodyweightLog(
            user_id=user_id,
            weight_kg=data.weight_kg,
            recorded_date=data.recorded_date,
        )
        self.db.add(log)
        await self.db.flush()
        return BodyweightLogResponse.model_validate(log)

    async def get_bodyweight_history(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[BodyweightLogResponse]:
        """Return paginated bodyweight history, newest first."""
        base = select(BodyweightLog).where(BodyweightLog.user_id == user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.db.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(BodyweightLog.recorded_date.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        rows = (await self.db.execute(items_stmt)).scalars().all()

        return PaginatedResult[BodyweightLogResponse](
            items=[BodyweightLogResponse.model_validate(r) for r in rows],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Goals (upsert — one active goal set per user)
    # ------------------------------------------------------------------

    async def set_goals(
        self, user_id: uuid.UUID, data: UserGoalSet
    ) -> UserGoalResponse:
        """Create or update the user's goals."""
        stmt = select(UserGoal).where(UserGoal.user_id == user_id)
        result = await self.db.execute(stmt)
        goal = result.scalar_one_or_none()

        if goal is None:
            goal = UserGoal(user_id=user_id)
            self.db.add(goal)

        goal.goal_type = data.goal_type.value
        goal.target_weight_kg = data.target_weight_kg
        goal.target_body_fat_pct = data.target_body_fat_pct
        goal.goal_rate_per_week = data.goal_rate_per_week
        goal.additional_goals = data.additional_goals

        await self.db.flush()
        await self.db.refresh(goal)
        return UserGoalResponse.model_validate(goal)

    async def get_goals(self, user_id: uuid.UUID) -> Optional[UserGoalResponse]:
        """Return the user's current goals, or None if not set."""
        stmt = select(UserGoal).where(UserGoal.user_id == user_id)
        result = await self.db.execute(stmt)
        goal = result.scalar_one_or_none()
        if goal is None:
            return None
        return UserGoalResponse.model_validate(goal)

    # ------------------------------------------------------------------
    # Recalculate (orchestrates metrics + goals + adaptive engine)
    # ------------------------------------------------------------------

    async def recalculate(
        self, user_id: uuid.UUID, data: RecalculateRequest
    ) -> RecalculateResponse:
        """Recalculate adaptive targets after updating metrics and/or goals."""

        # Step 1: Log metrics if provided
        new_metrics: Optional[UserMetricResponse] = None
        if data.metrics is not None:
            new_metrics = await self.log_metrics(user_id, data.metrics)

        # Step 2: Set goals if provided
        new_goals: Optional[UserGoalResponse] = None
        if data.goals is not None:
            new_goals = await self.set_goals(user_id, data.goals)

        # Step 3: Fetch latest metrics
        latest_stmt = (
            select(UserMetric)
            .where(UserMetric.user_id == user_id)
            .order_by(UserMetric.recorded_at.desc())
            .limit(1)
        )
        latest_result = await self.db.execute(latest_stmt)
        latest_metrics = latest_result.scalar_one_or_none()

        if latest_metrics is None or latest_metrics.weight_kg is None or latest_metrics.height_cm is None:
            raise ValidationError(
                "Height and weight are required for recalculation. Please log your body stats first."
            )

        # Step 4: Fetch current goals
        goals = await self.get_goals(user_id)
        if goals is None and data.goals is None:
            goal_type = GoalType.MAINTAINING
            goal_rate_per_week = 0.0
        else:
            effective_goals = goals
            goal_type = GoalType(effective_goals.goal_type)  # type: ignore[union-attr]
            goal_rate_per_week = effective_goals.goal_rate_per_week or 0.0  # type: ignore[union-attr]

        # Step 5: Fetch bodyweight history (last 90 days)
        today = date.today()
        cutoff = today - timedelta(days=90)
        bw_stmt = (
            select(BodyweightLog.recorded_date, BodyweightLog.weight_kg)
            .where(
                BodyweightLog.user_id == user_id,
                BodyweightLog.recorded_date >= cutoff,
            )
            .order_by(BodyweightLog.recorded_date)
        )
        bw_result = await self.db.execute(bw_stmt)
        bw_rows = bw_result.all()

        if bw_rows:
            bw_history: list[tuple[date, float]] = [
                (row.recorded_date, row.weight_kg) for row in bw_rows
            ]
        else:
            bw_history = [(today, latest_metrics.weight_kg)]

        # Step 6: Fetch user profile for age and sex
        profile = await self.get_profile(user_id)
        prefs = profile.preferences or {}
        age_years = prefs.get("age_years")
        sex = prefs.get("sex")

        if age_years is None or sex is None:
            # Fallback for users who onboarded before age/sex persistence was added.
            # Use reasonable defaults so recalculation isn't blocked.
            age_years = age_years or 30
            sex = sex or "male"

        # Step 7: Build AdaptiveInput
        adaptive_input = AdaptiveInput(
            weight_kg=latest_metrics.weight_kg,
            height_cm=latest_metrics.height_cm,
            age_years=age_years,
            sex=sex,
            activity_level=ActivityLevel(latest_metrics.activity_level or "moderate"),
            goal_type=goal_type,
            goal_rate_per_week=goal_rate_per_week,
            bodyweight_history=bw_history,
            training_load_score=0.0,
        )

        # Step 8: Compute snapshot
        output = compute_snapshot(adaptive_input)

        # Step 9: Persist AdaptiveSnapshot
        snapshot = AdaptiveSnapshot(
            user_id=user_id,
            target_calories=output.target_calories,
            target_protein_g=output.target_protein_g,
            target_carbs_g=output.target_carbs_g,
            target_fat_g=output.target_fat_g,
            ema_current=output.ema_current,
            adjustment_factor=output.adjustment_factor,
            input_parameters={
                "weight_kg": adaptive_input.weight_kg,
                "height_cm": adaptive_input.height_cm,
                "age_years": adaptive_input.age_years,
                "sex": adaptive_input.sex,
                "activity_level": adaptive_input.activity_level.value,
                "goal_type": adaptive_input.goal_type.value,
                "goal_rate_per_week": adaptive_input.goal_rate_per_week,
                "training_load_score": adaptive_input.training_load_score,
            },
        )
        self.db.add(snapshot)
        await self.db.flush()

        # Step 10: Return response
        return RecalculateResponse(
            metrics=new_metrics,
            goals=new_goals,
            targets=AdaptiveTargetResponse(
                calories=output.target_calories,
                protein_g=output.target_protein_g,
                carbs_g=output.target_carbs_g,
                fat_g=output.target_fat_g,
            ),
        )
