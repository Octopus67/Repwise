"""Property-based tests for Adaptive Coaching Tiers (Feature 3).

Tests Properties 5-8 from the design document using Hypothesis.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import given, settings as h_settings, strategies as st, HealthCheck
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.coaching_service import CoachingService, MIN_BODYWEIGHT_ENTRIES
from src.modules.adaptive.models import AdaptiveSnapshot, CoachingSuggestion
from src.modules.adaptive.schemas import MacroTargets
from src.modules.auth.models import User
from src.modules.user.models import BodyweightLog, UserGoal, UserMetric, UserProfile
from src.shared.types import GoalType


# Common hypothesis settings for DB-backed property tests
_db_settings = h_settings(
    max_examples=10,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(db: AsyncSession) -> uuid.UUID:
    """Create a test user and return its ID."""
    user = User(email=f"test-{uuid.uuid4()}@example.com", hashed_password="hashed")
    db.add(user)
    await db.flush()
    return user.id


async def _create_profile(
    db: AsyncSession, user_id: uuid.UUID, coaching_mode: str = "coached",
) -> UserProfile:
    profile = UserProfile(user_id=user_id, coaching_mode=coaching_mode)
    db.add(profile)
    await db.flush()
    return profile


async def _create_bodyweight_entries(
    db: AsyncSession,
    user_id: uuid.UUID,
    count: int,
    base_weight: float = 80.0,
    daily_change: float = -0.05,
) -> list[BodyweightLog]:
    """Create bodyweight entries for the last `count` days."""
    entries = []
    today = date.today()
    for i in range(count):
        d = today - timedelta(days=count - 1 - i)
        weight = base_weight + daily_change * i
        log = BodyweightLog(user_id=user_id, weight_kg=round(weight, 2), recorded_date=d)
        db.add(log)
        entries.append(log)
    await db.flush()
    return entries


async def _create_goal(
    db: AsyncSession, user_id: uuid.UUID,
    goal_type: str = "cutting", rate: float = -0.5,
) -> UserGoal:
    goal = UserGoal(
        user_id=user_id,
        goal_type=goal_type,
        goal_rate_per_week=rate,
    )
    db.add(goal)
    await db.flush()
    return goal


async def _create_metrics(
    db: AsyncSession, user_id: uuid.UUID,
    height_cm: float = 175.0, activity_level: str = "moderate",
) -> UserMetric:
    metric = UserMetric(
        user_id=user_id,
        height_cm=height_cm,
        weight_kg=80.0,
        activity_level=activity_level,
    )
    db.add(metric)
    await db.flush()
    return metric


# ---------------------------------------------------------------------------
# Property 5: Coached mode weekly recalculation
# ---------------------------------------------------------------------------


class TestProperty5CoachedMode:
    """Property 5: Coached mode weekly recalculation.

    For any user in 'coached' mode with at least 7 days of bodyweight data,
    triggering a weekly check-in should produce a WeeklyCheckinResponse where
    has_sufficient_data=True and new_targets is non-null with calories >= 1200.

    **Validates: Requirements 3.2.1**
    """

    @pytest.mark.asyncio
    @_db_settings
    @given(
        num_entries=st.integers(min_value=7, max_value=14),
        base_weight=st.floats(min_value=50.0, max_value=150.0),
    )
    async def test_coached_mode_produces_valid_targets(
        self, db_session: AsyncSession, num_entries: int, base_weight: float,
    ):
        """Coached mode with sufficient data produces non-null targets with calories >= 1200.

        **Validates: Requirements 3.2.1**
        """
        user_id = await _create_user(db_session)
        await _create_profile(db_session, user_id, coaching_mode="coached")
        await _create_bodyweight_entries(db_session, user_id, count=num_entries, base_weight=base_weight)
        await _create_goal(db_session, user_id)
        await _create_metrics(db_session, user_id)

        service = CoachingService(db_session)
        result = await service.generate_weekly_checkin(user_id)

        assert result.has_sufficient_data is True
        assert result.new_targets is not None
        assert result.new_targets.calories >= 1200
        assert result.new_targets.protein_g >= 0
        assert result.new_targets.carbs_g >= 0
        assert result.new_targets.fat_g >= 0
        assert result.coaching_mode == "coached"


# ---------------------------------------------------------------------------
# Property 6: Check-in card completeness
# ---------------------------------------------------------------------------


class TestProperty6CheckinCompleteness:
    """Property 6: Check-in card completeness.

    For any weekly check-in result where has_sufficient_data=True, the response
    should contain non-null weight_trend, and a non-empty explanation string
    that contains at least one of 'lost', 'gained', or 'maintained'.

    **Validates: Requirements 3.2.2, 3.2.3**
    """

    @pytest.mark.asyncio
    @_db_settings
    @given(
        base_weight=st.floats(min_value=50.0, max_value=150.0),
        daily_change=st.floats(min_value=-0.3, max_value=0.3),
    )
    async def test_checkin_contains_weight_trend_and_explanation(
        self, db_session: AsyncSession, base_weight: float, daily_change: float,
    ):
        """Check-in response contains weight_trend and explanation with direction keyword.

        **Validates: Requirements 3.2.2, 3.2.3**
        """
        user_id = await _create_user(db_session)
        await _create_profile(db_session, user_id, coaching_mode="coached")
        await _create_bodyweight_entries(
            db_session, user_id, count=10, base_weight=base_weight, daily_change=daily_change,
        )
        await _create_goal(db_session, user_id)
        await _create_metrics(db_session, user_id)

        service = CoachingService(db_session)
        result = await service.generate_weekly_checkin(user_id)

        assert result.has_sufficient_data is True
        assert result.weight_trend is not None
        assert result.explanation != ""
        # Explanation must contain a weight direction keyword
        explanation_lower = result.explanation.lower()
        assert any(
            kw in explanation_lower for kw in ["lost", "gained", "maintained"]
        ), f"Explanation missing direction keyword: {result.explanation}"


# ---------------------------------------------------------------------------
# Property 7: Manual mode target invariance
# ---------------------------------------------------------------------------


class TestProperty7ManualMode:
    """Property 7: Manual mode target invariance.

    For any user in 'manual' mode, the weekly check-in should return
    current targets unchanged, and no CoachingSuggestion should be created.

    **Validates: Requirements 3.3.3**
    """

    @pytest.mark.asyncio
    async def test_manual_mode_no_suggestion_created(self, db_session: AsyncSession):
        """Manual mode returns targets without creating a CoachingSuggestion.

        **Validates: Requirements 3.3.3**
        """
        user_id = await _create_user(db_session)
        await _create_profile(db_session, user_id, coaching_mode="manual")
        await _create_bodyweight_entries(db_session, user_id, count=10)
        await _create_goal(db_session, user_id)
        await _create_metrics(db_session, user_id)

        service = CoachingService(db_session)
        result = await service.generate_weekly_checkin(user_id)

        assert result.has_sufficient_data is True
        assert result.suggestion_id is None
        assert result.coaching_mode == "manual"

        # Verify no CoachingSuggestion was created
        stmt = select(CoachingSuggestion).where(CoachingSuggestion.user_id == user_id)
        suggestions = (await db_session.execute(stmt)).scalars().all()
        assert len(suggestions) == 0


# ---------------------------------------------------------------------------
# Property 8: Insufficient data handling
# ---------------------------------------------------------------------------


class TestProperty8InsufficientData:
    """Property 8: Insufficient data handling.

    For any user with fewer than 7 bodyweight log entries, the weekly check-in
    should return has_sufficient_data=False, days_remaining = 7 - count,
    and new_targets=None.

    **Validates: Requirements 3.3.4, 3.3.5**
    """

    @pytest.mark.asyncio
    @_db_settings
    @given(num_entries=st.integers(min_value=0, max_value=6))
    async def test_insufficient_data_returns_correct_response(
        self, db_session: AsyncSession, num_entries: int,
    ):
        """<7 days returns has_sufficient_data=false with correct days_remaining.

        **Validates: Requirements 3.3.4, 3.3.5**
        """
        user_id = await _create_user(db_session)
        await _create_profile(db_session, user_id, coaching_mode="coached")
        if num_entries > 0:
            await _create_bodyweight_entries(db_session, user_id, count=num_entries)

        service = CoachingService(db_session)
        result = await service.generate_weekly_checkin(user_id)

        assert result.has_sufficient_data is False
        assert result.days_remaining == MIN_BODYWEIGHT_ENTRIES - num_entries
        assert result.new_targets is None
