"""User module business logic.

Provides profile management, metrics logging, bodyweight logging,
and goal management with paginated history queries.
"""

from __future__ import annotations
from typing import Optional

import logging
import time
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
from src.shared.errors import NotFoundError, ValidationError, RateLimitedError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import ActivityLevel, GoalType

logger = logging.getLogger(__name__)

# Rate limiting for recalculate: 1 per minute per user
# TODO: Move to Redis for multi-worker deployments
# Current limitation: rate limit is per-worker, not global
_recalculate_attempts: dict[str, float] = {}
RECALCULATE_COOLDOWN_SECONDS = 60


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
        
        # Validate preferences field
        if "preferences" in update_data and update_data["preferences"] is not None:
            prefs = update_data["preferences"]
            if not isinstance(prefs, dict):
                raise ValidationError("Preferences must be a dictionary")
            
            # Allow only known preference keys
            allowed_keys = {
                "age_years", "sex", "theme", "units", "notifications",
                "unit_system", "rest_timer", "cuisine_preferences",
                "dietary_restrictions", "allergies", "meal_frequency",
                "diet_style", "protein_per_kg", "exercise_types",
                "exercise_sessions_per_week",
            }
            unknown_keys = set(prefs.keys()) - allowed_keys
            if unknown_keys:
                raise ValidationError(f"Unknown preference keys: {', '.join(unknown_keys)}")

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
        """Log or update a bodyweight entry (upsert by date)."""
        # Validate bodyweight bounds
        if data.weight_kg < 20 or data.weight_kg > 500:
            raise ValidationError("Bodyweight must be between 20kg and 500kg")
            
        # Check for existing entry on the same date
        stmt = select(BodyweightLog).where(
            BodyweightLog.user_id == user_id,
            BodyweightLog.recorded_date == data.recorded_date,
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.weight_kg = data.weight_kg
            await self.db.flush()
            await self.db.refresh(existing)
            
            # Auto-recalculate targets if weight has changed significantly
            await self._maybe_auto_recalculate(user_id)
            
            return BodyweightLogResponse.model_validate(existing)

        log = BodyweightLog(
            user_id=user_id,
            weight_kg=data.weight_kg,
            recorded_date=data.recorded_date,
        )
        self.db.add(log)
        await self.db.flush()
        
        # Auto-recalculate targets if weight has changed significantly
        await self._maybe_auto_recalculate(user_id)
        
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
        global _recalculate_attempts

        # Rate limiting: max 1 recalculate per minute per user
        user_key = str(user_id)
        now = time.time()
        last_attempt = _recalculate_attempts.get(user_key, 0)
        if now - last_attempt < RECALCULATE_COOLDOWN_SECONDS:
            remaining = int(RECALCULATE_COOLDOWN_SECONDS - (now - last_attempt))
            raise RateLimitedError(
                message="Recalculate rate limit exceeded. Please wait before trying again.",
                retry_after=remaining
            )
        _recalculate_attempts[user_key] = now

        # Prevent memory leak: clear old entries
        if len(_recalculate_attempts) > 10000:
            cutoff = time.time() - RECALCULATE_COOLDOWN_SECONDS * 2
            _recalculate_attempts = {k: v for k, v in _recalculate_attempts.items() if v > cutoff}

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
            if age_years == 30:
                logger.warning(f"User {user_id} missing age in preferences, using default 30")

            sex = sex or "male"
            if sex == "male" and not prefs.get("sex"):
                logger.warning(f"User {user_id} missing sex in preferences, using default male")

        # Step 7: Build AdaptiveInput
        diet_style = prefs.get("diet_style")
        protein_per_kg = prefs.get("protein_per_kg")
        body_fat_pct = latest_metrics.body_fat_pct

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
            diet_style=diet_style,
            protein_per_kg_override=protein_per_kg,
            body_fat_pct=body_fat_pct,
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

    async def _maybe_auto_recalculate(self, user_id: uuid.UUID) -> None:
        """Auto-recalculate targets if weight has changed significantly since last snapshot."""
        try:
            # Get latest adaptive snapshot
            snap_stmt = (
                select(AdaptiveSnapshot)
                .where(AdaptiveSnapshot.user_id == user_id)
                .order_by(AdaptiveSnapshot.created_at.desc())
                .limit(1)
            )
            snap = (await self.db.execute(snap_stmt)).scalar_one_or_none()
            if snap is None:
                return  # No snapshot to compare against
            
            # Get current EMA weight from recent bodyweight logs
            bw_stmt = (
                select(BodyweightLog)
                .where(BodyweightLog.user_id == user_id)
                .order_by(BodyweightLog.recorded_date.desc())
                .limit(14)
            )
            bw_rows = (await self.db.execute(bw_stmt)).scalars().all()
            if len(bw_rows) < 3:
                return  # Not enough data for EMA
            
            # Simple EMA: average of last 7 entries
            recent_weights = [r.weight_kg for r in bw_rows[:7]]
            current_ema = sum(recent_weights) / len(recent_weights)
            
            # Compare with snapshot weight
            snapshot_weight = snap.ema_current
            if snapshot_weight is None or snapshot_weight <= 0:
                return
            
            # Threshold: recalculate if weight changed by > 1kg or > 1.5%
            diff = abs(current_ema - snapshot_weight)
            pct_diff = diff / snapshot_weight * 100
            if diff < 1.0 and pct_diff < 1.5:
                return  # Not significant enough
            
            # Trigger recalculation - get user data
            goal = (await self.db.execute(
                select(UserGoal).where(UserGoal.user_id == user_id)
            )).scalar_one_or_none()
            
            metrics = (await self.db.execute(
                select(UserMetric).where(UserMetric.user_id == user_id)
                .order_by(UserMetric.recorded_at.desc()).limit(1)
            )).scalar_one_or_none()
            
            if not goal or not metrics:
                return
            
            # Get profile for age/sex
            profile = await self.get_profile(user_id)
            prefs = profile.preferences or {}
            age_years = prefs.get("age_years", 30)
            sex = prefs.get("sex", "male")
            
            # Build adaptive input
            bw_history = [(r.recorded_date, r.weight_kg) for r in reversed(bw_rows)]
            adaptive_input = AdaptiveInput(
                weight_kg=current_ema,
                height_cm=metrics.height_cm or 170,
                age_years=age_years,
                sex=sex,
                activity_level=ActivityLevel(metrics.activity_level or "moderate"),
                goal_type=GoalType(goal.goal_type),
                goal_rate_per_week=goal.goal_rate_per_week or 0.0,
                bodyweight_history=bw_history,
                training_load_score=0.0,
                diet_style=prefs.get("diet_style"),
                protein_per_kg_override=prefs.get("protein_per_kg"),
                body_fat_pct=metrics.body_fat_pct,
            )
            
            new_snap = compute_snapshot(adaptive_input)
            
            # Save new snapshot
            snap_model = AdaptiveSnapshot(
                user_id=user_id,
                target_calories=new_snap.target_calories,
                target_protein_g=new_snap.target_protein_g,
                target_carbs_g=new_snap.target_carbs_g,
                target_fat_g=new_snap.target_fat_g,
                ema_current=new_snap.ema_current,
                adjustment_factor=new_snap.adjustment_factor,
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
            self.db.add(snap_model)
            await self.db.flush()
            
        except Exception:
            # Non-critical — don't fail the bodyweight log
            pass
