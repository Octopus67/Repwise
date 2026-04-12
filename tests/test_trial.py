"""Tests for free trial feature — service, router, and expiration job.

20+ tests covering eligibility, activation, status, insights, expiration,
edge cases, and the trial expiration job.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from src.modules.auth.models import User
from src.modules.measurements.models import BodyMeasurement
from src.modules.nutrition.models import NutritionEntry
from src.modules.payments.models import Subscription
from src.modules.payments.trial_service import TRIAL_DURATION_DAYS, TrialService
from src.modules.training.models import TrainingSession
from src.shared.errors import ConflictError, NotFoundError
from src.shared.types import SubscriptionStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_user(session, *, has_used_trial: bool = False) -> User:
    user = User(
        email=f"trial_{uuid.uuid4().hex[:8]}@test.com",
        auth_provider="email",
        role="user",
        has_used_trial=has_used_trial,
    )
    session.add(user)
    await session.flush()
    return user


async def _create_active_subscription(session, user_id: uuid.UUID) -> Subscription:
    sub = Subscription(
        user_id=user_id,
        provider_name="revenuecat",
        status=SubscriptionStatus.ACTIVE,
        currency="USD",
        region="US",
    )
    session.add(sub)
    await session.flush()
    return sub


# ---------------------------------------------------------------------------
# Eligibility tests
# ---------------------------------------------------------------------------


class TestTrialEligibility:
    @pytest.mark.asyncio
    async def test_new_user_is_eligible(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        result = await svc.check_eligibility(user.id)
        assert result["eligible"] is True
        assert result["has_used_trial"] is False

    @pytest.mark.asyncio
    async def test_user_who_used_trial_is_not_eligible(self, db_session):
        user = await _create_user(db_session, has_used_trial=True)
        svc = TrialService(db_session)
        result = await svc.check_eligibility(user.id)
        assert result["eligible"] is False
        assert result["has_used_trial"] is True

    @pytest.mark.asyncio
    async def test_user_with_active_subscription_not_eligible(self, db_session):
        user = await _create_user(db_session)
        await _create_active_subscription(db_session, user.id)
        svc = TrialService(db_session)
        result = await svc.check_eligibility(user.id)
        assert result["eligible"] is False

    @pytest.mark.asyncio
    async def test_nonexistent_user_raises(self, db_session):
        svc = TrialService(db_session)
        with pytest.raises(NotFoundError):
            await svc.check_eligibility(uuid.uuid4())


# ---------------------------------------------------------------------------
# Start trial tests
# ---------------------------------------------------------------------------


class TestStartTrial:
    @pytest.mark.asyncio
    async def test_start_trial_success(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        sub = await svc.start_trial(user.id)

        assert sub.is_trial is True
        assert sub.status == SubscriptionStatus.ACTIVE
        assert sub.plan_id == "trial_14day"
        assert sub.provider_name == "trial"
        assert sub.current_period_end is not None

        # User fields updated
        await db_session.refresh(user)
        assert user.has_used_trial is True
        assert user.trial_started_at is not None
        assert user.trial_ends_at is not None

    @pytest.mark.asyncio
    async def test_start_trial_sets_7_day_duration(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        sub = await svc.start_trial(user.id)

        await db_session.refresh(user)
        delta = user.trial_ends_at - user.trial_started_at
        assert delta.days == TRIAL_DURATION_DAYS

    @pytest.mark.asyncio
    async def test_cannot_start_trial_twice(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        with pytest.raises(ConflictError, match="already used"):
            await svc.start_trial(user.id)

    @pytest.mark.asyncio
    async def test_cannot_start_trial_with_active_subscription(self, db_session):
        user = await _create_user(db_session)
        await _create_active_subscription(db_session, user.id)
        svc = TrialService(db_session)

        with pytest.raises(ConflictError, match="active subscription"):
            await svc.start_trial(user.id)

    @pytest.mark.asyncio
    async def test_trial_does_not_charge(self, db_session):
        """Trial subscription should not involve any payment provider."""
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        sub = await svc.start_trial(user.id)

        assert sub.provider_name == "trial"
        assert sub.provider_subscription_id is None
        assert sub.provider_customer_id is None


# ---------------------------------------------------------------------------
# Trial status tests
# ---------------------------------------------------------------------------


class TestTrialStatus:
    @pytest.mark.asyncio
    async def test_status_no_trial(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        result = await svc.get_trial_status(user.id)
        assert result["active"] is False

    @pytest.mark.asyncio
    async def test_status_active_trial(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        result = await svc.get_trial_status(user.id)
        assert result["active"] is True
        assert result["days_remaining"] >= 13  # just started

    @pytest.mark.asyncio
    async def test_status_expired_trial(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        # Manually expire
        await db_session.refresh(user)
        user.trial_ends_at = datetime.now(timezone.utc) - timedelta(hours=1)
        await db_session.flush()

        result = await svc.get_trial_status(user.id)
        assert result["active"] is False
        assert result["days_remaining"] == 0


# ---------------------------------------------------------------------------
# Trial insights tests
# ---------------------------------------------------------------------------


class TestTrialInsights:
    @pytest.mark.asyncio
    async def test_insights_no_trial_raises(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        with pytest.raises(NotFoundError, match="No trial found"):
            await svc.get_trial_insights(user.id)

    @pytest.mark.asyncio
    async def test_insights_empty_trial(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        result = await svc.get_trial_insights(user.id)
        assert result["workouts_logged"] == 0
        assert result["meals_logged"] == 0
        assert result["measurements_tracked"] == 0
        assert result["total_volume_kg"] == 0.0

    @pytest.mark.asyncio
    async def test_insights_with_workouts(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        # Add a workout during trial
        from datetime import date as d

        session = TrainingSession(
            user_id=user.id,
            session_date=d.today(),
            exercises=[
                {
                    "exercise_name": "Bench Press",
                    "sets": [
                        {"reps": 10, "weight_kg": 60.0},
                        {"reps": 8, "weight_kg": 70.0},
                    ],
                }
            ],
        )
        db_session.add(session)
        await db_session.flush()

        result = await svc.get_trial_insights(user.id)
        assert result["workouts_logged"] == 1
        assert result["total_volume_kg"] == (10 * 60.0) + (8 * 70.0)

    @pytest.mark.asyncio
    async def test_insights_with_meals(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        from datetime import date as d

        entry = NutritionEntry(
            user_id=user.id,
            meal_name="Lunch",
            food_name="Chicken",
            entry_date=d.today(),
            calories=500,
            protein_g=40,
            carbs_g=30,
            fat_g=15,
        )
        db_session.add(entry)
        await db_session.flush()

        result = await svc.get_trial_insights(user.id)
        assert result["meals_logged"] == 1

    @pytest.mark.asyncio
    async def test_insights_with_measurements(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        await svc.start_trial(user.id)

        measurement = BodyMeasurement(
            user_id=user.id,
            measured_at=datetime.now(timezone.utc),
            weight_kg=80.0,
        )
        db_session.add(measurement)
        await db_session.flush()

        result = await svc.get_trial_insights(user.id)
        assert result["measurements_tracked"] == 1


# ---------------------------------------------------------------------------
# End trial tests
# ---------------------------------------------------------------------------


class TestEndTrial:
    @pytest.mark.asyncio
    async def test_end_trial_success(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        sub = await svc.start_trial(user.id)

        await svc.end_trial(user.id)
        await db_session.refresh(sub)
        assert sub.status == SubscriptionStatus.FREE

    @pytest.mark.asyncio
    async def test_end_trial_no_active_trial_raises(self, db_session):
        user = await _create_user(db_session)
        svc = TrialService(db_session)
        with pytest.raises(NotFoundError, match="No active trial"):
            await svc.end_trial(user.id)


# ---------------------------------------------------------------------------
# Trial expiration job tests
# ---------------------------------------------------------------------------


class TestTrialExpirationJob:
    @pytest.mark.asyncio
    async def test_expires_past_due_trials(self, db_session):
        from src.jobs.trial_expiration import run_trial_expiration

        user = await _create_user(db_session)
        sub = Subscription(
            user_id=user.id,
            provider_name="trial",
            status=SubscriptionStatus.ACTIVE,
            is_trial=True,
            current_period_end=datetime.now(timezone.utc) - timedelta(hours=1),
            currency="USD",
            region="US",
        )
        db_session.add(sub)
        await db_session.flush()

        count = await run_trial_expiration(db_session)
        assert count == 1
        await db_session.refresh(sub)
        assert sub.status == SubscriptionStatus.FREE

    @pytest.mark.asyncio
    async def test_does_not_expire_active_trials(self, db_session):
        from src.jobs.trial_expiration import run_trial_expiration

        user = await _create_user(db_session)
        sub = Subscription(
            user_id=user.id,
            provider_name="trial",
            status=SubscriptionStatus.ACTIVE,
            is_trial=True,
            current_period_end=datetime.now(timezone.utc) + timedelta(days=3),
            currency="USD",
            region="US",
        )
        db_session.add(sub)
        await db_session.flush()

        count = await run_trial_expiration(db_session)
        assert count == 0
        await db_session.refresh(sub)
        assert sub.status == SubscriptionStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_does_not_expire_paid_subscriptions(self, db_session):
        from src.jobs.trial_expiration import run_trial_expiration

        user = await _create_user(db_session)
        sub = Subscription(
            user_id=user.id,
            provider_name="revenuecat",
            status=SubscriptionStatus.ACTIVE,
            is_trial=False,
            current_period_end=datetime.now(timezone.utc) - timedelta(hours=1),
            currency="USD",
            region="US",
        )
        db_session.add(sub)
        await db_session.flush()

        count = await run_trial_expiration(db_session)
        assert count == 0
        await db_session.refresh(sub)
        assert sub.status == SubscriptionStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_no_trials_returns_zero(self, db_session):
        from src.jobs.trial_expiration import run_trial_expiration

        count = await run_trial_expiration(db_session)
        assert count == 0
