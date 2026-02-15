"""Phase 3: Weeks 2-4 — Sustained Usage (Days 0-27) for all personas.

Simulates the full 28-day lifecycle for each persona archetype.
Verifies cumulative totals, streak accuracy, and behavioral patterns.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.lifecycle.api_client import LifecycleClient
from tests.lifecycle.personas import (
    DAILY_PLAN_GENERATORS,
    PERSONA_A,
    PERSONA_B,
    PERSONA_C,
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


async def _simulate_range(
    client: LifecycleClient, persona: PersonaProfile, start_day: int, end_day: int,
) -> list[dict]:
    """Simulate a range of days [start_day, end_day) and return results."""
    results = []
    for day in range(start_day, end_day):
        r = await _simulate_day(client, persona, day)
        results.append(r)
    return results


# ===========================================================================
# Phase 3.1: Persona A — Full 28-day simulation
# ===========================================================================


class TestPersonaA28Day:

    @pytest.mark.asyncio
    async def test_persona_a_28day_simulation(self, override_get_db):
        """Full 28-day sim for Persona A: consistent logging, 3x/week training."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            expected_meals = 0
            expected_training = 0
            bw_days = []

            for day in range(28):
                r = await _simulate_day(c, PERSONA_A, day)
                expected_meals += r["meals_logged"]
                if r["training_logged"]:
                    expected_training += 1
                if r["bw_logged"]:
                    bw_days.append(day)

            # Verify nutrition entries — fetch in pages since limit=100
            all_entries = await c.get_nutrition_entries(
                start_date=SIM_START,
                end_date=SIM_START + timedelta(days=27),
                limit=100,
            )
            assert all_entries["total_count"] == expected_meals, (
                f"Expected {expected_meals} nutrition entries, got {all_entries['total_count']}"
            )

            # Persona A trains Mon/Wed/Fri = 3/week × 4 weeks = 12
            assert expected_training == 12, f"Expected 12 training days, got {expected_training}"
            sessions = await c.get_training_sessions(
                start_date=SIM_START,
                end_date=SIM_START + timedelta(days=27),
                limit=100,
            )
            assert sessions["total_count"] == 12

            # Bodyweight logged on days where day_num % 3 == 0
            bw = await c.get_bodyweight_history(limit=100)
            # +1 for the onboarding bodyweight log
            assert len(bw["items"]) >= len(bw_days)

            # Streak at day 28 = 28 (Persona A logs every day)
            streak = await c.get_streak()
            assert streak["current_streak"] == 28, (
                f"Expected streak=28, got {streak['current_streak']}"
            )
        finally:
            await c.close()


# ===========================================================================
# Phase 3.2: Persona B — Full 28-day simulation
# ===========================================================================


class TestPersonaB28Day:

    @pytest.mark.asyncio
    async def test_persona_b_28day_simulation(self, override_get_db):
        """Full 28-day sim for Persona B: heavy training 6x/week, bulking."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_B)

            training_count = 0
            for day in range(28):
                r = await _simulate_day(c, PERSONA_B, day)
                if r["training_logged"]:
                    training_count += 1

            # Persona B trains 6x/week (rest Sunday) = 24 sessions
            assert training_count == 24, f"Expected 24 training sessions, got {training_count}"
            sessions = await c.get_training_sessions(
                start_date=SIM_START,
                end_date=SIM_START + timedelta(days=27),
                limit=100,
            )
            assert sessions["total_count"] == 24

            # High calorie intake: 5 meals/day × ~3000 cal × 28 days = ~84000
            # Persona B has 140 entries (5 meals × 28 days), so paginate by week
            total_cal = 0.0
            for week in range(4):
                w_start = SIM_START + timedelta(days=week * 7)
                w_end = SIM_START + timedelta(days=week * 7 + 6)
                week_entries = await c.get_nutrition_entries(
                    start_date=w_start, end_date=w_end, limit=100,
                )
                total_cal += sum(e["calories"] for e in week_entries["items"])
            assert total_cal > 80000, f"Expected >80000 cal for bulking, got {total_cal}"

            # Bodyweight logged on even days
            bw = await c.get_bodyweight_history(limit=100)
            bw_dates = {e["recorded_date"] for e in bw["items"]}
            even_day_dates = {
                (SIM_START + timedelta(days=d)).isoformat()
                for d in range(28) if d % 2 == 0
            }
            # All even-day dates should be present (plus onboarding)
            assert even_day_dates.issubset(bw_dates), "Missing bodyweight entries on even days"

        finally:
            await c.close()


# ===========================================================================
# Phase 3.3: Persona C — 28-day inconsistent usage
# ===========================================================================


class TestPersonaC28Day:

    @pytest.mark.asyncio
    async def test_persona_c_28day_inconsistent(self, override_get_db):
        """Persona C: inconsistent logging with gaps."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_C)

            days_with_food = 0
            training_count = 0
            for day in range(28):
                r = await _simulate_day(c, PERSONA_C, day)
                if r["meals_logged"] > 0:
                    days_with_food += 1
                if r["training_logged"]:
                    training_count += 1

            # Some days have no entries (skipped days: every 5th day)
            assert days_with_food < 28, "Persona C should skip some days"

            # Streak < 28 due to gaps
            streak = await c.get_streak()
            assert streak["current_streak"] < 28, (
                f"Expected streak < 28 for inconsistent user, got {streak['current_streak']}"
            )

            # Training: Tue/Thu = 2/week × 4 weeks = 8
            assert training_count == 8, f"Expected 8 training sessions, got {training_count}"
            sessions = await c.get_training_sessions(
                start_date=SIM_START,
                end_date=SIM_START + timedelta(days=27),
                limit=100,
            )
            assert sessions["total_count"] == 8

        finally:
            await c.close()


# ===========================================================================
# Phase 3.4: Persona D — 28-day inactive
# ===========================================================================


class TestPersonaD28Day:

    @pytest.mark.asyncio
    async def test_persona_d_28day_inactive(self, override_get_db):
        """Persona D: logs 2 days, 1 training, then goes completely inactive."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_D)

            days_with_food = 0
            training_count = 0
            for day in range(28):
                r = await _simulate_day(c, PERSONA_D, day)
                if r["meals_logged"] > 0:
                    days_with_food += 1
                if r["training_logged"]:
                    training_count += 1

            # Only 2 days have food entries (days 0 and 1)
            assert days_with_food == 2, f"Expected 2 days with food, got {days_with_food}"

            # Only 1 training session (day 1)
            assert training_count == 1, f"Expected 1 training session, got {training_count}"

            # Days 2-27 are completely empty
            for check_day in [5, 10, 15, 20, 25]:
                d = SIM_START + timedelta(days=check_day)
                entries = await c.get_nutrition_entries(start_date=d, end_date=d)
                assert entries["total_count"] == 0, f"Day {check_day} should have no entries"

            # No crashes when querying empty date ranges
            empty_range = await c.get_nutrition_entries(
                start_date=SIM_START + timedelta(days=10),
                end_date=SIM_START + timedelta(days=20),
            )
            assert empty_range["total_count"] == 0

            empty_sessions = await c.get_training_sessions(
                start_date=SIM_START + timedelta(days=10),
                end_date=SIM_START + timedelta(days=20),
            )
            assert empty_sessions["total_count"] == 0

        finally:
            await c.close()


# ===========================================================================
# Phase 3.5: Weekly totals match daily sums
# ===========================================================================


class TestWeeklyTotals:

    @pytest.mark.asyncio
    async def test_weekly_totals_match_daily_sums(self, override_get_db):
        """For Persona A, weekly sums must match sum of individual daily entries."""
        c = LifecycleClient()
        try:
            await _onboard(c, PERSONA_A)

            # Track daily calorie sums
            daily_cals: list[float] = []
            for day in range(28):
                await _simulate_day(c, PERSONA_A, day)
                sim_date = SIM_START + timedelta(days=day)
                entries = await c.get_nutrition_entries(
                    start_date=sim_date, end_date=sim_date,
                )
                day_cal = sum(e["calories"] for e in entries["items"])
                daily_cals.append(day_cal)

            # Verify each week's total matches sum of daily entries
            weeks = [
                (0, 7),    # days 0-6
                (7, 14),   # days 7-13
                (14, 21),  # days 14-20
                (21, 28),  # days 21-27
            ]
            for week_start, week_end in weeks:
                expected_week_cal = sum(daily_cals[week_start:week_end])
                week_entries = await c.get_nutrition_entries(
                    start_date=SIM_START + timedelta(days=week_start),
                    end_date=SIM_START + timedelta(days=week_end - 1),
                    limit=100,
                )
                actual_week_cal = sum(e["calories"] for e in week_entries["items"])
                assert abs(actual_week_cal - expected_week_cal) < 0.01, (
                    f"Week {week_start // 7 + 1}: expected {expected_week_cal}, got {actual_week_cal}"
                )

        finally:
            await c.close()
