"""Phase 6: Edge Cases & Negative Tests.

Validates boundary conditions, invalid inputs, duplicate handling,
and concurrent operations to ensure the API is robust.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.lifecycle.api_client import LifecycleClient
from tests.lifecycle.personas import (
    PERSONA_A,
    PersonaProfile,
)


SIM_START = date(2025, 1, 6)


async def _onboard(client: LifecycleClient, p: PersonaProfile) -> None:
    await client.register(p.email, p.password)
    await client.get_me()
    await client.update_profile(display_name=p.display_name)
    await client.log_metrics(
        height_cm=p.height_cm, weight_kg=p.weight_kg,
        body_fat_pct=p.body_fat_pct, activity_level=p.activity_level,
    )
    await client.set_goals(goal_type=p.goal_type, goal_rate_per_week=p.goal_rate_per_week)
    await client.log_bodyweight(p.weight_kg, SIM_START)
    await client.create_snapshot({
        "weight_kg": p.weight_kg, "height_cm": p.height_cm,
        "age_years": p.age_years, "sex": p.sex,
        "activity_level": p.activity_level, "goal_type": p.goal_type,
        "goal_rate_per_week": p.goal_rate_per_week,
        "bodyweight_history": [{"date": SIM_START.isoformat(), "weight_kg": p.weight_kg}],
        "training_load_score": 0.0,
    })


# ===========================================================================
# 6.1: Duplicate food submission
# ===========================================================================


class TestDuplicateFoodSubmission:

    @pytest.mark.asyncio
    async def test_duplicate_food_submission(self, override_get_db):
        """Log the same food entry twice rapidly — both should be created."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            entry1 = await c.log_food(
                meal_name="Chicken Breast",
                calories=300, protein_g=50, carbs_g=0, fat_g=7,
                entry_date=SIM_START,
            )
            entry2 = await c.log_food(
                meal_name="Chicken Breast",
                calories=300, protein_g=50, carbs_g=0, fat_g=7,
                entry_date=SIM_START,
            )

            assert entry1["id"] != entry2["id"], "Duplicate entries should have different IDs"

            entries = await c.get_nutrition_entries(
                start_date=SIM_START, end_date=SIM_START, limit=100,
            )
            assert entries["total_count"] == 2, (
                f"Expected 2 entries (no dedup), got {entries['total_count']}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.2: Zero calorie entry accepted
# ===========================================================================


class TestZeroCalorieEntryAccepted:

    @pytest.mark.asyncio
    async def test_zero_calorie_entry_accepted(self, override_get_db):
        """A 0-calorie entry (water, supplements) should be accepted."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            entry = await c.log_food(
                meal_name="Water",
                calories=0, protein_g=0, carbs_g=0, fat_g=0,
                entry_date=SIM_START,
            )
            assert entry["calories"] == 0
            assert entry["id"] is not None
        finally:
            await c.close()


# ===========================================================================
# 6.3: Absurd calorie entry rejected
# ===========================================================================


class TestAbsurdCalorieEntryRejected:

    @pytest.mark.asyncio
    async def test_absurd_calorie_entry_rejected(self, override_get_db):
        """99999 calories exceeds le=50000 validation → rejected."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            resp = await c.raw_post(
                "/api/v1/nutrition/entries",
                json={
                    "meal_name": "Absurd Meal",
                    "calories": 99999,
                    "protein_g": 10,
                    "carbs_g": 10,
                    "fat_g": 10,
                    "entry_date": SIM_START.isoformat(),
                },
            )
            assert resp.status_code in (400, 422), (
                f"Expected 400/422 for 99999 calories, got {resp.status_code}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.4: Negative calorie entry rejected
# ===========================================================================


class TestNegativeCalorieEntryRejected:

    @pytest.mark.asyncio
    async def test_negative_calorie_entry_rejected(self, override_get_db):
        """-100 calories violates ge=0 validation → rejected."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            resp = await c.raw_post(
                "/api/v1/nutrition/entries",
                json={
                    "meal_name": "Negative Meal",
                    "calories": -100,
                    "protein_g": 10,
                    "carbs_g": 10,
                    "fat_g": 10,
                    "entry_date": SIM_START.isoformat(),
                },
            )
            assert resp.status_code in (400, 422), (
                f"Expected 400/422 for -100 calories, got {resp.status_code}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.5: Future training date rejected
# ===========================================================================


class TestFutureTrainingDateRejected:

    @pytest.mark.asyncio
    async def test_future_training_date_rejected(self, override_get_db):
        """A training session with a future date should be rejected."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            future_date = date.today() + timedelta(days=30)
            resp = await c.raw_post(
                "/api/v1/training/sessions",
                json={
                    "session_date": future_date.isoformat(),
                    "exercises": [{
                        "exercise_name": "barbell back squat",
                        "sets": [{"reps": 5, "weight_kg": 60, "set_type": "normal"}],
                    }],
                },
            )
            assert resp.status_code in (400, 422), (
                f"Expected 400/422 for future training date, got {resp.status_code}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.6: Delete and verify recalculation
# ===========================================================================


class TestDeleteAndVerifyRecalculation:

    @pytest.mark.asyncio
    async def test_delete_and_verify_recalculation(self, override_get_db):
        """Log 3 entries, delete the middle one, verify remaining 2 sum correctly."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            meals = [
                {"meal_name": "Breakfast", "calories": 400, "protein_g": 30, "carbs_g": 40, "fat_g": 12},
                {"meal_name": "Lunch", "calories": 600, "protein_g": 45, "carbs_g": 55, "fat_g": 20},
                {"meal_name": "Dinner", "calories": 500, "protein_g": 35, "carbs_g": 45, "fat_g": 18},
            ]
            entry_ids = []
            for m in meals:
                resp = await c.log_food(
                    meal_name=m["meal_name"],
                    calories=m["calories"],
                    protein_g=m["protein_g"],
                    carbs_g=m["carbs_g"],
                    fat_g=m["fat_g"],
                    entry_date=SIM_START,
                )
                entry_ids.append(resp["id"])

            # Delete the middle entry (Lunch, 600 cal)
            await c.delete_nutrition_entry(entry_ids[1])

            entries = await c.get_nutrition_entries(
                start_date=SIM_START, end_date=SIM_START, limit=100,
            )
            assert entries["total_count"] == 2

            remaining_cals = sum(e["calories"] for e in entries["items"])
            expected = 400 + 500  # Breakfast + Dinner
            assert abs(remaining_cals - expected) < 0.01, (
                f"Expected {expected} cal after delete, got {remaining_cals}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.7: Empty exercises training session
# ===========================================================================


class TestEmptyExercisesTrainingSession:

    @pytest.mark.asyncio
    async def test_empty_exercises_training_session(self, override_get_db):
        """A training session with empty exercises list should be rejected.

        The schema requires min_length=1 for exercises.
        """
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            resp = await c.raw_post(
                "/api/v1/training/sessions",
                json={
                    "session_date": SIM_START.isoformat(),
                    "exercises": [],
                },
            )
            assert resp.status_code in (400, 422), (
                f"Expected 400/422 for empty exercises, got {resp.status_code}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.8: Concurrent food and bodyweight logging
# ===========================================================================


class TestConcurrentFoodAndBodyweightLogging:

    @pytest.mark.asyncio
    async def test_concurrent_food_and_bodyweight_logging(self, override_get_db):
        """Log food and bodyweight on the same day — both stored correctly."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            day = SIM_START + timedelta(days=1)

            food_entry = await c.log_food(
                meal_name="Post-Workout Shake",
                calories=350, protein_g=40, carbs_g=30, fat_g=8,
                entry_date=day,
            )
            bw_entry = await c.log_bodyweight(81.5, day)

            # Verify food entry
            entries = await c.get_nutrition_entries(start_date=day, end_date=day, limit=100)
            assert entries["total_count"] == 1
            assert entries["items"][0]["calories"] == 350

            # Verify bodyweight entry
            history = await c.get_bodyweight_history(limit=100)
            bw_on_day = [
                e for e in history["items"]
                if e["recorded_date"] == day.isoformat()
            ]
            assert len(bw_on_day) == 1
            assert bw_on_day[0]["weight_kg"] == 81.5
        finally:
            await c.close()


# ===========================================================================
# 6.9: Very long meal name
# ===========================================================================


class TestVeryLongMealName:

    @pytest.mark.asyncio
    async def test_very_long_meal_name(self, override_get_db):
        """255-char meal name accepted; 256-char meal name rejected."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            # 255 chars — should be accepted
            name_255 = "A" * 255
            entry = await c.log_food(
                meal_name=name_255,
                calories=100, protein_g=10, carbs_g=10, fat_g=5,
                entry_date=SIM_START,
            )
            assert entry["meal_name"] == name_255

            # 256 chars — should be rejected
            name_256 = "A" * 256
            resp = await c.raw_post(
                "/api/v1/nutrition/entries",
                json={
                    "meal_name": name_256,
                    "calories": 100,
                    "protein_g": 10,
                    "carbs_g": 10,
                    "fat_g": 5,
                    "entry_date": SIM_START.isoformat(),
                },
            )
            assert resp.status_code in (400, 422), (
                f"Expected 400/422 for 256-char meal name, got {resp.status_code}"
            )
        finally:
            await c.close()


# ===========================================================================
# 6.10: Query nonexistent date range
# ===========================================================================


class TestQueryNonexistentDateRange:

    @pytest.mark.asyncio
    async def test_query_nonexistent_date_range(self, override_get_db):
        """Query a date range with no data → empty result, not an error."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            # Query a range far in the past with no data
            empty_start = date(2020, 1, 1)
            empty_end = date(2020, 1, 31)

            entries = await c.get_nutrition_entries(
                start_date=empty_start, end_date=empty_end, limit=100,
            )
            assert entries["total_count"] == 0
            assert entries["items"] == []
        finally:
            await c.close()
