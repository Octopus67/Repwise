"""User persona definitions for lifecycle simulation.

Each persona represents a distinct user archetype with specific goals,
body stats, and behavioral patterns over a 28-day simulation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional


@dataclass(frozen=True)
class PersonaProfile:
    """Static profile data used during onboarding."""
    name: str
    email: str
    password: str
    display_name: str
    sex: str  # "male" | "female"
    age_years: int
    height_cm: float
    weight_kg: float
    body_fat_pct: Optional[float]
    activity_level: str
    goal_type: str  # "cut" | "bulk" | "maintain" | "recomp"
    goal_rate_per_week: float  # kg/week, negative = loss


@dataclass(frozen=True)
class DailyPlan:
    """What a persona does on a given day."""
    meals: list[dict]  # list of {meal_name, calories, protein_g, carbs_g, fat_g}
    training: Optional[dict]  # None = rest day, else {exercises: [...]}
    water_ml: int  # total water for the day
    log_bodyweight: Optional[float]  # None = skip


# ---------------------------------------------------------------------------
# Persona A — Beginner (Weight Loss)
# ---------------------------------------------------------------------------

PERSONA_A = PersonaProfile(
    name="persona_a",
    email="anna.beginner@test.com",
    password="SecurePass123!",
    display_name="Anna",
    sex="female",
    age_years=28,
    height_cm=170.0,
    weight_kg=82.0,
    body_fat_pct=32.0,
    activity_level="sedentary",
    goal_type="cutting",
    goal_rate_per_week=-0.5,
)

# ---------------------------------------------------------------------------
# Persona B — Experienced Lifter (Bulking)
# ---------------------------------------------------------------------------

PERSONA_B = PersonaProfile(
    name="persona_b",
    email="ben.lifter@test.com",
    password="StrongPass456!",
    display_name="Ben",
    sex="male",
    age_years=32,
    height_cm=183.0,
    weight_kg=88.0,
    body_fat_pct=14.0,
    activity_level="very_active",
    goal_type="bulking",
    goal_rate_per_week=0.3,
)

# ---------------------------------------------------------------------------
# Persona C — Casual User (Maintenance)
# ---------------------------------------------------------------------------

PERSONA_C = PersonaProfile(
    name="persona_c",
    email="carl.casual@test.com",
    password="CasualPass789!",
    display_name="Carl",
    sex="male",
    age_years=45,
    height_cm=175.0,
    weight_kg=76.0,
    body_fat_pct=22.0,
    activity_level="moderate",
    goal_type="maintaining",
    goal_rate_per_week=0.0,
)

# ---------------------------------------------------------------------------
# Persona D — New User Who Drops Off
# ---------------------------------------------------------------------------

PERSONA_D = PersonaProfile(
    name="persona_d",
    email="diana.dropout@test.com",
    password="DropoutPass000!",
    display_name="Diana",
    sex="female",
    age_years=22,
    height_cm=165.0,
    weight_kg=60.0,
    body_fat_pct=24.0,
    activity_level="light",
    goal_type="maintaining",
    goal_rate_per_week=0.0,
)

ALL_PERSONAS = [PERSONA_A, PERSONA_B, PERSONA_C, PERSONA_D]


# ---------------------------------------------------------------------------
# Meal templates per persona goal
# ---------------------------------------------------------------------------

def cutting_meals() -> list[dict]:
    return [
        {"meal_name": "Breakfast", "calories": 350, "protein_g": 30, "carbs_g": 35, "fat_g": 10},
        {"meal_name": "Lunch", "calories": 450, "protein_g": 40, "carbs_g": 40, "fat_g": 15},
        {"meal_name": "Dinner", "calories": 400, "protein_g": 35, "carbs_g": 30, "fat_g": 18},
        {"meal_name": "Snack", "calories": 150, "protein_g": 15, "carbs_g": 10, "fat_g": 5},
    ]


def bulking_meals() -> list[dict]:
    return [
        {"meal_name": "Breakfast", "calories": 700, "protein_g": 50, "carbs_g": 80, "fat_g": 20},
        {"meal_name": "Lunch", "calories": 800, "protein_g": 55, "carbs_g": 90, "fat_g": 25},
        {"meal_name": "Dinner", "calories": 750, "protein_g": 50, "carbs_g": 70, "fat_g": 30},
        {"meal_name": "Snack 1", "calories": 400, "protein_g": 35, "carbs_g": 40, "fat_g": 12},
        {"meal_name": "Snack 2", "calories": 350, "protein_g": 30, "carbs_g": 35, "fat_g": 10},
    ]


def maintenance_meals() -> list[dict]:
    return [
        {"meal_name": "Breakfast", "calories": 500, "protein_g": 30, "carbs_g": 55, "fat_g": 18},
        {"meal_name": "Lunch", "calories": 600, "protein_g": 35, "carbs_g": 65, "fat_g": 20},
        {"meal_name": "Dinner", "calories": 550, "protein_g": 30, "carbs_g": 50, "fat_g": 22},
    ]


def light_cardio_session(day_num: int) -> dict:
    return {
        "exercises": [
            {"exercise_name": "treadmill walk", "sets": [{"reps": 1, "weight_kg": 0, "set_type": "normal"}]},
            {"exercise_name": "bodyweight squat", "sets": [
                {"reps": 15, "weight_kg": 0, "set_type": "normal"},
                {"reps": 15, "weight_kg": 0, "set_type": "normal"},
            ]},
        ]
    }


def heavy_resistance_session(day_num: int) -> dict:
    base_weight = 60 + (day_num // 7) * 2.5  # progressive overload
    return {
        "exercises": [
            {"exercise_name": "barbell back squat", "sets": [
                {"reps": 5, "weight_kg": base_weight + 40, "set_type": "normal"},
                {"reps": 5, "weight_kg": base_weight + 40, "set_type": "normal"},
                {"reps": 5, "weight_kg": base_weight + 40, "set_type": "normal"},
            ]},
            {"exercise_name": "barbell bench press", "sets": [
                {"reps": 5, "weight_kg": base_weight, "set_type": "normal"},
                {"reps": 5, "weight_kg": base_weight, "set_type": "normal"},
                {"reps": 5, "weight_kg": base_weight, "set_type": "normal"},
            ]},
            {"exercise_name": "barbell row", "sets": [
                {"reps": 8, "weight_kg": base_weight - 10, "set_type": "normal"},
                {"reps": 8, "weight_kg": base_weight - 10, "set_type": "normal"},
                {"reps": 8, "weight_kg": base_weight - 10, "set_type": "normal"},
            ]},
        ]
    }


def casual_session(day_num: int) -> dict:
    return {
        "exercises": [
            {"exercise_name": "dumbbell bench press", "sets": [
                {"reps": 10, "weight_kg": 20, "set_type": "normal"},
                {"reps": 10, "weight_kg": 20, "set_type": "normal"},
            ]},
            {"exercise_name": "lat pulldown", "sets": [
                {"reps": 12, "weight_kg": 40, "set_type": "normal"},
                {"reps": 12, "weight_kg": 40, "set_type": "normal"},
            ]},
        ]
    }


def generate_daily_plan_a(day_num: int) -> DailyPlan:
    """Persona A: consistent food logging, light cardio 3x/week, daily water."""
    weekday = day_num % 7  # 0=Mon
    is_training = weekday in (0, 2, 4)  # Mon, Wed, Fri
    weight_delta = -0.05 * day_num  # gradual loss
    return DailyPlan(
        meals=cutting_meals(),
        training=light_cardio_session(day_num) if is_training else None,
        water_ml=2500,
        log_bodyweight=round(82.0 + weight_delta, 1) if day_num % 3 == 0 else None,
    )


def generate_daily_plan_b(day_num: int) -> DailyPlan:
    """Persona B: 5 meals/day, heavy training 6x/week, high water."""
    weekday = day_num % 7
    is_rest = weekday == 6  # Sunday rest
    weight_delta = 0.03 * day_num  # gradual gain
    return DailyPlan(
        meals=bulking_meals(),
        training=None if is_rest else heavy_resistance_session(day_num),
        water_ml=4000,
        log_bodyweight=round(88.0 + weight_delta, 1) if day_num % 2 == 0 else None,
    )


def generate_daily_plan_c(day_num: int) -> DailyPlan:
    """Persona C: inconsistent logging, trains 2-3x/week."""
    weekday = day_num % 7
    is_training = weekday in (1, 3)  # Tue, Thu
    # Skip some days entirely (simulate inconsistency)
    skip_food = day_num % 5 == 4  # skip every 5th day
    return DailyPlan(
        meals=[] if skip_food else maintenance_meals(),
        training=casual_session(day_num) if is_training else None,
        water_ml=1500 if not skip_food else 0,
        log_bodyweight=round(76.0, 1) if day_num % 7 == 0 else None,
    )


def generate_daily_plan_d(day_num: int) -> DailyPlan:
    """Persona D: logs for 2 days, one workout, then goes inactive."""
    if day_num <= 1:
        return DailyPlan(
            meals=maintenance_meals(),
            training=casual_session(day_num) if day_num == 1 else None,
            water_ml=2000,
            log_bodyweight=60.0 if day_num == 0 else None,
        )
    # Days 2-27: completely inactive
    return DailyPlan(meals=[], training=None, water_ml=0, log_bodyweight=None)


DAILY_PLAN_GENERATORS = {
    "persona_a": generate_daily_plan_a,
    "persona_b": generate_daily_plan_b,
    "persona_c": generate_daily_plan_c,
    "persona_d": generate_daily_plan_d,
}
