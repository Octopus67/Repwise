"""Phase 4: Cross-Feature Interaction Tests.

Verifies that features interact correctly: achievements trigger from activity,
deletions recalculate totals, inactive users can re-enter cleanly, and PRs
are detected across progressive training sessions.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.lifecycle.api_client import LifecycleClient
from tests.lifecycle.personas import (
    DAILY_PLAN_GENERATORS,
    PERSONA_A,
    PERSONA_B,
    PERSONA_D,
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


async def _simulate_day(
    client: LifecycleClient, persona: PersonaProfile, day_num: int,
) -> dict:
    gen = DAILY_PLAN_GENERATORS[persona.name]
    plan = gen(day_num)
    sim_date = SIM_START + timedelta(days=day_num)
    result = {"date": sim_date.isoformat(), "meals_logged": 0, "training_logged": False, "bw_logged": False}

    for meal in plan.meals:
        await client.log_food(
            meal_name=meal["meal_name"],
            calories=meal["calories"],
            protein_g=meal["protein_g"],
            carbs_g=meal["carbs_g"],
            fat_g=meal["fat_g"],
            entry_date=sim_date,
            micro_nutrients={"water_ml": plan.water_ml / max(len(plan.meals), 1)} if plan.water_ml > 0 else None,
        )
        result["meals_logged"] += 1

    if plan.training:
        await client.log_training(
            session_date=sim_date,
            exercises=plan.training["exercises"],
        )
        result["training_logged"] = True

    if plan.log_bodyweight is not None:
        await client.log_bodyweight(plan.log_bodyweight, sim_date)
        result["bw_logged"] = True

    return result


# ===========================================================================
# 4.1: Food logging triggers streak achievement
# ===========================================================================


class TestFoodLoggingStreakAchievement:

    @pytest.mark.asyncio
    async def test_food_logging_triggers_streak_achievement(self, override_get_db):
        """Log food for 7 consecutive days → streak_7 achievement unlocked."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            for day in range(7):
                await _simulate_day(c, PERSONA_A, day)

            achievements = await c.get_achievements()
            streak_7 = next(
                (a for a in achievements if a["definition"]["id"] == "streak_7"), None
            )
            assert streak_7 is not None, "streak_7 achievement not found"
            assert streak_7["unlocked"] is True, "streak_7 should be unlocked after 7 days"
        finally:
            await c.close()


# ===========================================================================
# 4.2: Training volume triggers achievement
# ===========================================================================


class TestTrainingVolumeAchievement:

    @pytest.mark.asyncio
    async def test_training_volume_triggers_achievement(self, override_get_db):
        """Log enough training volume to trigger volume_10k achievement.

        Persona B lifts heavy: ~3 exercises × 3 sets × 5-8 reps × 50-100 kg.
        A single session can produce ~3000+ kg volume. After a few sessions
        the 10,000 kg threshold should be crossed.
        """
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_B)

            # Simulate enough days to accumulate >10,000 kg volume
            # Persona B trains 6x/week, each session has heavy compound lifts
            for day in range(7):
                await _simulate_day(c, PERSONA_B, day)

            achievements = await c.get_achievements()
            vol_10k = next(
                (a for a in achievements if a["definition"]["id"] == "volume_10k"), None
            )
            assert vol_10k is not None, "volume_10k achievement not found"
            assert vol_10k["unlocked"] is True, (
                "volume_10k should be unlocked after a week of heavy training"
            )
        finally:
            await c.close()


# ===========================================================================
# 4.3: Bodyweight update reflected in history
# ===========================================================================


class TestBodyweightHistory:

    @pytest.mark.asyncio
    async def test_bodyweight_update_reflected_in_history(self, override_get_db):
        """Log bodyweight, verify it appears in history."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            # Log a new bodyweight entry
            new_date = SIM_START + timedelta(days=1)
            await c.log_bodyweight(81.5, new_date)

            history = await c.get_bodyweight_history(limit=100)
            dates = [e["recorded_date"] for e in history["items"]]
            weights = {e["recorded_date"]: e["weight_kg"] for e in history["items"]}

            assert new_date.isoformat() in dates, "New bodyweight entry not in history"
            assert weights[new_date.isoformat()] == 81.5
        finally:
            await c.close()


# ===========================================================================
# 4.4: Delete entry updates daily total
# ===========================================================================


class TestDeleteEntryRecalculation:

    @pytest.mark.asyncio
    async def test_delete_entry_updates_daily_total(self, override_get_db):
        """Log 3 meals, delete one, verify daily total recalculates."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            day = SIM_START
            # Log 3 meals manually
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
                    entry_date=day,
                )
                entry_ids.append(resp["id"])

            # Verify 3 entries, total = 1500 cal
            entries_before = await c.get_nutrition_entries(start_date=day, end_date=day)
            assert entries_before["total_count"] == 3
            total_before = sum(e["calories"] for e in entries_before["items"])
            assert abs(total_before - 1500) < 1

            # Delete the lunch entry (600 cal)
            await c.delete_nutrition_entry(entry_ids[1])

            # Verify 2 entries, total = 900 cal
            entries_after = await c.get_nutrition_entries(start_date=day, end_date=day)
            assert entries_after["total_count"] == 2
            total_after = sum(e["calories"] for e in entries_after["items"])
            assert abs(total_after - 900) < 1

        finally:
            await c.close()


# ===========================================================================
# 4.5: Inactive user clean re-entry
# ===========================================================================


class TestInactiveUserReentry:

    @pytest.mark.asyncio
    async def test_inactive_user_clean_reentry(self, override_get_db):
        """Persona D goes inactive for 14 days, then logs again on day 16.

        Verify no crashes, streak resets to 1, data is clean.
        """
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_D)

            # Simulate days 0-1 (active) and 2-15 (inactive)
            for day in range(16):
                await _simulate_day(c, PERSONA_D, day)

            # Day 16: re-entry — log food and training manually
            reentry_date = SIM_START + timedelta(days=16)
            await c.log_food(
                meal_name="Comeback Meal",
                calories=500,
                protein_g=35,
                carbs_g=50,
                fat_g=15,
                entry_date=reentry_date,
            )
            await c.log_training(
                session_date=reentry_date,
                exercises=[{
                    "exercise_name": "bodyweight squat",
                    "sets": [{"reps": 15, "weight_kg": 0, "set_type": "normal"}],
                }],
            )

            # Verify streak resets to 1 (only day 16 is active after long gap)
            streak = await c.get_streak()
            assert streak["current_streak"] == 1, (
                f"Expected streak=1 after re-entry, got {streak['current_streak']}"
            )

            # Verify data is clean — day 16 has entries
            entries = await c.get_nutrition_entries(
                start_date=reentry_date, end_date=reentry_date,
            )
            assert entries["total_count"] == 1

            # Verify no crashes querying the gap period
            gap_entries = await c.get_nutrition_entries(
                start_date=SIM_START + timedelta(days=5),
                end_date=SIM_START + timedelta(days=14),
            )
            assert gap_entries["total_count"] == 0

        finally:
            await c.close()


# ===========================================================================
# 4.6: Training PR detection
# ===========================================================================


class TestTrainingPRDetection:

    @pytest.mark.asyncio
    async def test_training_pr_detection(self, override_get_db):
        """Log progressively heavier weights across sessions.

        Verify PR is detected in the response.
        """
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_B)

            pr_detected = False
            # Log 4 sessions with increasing weight on bench press
            for session_num in range(4):
                session_date = SIM_START + timedelta(days=session_num * 2)
                weight = 60 + session_num * 5  # 60, 65, 70, 75 kg
                resp = await c.log_training(
                    session_date=session_date,
                    exercises=[{
                        "exercise_name": "barbell bench press",
                        "sets": [
                            {"reps": 5, "weight_kg": weight, "set_type": "normal"},
                            {"reps": 5, "weight_kg": weight, "set_type": "normal"},
                            {"reps": 5, "weight_kg": weight, "set_type": "normal"},
                        ],
                    }],
                )
                # Check if any PR was detected in the response
                if resp.get("personal_records"):
                    pr_detected = True

            # After progressive overload, at least one PR should be detected
            assert pr_detected, "Expected at least one PR to be detected across progressive sessions"

        finally:
            await c.close()
