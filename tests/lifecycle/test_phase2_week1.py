"""Phase 2: Week 1 — Daily Logging (Days 1-7) for all personas.

Simulates day-by-day food, training, and bodyweight logging.
Verifies daily totals, weekly summary accuracy, and achievement triggers.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.lifecycle.api_client import LifecycleClient
from tests.lifecycle.personas import (
    ALL_PERSONAS,
    DAILY_PLAN_GENERATORS,
    PERSONA_A,
    PERSONA_B,
    PERSONA_C,
    PERSONA_D,
    PersonaProfile,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

SIM_START = date(2025, 1, 6)  # Monday


async def _onboard(client: LifecycleClient, p: PersonaProfile) -> None:
    """Quick onboarding — register, profile, goals, snapshot."""
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
    """Simulate one day of activity. Returns summary of what was logged."""
    gen = DAILY_PLAN_GENERATORS[persona.name]
    plan = gen(day_num)
    sim_date = SIM_START + timedelta(days=day_num)
    result = {"date": sim_date.isoformat(), "meals_logged": 0, "training_logged": False, "bw_logged": False}

    # Log meals
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

    # Log training
    if plan.training:
        await client.log_training(
            session_date=sim_date,
            exercises=plan.training["exercises"],
        )
        result["training_logged"] = True

    # Log bodyweight
    if plan.log_bodyweight is not None:
        await client.log_bodyweight(plan.log_bodyweight, sim_date)
        result["bw_logged"] = True

    return result


# ===========================================================================
# Phase 2.1: Persona A — Week 1 (7 days, consistent logging)
# ===========================================================================


class TestPersonaAWeek1:
    """Persona A: beginner, weight loss, consistent daily logging."""

    @pytest.mark.asyncio
    async def test_week1_daily_logging_and_totals(self, override_get_db):
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            expected_total_cal = 0.0
            expected_total_pro = 0.0
            training_days = 0

            for day in range(7):
                result = await _simulate_day(c, PERSONA_A, day)
                sim_date = SIM_START + timedelta(days=day)

                # Verify daily entries are retrievable
                entries = await c.get_nutrition_entries(
                    start_date=sim_date, end_date=sim_date,
                )
                day_cal = sum(e["calories"] for e in entries["items"])
                day_pro = sum(e["protein_g"] for e in entries["items"])

                # Persona A logs 4 meals/day = 1350 cal
                if result["meals_logged"] > 0:
                    assert abs(day_cal - 1350) < 1, f"Day {day}: expected ~1350 cal, got {day_cal}"
                    expected_total_cal += day_cal
                    expected_total_pro += day_pro

                if result["training_logged"]:
                    training_days += 1

            # Persona A trains Mon/Wed/Fri = 3 days
            assert training_days == 3

            # Verify weekly total matches sum of daily entries
            week_entries = await c.get_nutrition_entries(
                start_date=SIM_START, end_date=SIM_START + timedelta(days=6),
            )
            actual_total_cal = sum(e["calories"] for e in week_entries["items"])
            assert abs(actual_total_cal - expected_total_cal) < 1, (
                f"Weekly cal mismatch: expected {expected_total_cal}, got {actual_total_cal}"
            )

            # Verify training sessions count
            sessions = await c.get_training_sessions(
                start_date=SIM_START, end_date=SIM_START + timedelta(days=6),
            )
            assert sessions["total_count"] == 3

        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_week1_streak_tracking(self, override_get_db):
        """After 7 consecutive days of logging, streak should be 7."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)
            for day in range(7):
                await _simulate_day(c, PERSONA_A, day)

            streak = await c.get_streak()
            assert streak["current_streak"] == 7, f"Expected streak=7, got {streak['current_streak']}"
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_week1_7day_streak_achievement(self, override_get_db):
        """7-day streak should unlock the streak_7 achievement."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)
            for day in range(7):
                await _simulate_day(c, PERSONA_A, day)

            achievements = await c.get_achievements()
            streak_7 = next((a for a in achievements if a["definition"]["id"] == "streak_7"), None)
            assert streak_7 is not None, "streak_7 achievement not found"
            assert streak_7["unlocked"] is True, "streak_7 should be unlocked after 7 days"
        finally:
            await c.close()


# ===========================================================================
# Phase 2.2: Persona B — Week 1 (6 training days, high volume)
# ===========================================================================


class TestPersonaBWeek1:
    """Persona B: experienced lifter, bulking, 6x/week training."""

    @pytest.mark.asyncio
    async def test_week1_high_volume_logging(self, override_get_db):
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_B)

            training_days = 0
            for day in range(7):
                result = await _simulate_day(c, PERSONA_B, day)
                if result["training_logged"]:
                    training_days += 1

            # Persona B trains 6x/week (rest on Sunday)
            assert training_days == 6

            # Verify high calorie intake (5 meals × ~3000 cal/day)
            week_entries = await c.get_nutrition_entries(
                start_date=SIM_START, end_date=SIM_START + timedelta(days=6),
            )
            total_cal = sum(e["calories"] for e in week_entries["items"])
            # 7 days × 3000 cal = ~21000
            assert total_cal > 18000, f"Expected >18000 cal for bulking, got {total_cal}"

        finally:
            await c.close()


# ===========================================================================
# Phase 2.3: Persona C — Week 1 (inconsistent logging)
# ===========================================================================


class TestPersonaCWeek1:
    """Persona C: casual user, skips some days."""

    @pytest.mark.asyncio
    async def test_week1_inconsistent_logging(self, override_get_db):
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_C)

            days_with_food = 0
            for day in range(7):
                result = await _simulate_day(c, PERSONA_C, day)
                if result["meals_logged"] > 0:
                    days_with_food += 1

            # Persona C skips every 5th day
            assert days_with_food < 7, "Persona C should skip some days"
            assert days_with_food >= 5, "Persona C should log most days"

        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_week1_streak_broken_by_skip(self, override_get_db):
        """Persona C's inconsistent logging should break the streak."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_C)
            for day in range(7):
                await _simulate_day(c, PERSONA_C, day)

            streak = await c.get_streak()
            # Streak should be < 7 due to skipped days
            assert streak["current_streak"] < 7
        finally:
            await c.close()


# ===========================================================================
# Phase 2.4: Persona D — Logs 2 days then drops off
# ===========================================================================


class TestPersonaDWeek1:
    """Persona D: logs for 2 days, then goes inactive."""

    @pytest.mark.asyncio
    async def test_week1_partial_then_inactive(self, override_get_db):
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_D)

            days_with_food = 0
            for day in range(7):
                result = await _simulate_day(c, PERSONA_D, day)
                if result["meals_logged"] > 0:
                    days_with_food += 1

            # Persona D only logs days 0 and 1
            assert days_with_food == 2

            # Training: only day 1
            sessions = await c.get_training_sessions(
                start_date=SIM_START, end_date=SIM_START + timedelta(days=6),
            )
            assert sessions["total_count"] == 1

        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_inactive_days_no_stale_data(self, override_get_db):
        """Days 2-6 should have no entries — no stale data."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_D)
            for day in range(7):
                await _simulate_day(c, PERSONA_D, day)

            # Check day 5 (should be empty)
            day5 = SIM_START + timedelta(days=5)
            entries = await c.get_nutrition_entries(start_date=day5, end_date=day5)
            assert entries["total_count"] == 0, "Day 5 should have no entries for Persona D"

        finally:
            await c.close()


# ===========================================================================
# Phase 2.5: Cross-persona data isolation
# ===========================================================================


class TestDataIsolation:
    """Verify personas can't see each other's data."""

    @pytest.mark.asyncio
    async def test_personas_data_isolated(self, override_get_db):
        """Two personas logging on the same day see only their own data."""
        c_a = LifecycleClient()
        c_b = LifecycleClient()
        try:
            await _onboard(c_a, PERSONA_A)
            await _onboard(c_b, PERSONA_B)

            # Both log on day 0
            await _simulate_day(c_a, PERSONA_A, 0)
            await _simulate_day(c_b, PERSONA_B, 0)

            # Persona A sees only their entries
            entries_a = await c_a.get_nutrition_entries(
                start_date=SIM_START, end_date=SIM_START,
            )
            entries_b = await c_b.get_nutrition_entries(
                start_date=SIM_START, end_date=SIM_START,
            )

            # Persona A logs 4 meals, Persona B logs 5
            assert entries_a["total_count"] == 4
            assert entries_b["total_count"] == 5

        finally:
            await c_a.close()
            await c_b.close()
