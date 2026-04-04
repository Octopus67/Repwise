"""Free trial business logic.

Handles eligibility checks, trial activation, status queries,
insights computation, and trial termination.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.measurements.models import BodyMeasurement
from src.modules.nutrition.models import NutritionEntry
from src.modules.payments.models import Subscription
from src.modules.training.models import PersonalRecord, TrainingSession
from src.shared.errors import ConflictError, NotFoundError
from src.shared.types import SubscriptionStatus

TRIAL_DURATION_DAYS = 14


class TrialService:
    """Service layer for free trial operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def check_eligibility(self, user_id: uuid.UUID) -> dict:
        """Check if user is eligible for a free trial."""
        user = await self._get_user(user_id)
        eligible = not user.has_used_trial
        # Also check no active subscription
        if eligible:
            stmt = (
                select(Subscription)
                .where(
                    Subscription.user_id == user_id,
                    Subscription.status == SubscriptionStatus.ACTIVE,
                    Subscription.deleted_at.is_(None),
                )
                .limit(1)
            )
            result = await self.session.execute(stmt)
            if result.scalar_one_or_none() is not None:
                eligible = False
        return {"eligible": eligible, "has_used_trial": user.has_used_trial}

    async def start_trial(self, user_id: uuid.UUID) -> Subscription:
        """Activate a 14-day free trial for the user."""
        user = await self._get_user(user_id)

        if user.has_used_trial:
            raise ConflictError("User has already used their free trial")

        # Check no active subscription
        stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        if result.scalar_one_or_none() is not None:
            raise ConflictError("User already has an active subscription")

        now = datetime.now(timezone.utc)
        ends_at = now + timedelta(days=TRIAL_DURATION_DAYS)

        # Update user trial fields
        user.has_used_trial = True
        user.trial_started_at = now
        user.trial_ends_at = ends_at

        # Create trial subscription
        subscription = Subscription(
            user_id=user_id,
            provider_name="trial",
            status=SubscriptionStatus.ACTIVE,
            plan_id="trial_14day",
            currency="USD",
            region="US",
            current_period_end=ends_at,
            is_trial=True,
        )
        self.session.add(subscription)
        await self.session.flush()
        await self.session.refresh(subscription)
        return subscription

    async def get_trial_status(self, user_id: uuid.UUID) -> dict:
        """Get current trial status including days remaining."""
        user = await self._get_user(user_id)

        if not user.trial_started_at:
            return {"active": False, "has_used_trial": user.has_used_trial}

        now = datetime.now(timezone.utc)
        ends_at = user.trial_ends_at
        if ends_at is not None and ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        active = ends_at is not None and now < ends_at

        days_remaining = 0
        if active and ends_at:
            delta = ends_at - now
            days_remaining = max(0, delta.days)

        return {
            "active": active,
            "has_used_trial": user.has_used_trial,
            "trial_started_at": user.trial_started_at.isoformat() if user.trial_started_at else None,
            "trial_ends_at": ends_at.isoformat() if ends_at else None,
            "days_remaining": days_remaining,
        }

    async def get_trial_insights(self, user_id: uuid.UUID) -> dict:
        """Compute activity insights for the trial period."""
        user = await self._get_user(user_id)

        if not user.trial_started_at:
            raise NotFoundError("No trial found for this user")

        start = user.trial_started_at
        end = user.trial_ends_at or (start + timedelta(days=TRIAL_DURATION_DAYS))
        start_date = start.date()
        end_date = end.date()

        # Workouts logged
        workout_count = (
            await self.session.execute(
                select(func.count())
                .select_from(TrainingSession)
                .where(
                    TrainingSession.user_id == user_id,
                    TrainingSession.session_date >= start_date,
                    TrainingSession.session_date <= end_date,
                    TrainingSession.deleted_at.is_(None),
                )
            )
        ).scalar_one()

        # Total volume (sum of sets * reps * weight from JSONB)
        sessions_result = await self.session.execute(
            select(TrainingSession.exercises)
            .where(
                TrainingSession.user_id == user_id,
                TrainingSession.session_date >= start_date,
                TrainingSession.session_date <= end_date,
                TrainingSession.deleted_at.is_(None),
            )
        )
        total_volume = 0.0
        for (exercises,) in sessions_result.all():
            if not exercises:
                continue
            for ex in exercises:
                for s in ex.get("sets", []):
                    weight = s.get("weight_kg", 0) or 0
                    reps = s.get("reps", 0) or 0
                    total_volume += weight * reps

        # PRs hit during trial
        pr_count = (
            await self.session.execute(
                select(func.count())
                .select_from(PersonalRecord)
                .where(
                    PersonalRecord.user_id == user_id,
                    PersonalRecord.achieved_at >= start,
                    PersonalRecord.achieved_at <= end,
                )
            )
        ).scalar_one()

        # Meals logged
        meals_count = (
            await self.session.execute(
                select(func.count())
                .select_from(NutritionEntry)
                .where(
                    NutritionEntry.user_id == user_id,
                    NutritionEntry.entry_date >= start_date,
                    NutritionEntry.entry_date <= end_date,
                    NutritionEntry.deleted_at.is_(None),
                )
            )
        ).scalar_one()

        # Measurements tracked
        measurements_count = (
            await self.session.execute(
                select(func.count())
                .select_from(BodyMeasurement)
                .where(
                    BodyMeasurement.user_id == user_id,
                    BodyMeasurement.measured_at >= start,
                    BodyMeasurement.measured_at <= end,
                )
            )
        ).scalar_one()

        return {
            "workouts_logged": workout_count,
            "prs_hit": pr_count,
            "total_volume_kg": round(total_volume, 1),
            "meals_logged": meals_count,
            "measurements_tracked": measurements_count,
            "trial_started_at": start.isoformat(),
            "trial_ends_at": end.isoformat(),
        }

    async def end_trial(self, user_id: uuid.UUID) -> None:
        """Manually end a user's trial (downgrade to free)."""
        stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.is_trial.is_(True),
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        if subscription is None:
            raise NotFoundError("No active trial found")

        subscription.status = SubscriptionStatus.FREE
        await self.session.flush()

    async def _get_user(self, user_id: uuid.UUID) -> User:
        """Fetch user or raise NotFoundError."""
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        return user
