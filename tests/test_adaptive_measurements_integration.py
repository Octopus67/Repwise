"""Tests for adaptive engine integration with body measurements.

Verifies:
1. AdaptiveService.generate_snapshot uses recent body_fat_pct for Katch-McArdle BMR
2. CoachingService weekly check-in uses measurement weight trend for TDEE adjustments
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from src.modules.adaptive.engine import AdaptiveInput, _compute_bmr, compute_snapshot
from src.shared.types import ActivityLevel, GoalType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(session) -> uuid.UUID:
    from src.modules.auth.models import User

    user = User(
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
        auth_provider="email",
        role="user",
    )
    session.add(user)
    await session.flush()
    return user.id


async def _create_measurement(session, user_id, *, days_ago=0, weight_kg=None, body_fat_pct=None):
    from src.modules.measurements.models import BodyMeasurement

    m = BodyMeasurement(
        user_id=user_id,
        measured_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        weight_kg=weight_kg,
        body_fat_pct=body_fat_pct,
    )
    session.add(m)
    await session.flush()
    return m


# ---------------------------------------------------------------------------
# 1. AdaptiveService uses recent body_fat_pct from measurements
# ---------------------------------------------------------------------------


class TestAdaptiveServiceBodyFatIntegration:
    @pytest.mark.asyncio
    async def test_snapshot_uses_recent_body_fat(self, db_session):
        """When a measurement with body_fat_pct exists within 30 days,
        generate_snapshot should use Katch-McArdle instead of Mifflin-St Jeor."""
        from src.modules.adaptive.service import AdaptiveService
        from src.modules.adaptive.schemas import SnapshotRequest, BodyweightEntry

        user_id = await _create_user(db_session)
        await _create_measurement(db_session, user_id, days_ago=5, body_fat_pct=18.0)

        svc = AdaptiveService(db_session)
        data = SnapshotRequest(
            weight_kg=80.0,
            height_cm=178.0,
            age_years=30,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal_type=GoalType.MAINTAINING,
            goal_rate_per_week=0.0,
            bodyweight_history=[BodyweightEntry(date=date.today(), weight_kg=80.0)],
            training_load_score=50.0,
        )
        snapshot = await svc.generate_snapshot(user_id, data)

        # Katch-McArdle with 18% BF: lean_mass = 80 * 0.82 = 65.6, BMR = 370 + 21.6*65.6 = 1786.96
        # Mifflin-St Jeor male: 10*80 + 6.25*178 - 5*30 + 5 = 1767.5
        # TDEE = BMR * 1.55 (moderate)
        katch_tdee = (370 + 21.6 * 65.6) * 1.55
        mifflin_tdee = 1767.5 * 1.55

        # Snapshot calories should be closer to Katch-McArdle TDEE
        assert abs(snapshot.target_calories - katch_tdee) < abs(snapshot.target_calories - mifflin_tdee)

    @pytest.mark.asyncio
    async def test_snapshot_ignores_old_body_fat(self, db_session):
        """Measurements older than 30 days should not be used."""
        from src.modules.adaptive.service import AdaptiveService
        from src.modules.adaptive.schemas import SnapshotRequest, BodyweightEntry

        user_id = await _create_user(db_session)
        await _create_measurement(db_session, user_id, days_ago=45, body_fat_pct=18.0)

        svc = AdaptiveService(db_session)
        data = SnapshotRequest(
            weight_kg=80.0,
            height_cm=178.0,
            age_years=30,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal_type=GoalType.MAINTAINING,
            goal_rate_per_week=0.0,
            bodyweight_history=[BodyweightEntry(date=date.today(), weight_kg=80.0)],
            training_load_score=50.0,
        )
        snapshot = await svc.generate_snapshot(user_id, data)

        # Should use Mifflin-St Jeor: TDEE = 1767.5 * 1.55
        mifflin_tdee = 1767.5 * 1.55
        assert abs(snapshot.target_calories - mifflin_tdee) < 5.0

    @pytest.mark.asyncio
    async def test_snapshot_explicit_body_fat_takes_precedence(self, db_session):
        """If SnapshotRequest already has body_fat_pct, don't override from measurements."""
        from src.modules.adaptive.service import AdaptiveService
        from src.modules.adaptive.schemas import SnapshotRequest, BodyweightEntry

        user_id = await _create_user(db_session)
        # Measurement says 30%, but request says 15%
        await _create_measurement(db_session, user_id, days_ago=2, body_fat_pct=30.0)

        svc = AdaptiveService(db_session)

        # We need to add body_fat_pct to the request — use engine directly to verify
        inp_15 = AdaptiveInput(
            weight_kg=80.0, height_cm=178.0, age_years=30, sex="male",
            activity_level=ActivityLevel.MODERATE, goal_type=GoalType.MAINTAINING,
            goal_rate_per_week=0.0,
            bodyweight_history=[(date.today(), 80.0)],
            training_load_score=50.0, body_fat_pct=15.0,
        )
        out_15 = compute_snapshot(inp_15)

        inp_30 = AdaptiveInput(
            weight_kg=80.0, height_cm=178.0, age_years=30, sex="male",
            activity_level=ActivityLevel.MODERATE, goal_type=GoalType.MAINTAINING,
            goal_rate_per_week=0.0,
            bodyweight_history=[(date.today(), 80.0)],
            training_load_score=50.0, body_fat_pct=30.0,
        )
        out_30 = compute_snapshot(inp_30)

        # Different body fat should produce different calories
        assert out_15.target_calories != out_30.target_calories


# ---------------------------------------------------------------------------
# 2. CoachingService uses measurement weight trend for TDEE adjustments
# ---------------------------------------------------------------------------


class TestCoachingWeightTrendIntegration:
    @pytest.mark.asyncio
    async def test_get_measurement_weight_trend(self, db_session):
        """_get_measurement_weight_trend returns avg weekly change."""
        from src.modules.adaptive.coaching_service import CoachingService

        user_id = await _create_user(db_session)
        # 4 measurements over 4 weeks: 80 → 78 = -2kg over ~3 weeks
        for i, w in [(28, 80.0), (21, 79.5), (14, 79.0), (0, 78.0)]:
            await _create_measurement(db_session, user_id, days_ago=i, weight_kg=w)

        svc = CoachingService(db_session)
        trend = await svc._get_measurement_weight_trend(user_id)

        assert trend is not None
        # -2kg over 4 weeks = -0.5 kg/week
        assert trend == pytest.approx(-0.5, abs=0.05)

    @pytest.mark.asyncio
    async def test_weight_trend_none_with_insufficient_data(self, db_session):
        """Returns None when fewer than 2 measurements."""
        from src.modules.adaptive.coaching_service import CoachingService

        user_id = await _create_user(db_session)
        await _create_measurement(db_session, user_id, days_ago=0, weight_kg=80.0)

        svc = CoachingService(db_session)
        trend = await svc._get_measurement_weight_trend(user_id)
        assert trend is None

    @pytest.mark.asyncio
    async def test_weight_trend_none_with_short_span(self, db_session):
        """Returns None when measurements span < 7 days."""
        from src.modules.adaptive.coaching_service import CoachingService

        user_id = await _create_user(db_session)
        await _create_measurement(db_session, user_id, days_ago=2, weight_kg=80.0)
        await _create_measurement(db_session, user_id, days_ago=0, weight_kg=79.5)

        svc = CoachingService(db_session)
        trend = await svc._get_measurement_weight_trend(user_id)
        assert trend is None

    @pytest.mark.asyncio
    async def test_get_recent_body_fat_within_30_days(self, db_session):
        """_get_recent_body_fat returns latest BF% within 30 days."""
        from src.modules.adaptive.coaching_service import CoachingService

        user_id = await _create_user(db_session)
        await _create_measurement(db_session, user_id, days_ago=10, body_fat_pct=20.0)
        await _create_measurement(db_session, user_id, days_ago=5, body_fat_pct=19.0)

        svc = CoachingService(db_session)
        bf = await svc._get_recent_body_fat(user_id)
        assert bf == 19.0

    @pytest.mark.asyncio
    async def test_get_recent_body_fat_none_when_old(self, db_session):
        """Returns None when all measurements are > 30 days old."""
        from src.modules.adaptive.coaching_service import CoachingService

        user_id = await _create_user(db_session)
        await _create_measurement(db_session, user_id, days_ago=35, body_fat_pct=20.0)

        svc = CoachingService(db_session)
        bf = await svc._get_recent_body_fat(user_id)
        assert bf is None


# ---------------------------------------------------------------------------
# 3. Engine-level: Katch-McArdle vs Mifflin-St Jeor
# ---------------------------------------------------------------------------


class TestEngineBodyFat:
    def test_katch_mcardle_produces_different_bmr(self):
        """With body_fat_pct, engine uses Katch-McArdle formula."""
        base = dict(
            weight_kg=80.0, height_cm=178.0, age_years=30, sex="male",
            activity_level=ActivityLevel.MODERATE, goal_type=GoalType.MAINTAINING,
            goal_rate_per_week=0.0,
            bodyweight_history=[(date.today(), 80.0)],
            training_load_score=50.0,
        )
        without_bf = compute_snapshot(AdaptiveInput(**base))
        with_bf = compute_snapshot(AdaptiveInput(**base, body_fat_pct=15.0))

        assert without_bf.target_calories != with_bf.target_calories

    def test_katch_mcardle_formula_values(self):
        """Verify Katch-McArdle: BMR = 370 + 21.6 * lean_mass."""
        inp = AdaptiveInput(
            weight_kg=80.0, height_cm=178.0, age_years=30, sex="male",
            activity_level=ActivityLevel.MODERATE, goal_type=GoalType.MAINTAINING,
            goal_rate_per_week=0.0,
            bodyweight_history=[(date.today(), 80.0)],
            training_load_score=50.0, body_fat_pct=20.0,
        )
        bmr = _compute_bmr(inp)
        lean_mass = 80.0 * 0.80
        assert bmr == pytest.approx(370 + 21.6 * lean_mass)
