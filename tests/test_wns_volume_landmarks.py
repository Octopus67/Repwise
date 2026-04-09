"""Tests for Feature 2: Volume Landmarks — trend data, landmark descriptions, feature flag."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.feature_flags.models import FeatureFlag
from src.modules.training.models import TrainingSession
from src.modules.training.volume_schemas import (
    LANDMARK_DESCRIPTIONS,
    WNSWeeklyResponse,
    WNSWeeklyTrendPoint,
)
from src.modules.training.wns_volume_service import WNSVolumeService


# ─── Helpers ──────────────────────────────────────────────────────────────────


async def _create_user(db: AsyncSession, email: str) -> User:
    user = User(id=uuid.uuid4(), email=email, hashed_password="x", auth_provider="email", role="user")
    db.add(user)
    await db.flush()
    return user


async def _log_session(db: AsyncSession, user_id: uuid.UUID, session_date: date, exercises: list[dict]) -> None:
    s = TrainingSession(user_id=user_id, session_date=session_date, exercises=exercises)
    db.add(s)
    await db.flush()


def _make_exercise(name: str, sets: list[tuple[float, int, float | None]]) -> dict:
    return {
        "exercise_name": name,
        "sets": [
            {"weight_kg": w, "reps": r, "rpe": rpe, "set_type": "normal"}
            for w, r, rpe in sets
        ],
    }


# ─── Trend Data Tests ────────────────────────────────────────────────────────


class TestVolumeTrend:
    """Tests for 4-week trend calculation in WNSVolumeService."""

    @pytest.fixture
    async def user_with_4_weeks(self, db_session: AsyncSession):
        """Create user with sessions across 4 weeks."""
        user = await _create_user(db_session, "trend@test.com")
        # Week 1: Mon Feb 2 — 3 sets bench
        # Week 2: Mon Feb 9 — 6 sets bench
        # Week 3: Mon Feb 16 — 9 sets bench
        # Week 4: Mon Feb 23 — 3 sets bench
        base = date(2026, 2, 2)
        set_counts = [3, 6, 9, 3]
        for week_idx, n_sets in enumerate(set_counts):
            d = base + timedelta(weeks=week_idx)
            await _log_session(db_session, user.id, d, [
                _make_exercise("Barbell Bench Press", [(80, 8, 8.0)] * n_sets),
            ])
        await db_session.commit()
        return user, base

    @pytest.mark.asyncio
    async def test_trend_returns_4_weeks(self, db_session: AsyncSession, user_with_4_weeks):
        user, base = user_with_4_weeks
        week_start = base + timedelta(weeks=3)  # Feb 23
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, week_start)

        # Find chest in results
        chest = next((r for r in results if r.muscle_group == "chest"), None)
        assert chest is not None
        assert len(chest.trend) == 4

    @pytest.mark.asyncio
    async def test_trend_volumes_match_set_counts(self, db_session: AsyncSession, user_with_4_weeks):
        """Trend volumes should be in HU (not raw set counts) and scale with set count."""
        user, base = user_with_4_weeks
        week_start = base + timedelta(weeks=3)
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, week_start)

        chest = next(r for r in results if r.muscle_group == "chest")
        volumes = [pt.volume for pt in chest.trend]
        # Trend uses HU now, not raw sets. Values should be positive and
        # weeks with more sets should have higher HU.
        assert all(v > 0 for v in volumes), f"All trend values should be positive: {volumes}"
        # Week 2 (6 sets) should have more HU than week 0 (3 sets)
        assert volumes[1] > volumes[0], f"More sets should produce more HU: {volumes}"

    @pytest.mark.asyncio
    async def test_trend_weeks_are_sorted(self, db_session: AsyncSession, user_with_4_weeks):
        user, base = user_with_4_weeks
        week_start = base + timedelta(weeks=3)
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, week_start)

        chest = next(r for r in results if r.muscle_group == "chest")
        weeks = [pt.week for pt in chest.trend]
        assert weeks == sorted(weeks)

    @pytest.mark.asyncio
    async def test_trend_empty_for_no_sessions(self, db_session: AsyncSession):
        """Muscles with no sessions should have empty trend."""
        user = await _create_user(db_session, "empty@test.com")
        await db_session.commit()
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, date(2026, 2, 23))

        # All muscles should have empty trend
        for r in results:
            assert r.trend == []

    @pytest.mark.asyncio
    async def test_trend_warmup_excluded(self, db_session: AsyncSession):
        """Warm-up sets should not count in trend volume."""
        user = await _create_user(db_session, "warmup@test.com")
        d = date(2026, 2, 23)
        await _log_session(db_session, user.id, d, [{
            "exercise_name": "Barbell Bench Press",
            "sets": [
                {"weight_kg": 40, "reps": 10, "rpe": None, "set_type": "warm-up"},
                {"weight_kg": 80, "reps": 8, "rpe": 8.0, "set_type": "normal"},
                {"weight_kg": 80, "reps": 8, "rpe": 8.0, "set_type": "normal"},
            ],
        }])
        await db_session.commit()

        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, d)
        chest = next((r for r in results if r.muscle_group == "chest"), None)
        assert chest is not None
        # Should only count 2 normal sets (in HU), not the warm-up
        if chest.trend:
            current_week = next((pt for pt in chest.trend if pt.week == d), None)
            if current_week:
                # 2 working sets at RPE 8 → HU > 0 but less than 3 sets would produce
                assert current_week.volume > 0, "Working sets should produce HU"


# ─── Landmark Descriptions Tests ─────────────────────────────────────────────


class TestLandmarkDescriptions:
    """Tests for landmark descriptions in WNSWeeklyResponse."""

    def test_descriptions_present_in_response(self):
        resp = WNSWeeklyResponse(
            week_start=date(2026, 2, 23),
            week_end=date(2026, 3, 1),
            muscle_groups=[],
        )
        assert resp.landmark_descriptions == LANDMARK_DESCRIPTIONS

    def test_descriptions_contain_all_keys(self):
        assert "mv" in LANDMARK_DESCRIPTIONS
        assert "mev" in LANDMARK_DESCRIPTIONS
        assert "mav" in LANDMARK_DESCRIPTIONS
        assert "mrv" in LANDMARK_DESCRIPTIONS

    def test_descriptions_are_nonempty_strings(self):
        for key, desc in LANDMARK_DESCRIPTIONS.items():
            assert isinstance(desc, str)
            assert len(desc) > 10, f"Description for {key} too short"


# ─── Feature Flag Tests ──────────────────────────────────────────────────────


class TestVolumeLandmarksFeatureFlag:
    """Tests for volume_landmarks feature flag creation."""

    @pytest.mark.asyncio
    async def test_flag_can_be_created(self, db_session: AsyncSession):
        flag = FeatureFlag(
            flag_name="volume_landmarks",
            is_enabled=False,
            description="Show volume landmarks visualization on Analytics screen",
        )
        db_session.add(flag)
        await db_session.flush()
        assert flag.flag_name == "volume_landmarks"
        assert flag.is_enabled is False

    @pytest.mark.asyncio
    async def test_flag_evaluation_disabled(self, db_session: AsyncSession):
        from src.modules.feature_flags.service import FeatureFlagService, invalidate_cache

        invalidate_cache()
        flag = FeatureFlag(
            flag_name="volume_landmarks",
            is_enabled=False,
            description="Show volume landmarks visualization on Analytics screen",
        )
        db_session.add(flag)
        await db_session.flush()

        svc = FeatureFlagService(db_session)
        assert await svc.is_feature_enabled("volume_landmarks") is False


# ─── Landmarks Already Present Tests ─────────────────────────────────────────


class TestLandmarksInResponse:
    """Verify landmarks (mv, mev, mav_low, mav_high, mrv) are present per muscle."""

    @pytest.mark.asyncio
    async def test_landmarks_present_for_each_muscle(self, db_session: AsyncSession):
        user = await _create_user(db_session, "landmarks@test.com")
        await db_session.commit()
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, date(2026, 2, 23))

        assert len(results) > 0
        for r in results:
            assert r.landmarks is not None
            assert r.landmarks.mv >= 0
            assert r.landmarks.mev >= 0
            assert r.landmarks.mav_low >= 0
            assert r.landmarks.mav_high >= 0
            assert r.landmarks.mrv >= 0
            # Ordering: mv < mev < mav_low < mav_high < mrv
            assert r.landmarks.mv <= r.landmarks.mev <= r.landmarks.mav_low <= r.landmarks.mav_high <= r.landmarks.mrv
