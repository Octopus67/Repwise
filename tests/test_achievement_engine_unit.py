"""Unit tests for the Achievement Engine.

Tests cover:
- Streak calculation (consecutive days, gaps, same-day idempotency, future dates)
- PR badge detection (threshold matching, exercise alias resolution, duplicate prevention)
- Volume tracking (accumulation, negative/invalid input guards)
- Nutrition compliance (within tolerance, outside tolerance, None targets)
- Edge cases: zero data, first-time user, duplicate unlock prevention
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.achievements.engine import AchievementEngine
from src.modules.achievements.models import AchievementProgress, UserAchievement
from src.modules.achievements.definitions import ACHIEVEMENT_REGISTRY


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_id() -> uuid.UUID:
    return uuid.uuid4()


def _make_exercises(
    name: str = "bench press",
    sets: list[dict] | None = None,
) -> list[dict]:
    if sets is None:
        sets = [{"weight_kg": 100, "reps": 5}]
    return [{"exercise_name": name, "sets": sets}]


# ---------------------------------------------------------------------------
# Streak Tests
# ---------------------------------------------------------------------------

class TestStreakCalculation:
    """Tests for _update_streak via evaluate_training_session."""

    @pytest.mark.asyncio
    async def test_first_activity_starts_streak_at_1(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        today = date.today()

        await engine._update_streak(user, today)
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "streak")
        assert progress.current_value == 1
        assert progress.metadata_["last_active_date"] == today.isoformat()

    @pytest.mark.asyncio
    async def test_consecutive_days_increment_streak(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        day1 = date(2024, 6, 1)
        day2 = date(2024, 6, 2)
        day3 = date(2024, 6, 3)

        await engine._update_streak(user, day1)
        await engine._update_streak(user, day2)
        await engine._update_streak(user, day3)
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "streak")
        assert progress.current_value == 3

    @pytest.mark.asyncio
    async def test_gap_resets_streak_to_1(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        day1 = date(2024, 6, 1)
        day3 = date(2024, 6, 3)  # gap on day 2

        await engine._update_streak(user, day1)
        await engine._update_streak(user, day3)
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "streak")
        assert progress.current_value == 1

    @pytest.mark.asyncio
    async def test_same_day_is_idempotent(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        today = date(2024, 6, 1)

        await engine._update_streak(user, today)
        await engine._update_streak(user, today)
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "streak")
        assert progress.current_value == 1

    @pytest.mark.asyncio
    async def test_longest_streak_tracked(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        # Build a 3-day streak
        for i in range(3):
            await engine._update_streak(user, date(2024, 6, 1) + timedelta(days=i))

        # Gap, then 1-day streak
        await engine._update_streak(user, date(2024, 6, 10))
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "streak")
        assert progress.current_value == 1
        assert progress.metadata_["longest_streak"] == 3

    @pytest.mark.asyncio
    async def test_streak_7_unlocks_achievement(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        all_unlocked = []
        for i in range(7):
            result = await engine._update_streak(user, date(2024, 6, 1) + timedelta(days=i))
            all_unlocked.extend(result)
        await db_session.flush()

        ids = [u.achievement_id for u in all_unlocked]
        assert "streak_7" in ids

    @pytest.mark.asyncio
    async def test_future_date_ignored(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        future = date.today() + timedelta(days=30)

        result = await engine._update_streak(user, future)
        assert result == []


# ---------------------------------------------------------------------------
# PR Badge Tests
# ---------------------------------------------------------------------------

class TestPRBadges:
    """Tests for _check_pr_badges."""

    @pytest.mark.asyncio
    async def test_bench_1plate_unlocks_at_60kg(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        exercises = _make_exercises("bench press", [{"weight_kg": 60, "reps": 1}])

        result = await engine._check_pr_badges(user, exercises)
        ids = [u.achievement_id for u in result]
        assert "pr_bench_1plate" in ids

    @pytest.mark.asyncio
    async def test_bench_below_threshold_no_unlock(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        exercises = _make_exercises("bench press", [{"weight_kg": 59, "reps": 1}])

        result = await engine._check_pr_badges(user, exercises)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_unknown_exercise_no_unlock(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        exercises = _make_exercises("lateral raise", [{"weight_kg": 200, "reps": 1}])

        result = await engine._check_pr_badges(user, exercises)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_duplicate_unlock_prevented(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        exercises = _make_exercises("bench press", [{"weight_kg": 60, "reps": 1}])

        result1 = await engine._check_pr_badges(user, exercises)
        await db_session.flush()
        result2 = await engine._check_pr_badges(user, exercises)

        assert len(result1) >= 1
        # Second call should not re-unlock the same badge
        ids2 = [u.achievement_id for u in result2]
        assert "pr_bench_1plate" not in ids2

    @pytest.mark.asyncio
    async def test_exercise_alias_resolution(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        # "Flat Barbell Bench Press" should resolve to bench_press group
        exercises = _make_exercises("Flat Barbell Bench Press", [{"weight_kg": 100, "reps": 1}])

        result = await engine._check_pr_badges(user, exercises)
        ids = [u.achievement_id for u in result]
        assert "pr_bench_1plate" in ids
        assert "pr_bench_2plate" in ids

    @pytest.mark.asyncio
    async def test_invalid_weight_type_skipped(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        exercises = _make_exercises("bench press", [{"weight_kg": "not_a_number", "reps": 1}])

        result = await engine._check_pr_badges(user, exercises)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_empty_exercise_name_skipped(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()
        exercises = [{"exercise_name": "", "sets": [{"weight_kg": 100, "reps": 1}]}]

        result = await engine._check_pr_badges(user, exercises)
        assert len(result) == 0


# ---------------------------------------------------------------------------
# Volume Tests
# ---------------------------------------------------------------------------

class TestVolumeTracking:
    """Tests for _update_volume."""

    @pytest.mark.asyncio
    async def test_volume_accumulates(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        # 100kg * 5 reps = 500 kg
        exercises = _make_exercises("bench press", [{"weight_kg": 100, "reps": 5}])
        await engine._update_volume(user, exercises)
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "lifetime_volume")
        assert progress.current_value == 500.0

    @pytest.mark.asyncio
    async def test_volume_accumulates_across_sessions(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        exercises = _make_exercises("bench press", [{"weight_kg": 100, "reps": 5}])
        await engine._update_volume(user, exercises)
        await engine._update_volume(user, exercises)
        await db_session.flush()

        progress = await engine._get_or_create_progress(user, "lifetime_volume")
        assert progress.current_value == 1000.0

    @pytest.mark.asyncio
    async def test_zero_volume_no_update(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        exercises = _make_exercises("bench press", [{"weight_kg": 0, "reps": 10}])
        result = await engine._update_volume(user, exercises)
        assert result == []

    @pytest.mark.asyncio
    async def test_negative_weight_ignored(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        exercises = _make_exercises("bench press", [{"weight_kg": -50, "reps": 10}])
        result = await engine._update_volume(user, exercises)
        assert result == []

    @pytest.mark.asyncio
    async def test_invalid_reps_type_skipped(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        exercises = _make_exercises("bench press", [{"weight_kg": 100, "reps": "abc"}])
        result = await engine._update_volume(user, exercises)
        assert result == []

    @pytest.mark.asyncio
    async def test_volume_10k_unlocks(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        # 500kg * 10 reps * 2 sets = 10000 kg in one go
        exercises = _make_exercises("bench press", [
            {"weight_kg": 500, "reps": 10},
            {"weight_kg": 500, "reps": 10},
        ])
        result = await engine._update_volume(user, exercises)
        ids = [u.achievement_id for u in result]
        assert "volume_10k" in ids


# ---------------------------------------------------------------------------
# Nutrition Compliance Tests
# ---------------------------------------------------------------------------

class TestNutritionCompliance:
    """Tests for _is_compliant static method."""

    def test_within_tolerance(self):
        # All actuals within 5% of targets
        assert AchievementEngine._is_compliant(
            actuals=(2000, 150, 250, 70),
            targets=(2000, 150, 250, 70),
        ) is True

    def test_outside_tolerance(self):
        # Calories way off
        assert AchievementEngine._is_compliant(
            actuals=(3000, 150, 250, 70),
            targets=(2000, 150, 250, 70),
        ) is False

    def test_zero_target_returns_false(self):
        assert AchievementEngine._is_compliant(
            actuals=(2000, 150, 250, 70),
            targets=(0, 150, 250, 70),
        ) is False

    def test_none_target_returns_false(self):
        assert AchievementEngine._is_compliant(
            actuals=(2000, 150, 250, 70),
            targets=(None, 150, 250, 70),
        ) is False

    def test_none_actual_returns_false(self):
        assert AchievementEngine._is_compliant(
            actuals=(None, 150, 250, 70),
            targets=(2000, 150, 250, 70),
        ) is False

    def test_edge_of_tolerance(self):
        # Exactly 5% over on calories: 2100 / 2000 = 1.05 → abs diff / target = 0.05
        assert AchievementEngine._is_compliant(
            actuals=(2100, 150, 250, 70),
            targets=(2000, 150, 250, 70),
        ) is True

    def test_just_over_tolerance(self):
        # 5.1% over
        assert AchievementEngine._is_compliant(
            actuals=(2102, 150, 250, 70),
            targets=(2000, 150, 250, 70),
        ) is False


# ---------------------------------------------------------------------------
# Full Orchestrator Tests
# ---------------------------------------------------------------------------

class TestEvaluateTrainingSession:
    """Integration-level tests for evaluate_training_session."""

    @pytest.mark.asyncio
    async def test_empty_exercises_returns_empty(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        result = await engine.evaluate_training_session(user, [], session_date=date.today())
        assert result == []

    @pytest.mark.asyncio
    async def test_first_time_user_no_crash(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        exercises = _make_exercises("lateral raise", [{"weight_kg": 10, "reps": 12}])
        result = await engine.evaluate_training_session(user, exercises, session_date=date.today())
        # Should not crash, may return empty or volume-related unlocks
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_no_session_date_skips_streak(self, db_session: AsyncSession):
        engine = AchievementEngine(db_session)
        user = _user_id()

        exercises = _make_exercises("bench press", [{"weight_kg": 60, "reps": 1}])
        result = await engine.evaluate_training_session(user, exercises, session_date=None)
        # Should still process PR badges and volume, just skip streak
        assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Exercise Alias Tests
# ---------------------------------------------------------------------------

class TestExerciseAliases:
    """Tests for exercise alias resolution."""

    def test_case_insensitive(self):
        from src.modules.achievements.exercise_aliases import resolve_exercise_group
        assert resolve_exercise_group("BENCH PRESS") == "bench_press"
        assert resolve_exercise_group("Bench Press") == "bench_press"

    def test_whitespace_stripped(self):
        from src.modules.achievements.exercise_aliases import resolve_exercise_group
        assert resolve_exercise_group("  bench press  ") == "bench_press"

    def test_unknown_returns_none(self):
        from src.modules.achievements.exercise_aliases import resolve_exercise_group
        assert resolve_exercise_group("tricep pushdown") is None

    def test_empty_string_returns_none(self):
        from src.modules.achievements.exercise_aliases import resolve_exercise_group
        assert resolve_exercise_group("") is None


# ---------------------------------------------------------------------------
# Achievement Registry Tests
# ---------------------------------------------------------------------------

class TestAchievementRegistry:
    """Tests for the static achievement definitions."""

    def test_all_ids_unique(self):
        ids = [d.id for d in ACHIEVEMENT_REGISTRY.values()]
        assert len(ids) == len(set(ids))

    def test_all_thresholds_positive(self):
        for defn in ACHIEVEMENT_REGISTRY.values():
            assert defn.threshold > 0, f"{defn.id} has non-positive threshold"

    def test_pr_badges_have_exercise_group(self):
        from src.modules.achievements.definitions import AchievementCategory
        for defn in ACHIEVEMENT_REGISTRY.values():
            if defn.category == AchievementCategory.PR_BADGE:
                assert defn.exercise_group is not None, f"{defn.id} missing exercise_group"

    def test_non_pr_badges_have_no_exercise_group(self):
        from src.modules.achievements.definitions import AchievementCategory
        for defn in ACHIEVEMENT_REGISTRY.values():
            if defn.category != AchievementCategory.PR_BADGE:
                assert defn.exercise_group is None, f"{defn.id} should not have exercise_group"
