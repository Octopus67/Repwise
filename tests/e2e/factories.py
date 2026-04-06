"""Test data factories for E2E flow tests."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4


def make_user_credentials(**overrides) -> dict:
    """Generate unique user credentials."""
    uid = uuid4().hex[:8]
    defaults = {"email": f"e2e_{uid}@test.com", "password": f"E2ePass1!{uid}"}
    return {**defaults, **overrides}


def make_onboarding_payload(**overrides) -> dict:
    """Generate a valid onboarding/complete payload."""
    defaults = {
        "age_years": 28,
        "sex": "male",
        "weight_kg": 80.0,
        "height_cm": 178.0,
        "body_fat_pct": None,
        "activity_level": "moderate",
        "exercise_sessions_per_week": 4,
        "exercise_types": ["strength"],
        "goal_type": "maintaining",
        "goal_rate_per_week": 0.0,
        "diet_style": "balanced",
        "protein_per_kg": 2.0,
        "dietary_restrictions": [],
        "allergies": [],
        "cuisine_preferences": [],
        "meal_frequency": 3,
    }
    return {**defaults, **overrides}


def make_training_session(**overrides) -> dict:
    """Generate a valid training session payload."""
    defaults = {
        "session_date": str(date.today()),
        "exercises": [
            {
                "exercise_name": "Bench Press",
                "sets": [
                    {"reps": 8, "weight_kg": 80.0, "rpe": 8.0, "rir": None, "set_type": "normal"},
                    {"reps": 8, "weight_kg": 80.0, "rpe": 8.5, "rir": None, "set_type": "normal"},
                    {"reps": 6, "weight_kg": 82.5, "rpe": 9.0, "rir": None, "set_type": "normal"},
                ],
            }
        ],
    }
    return {**defaults, **overrides}


def make_nutrition_entry(**overrides) -> dict:
    """Generate a valid nutrition entry payload."""
    defaults = {
        "meal_name": "Breakfast",
        "food_name": "Oatmeal with protein",
        "calories": 450.0,
        "protein_g": 35.0,
        "carbs_g": 55.0,
        "fat_g": 8.0,
        "entry_date": str(date.today()),
    }
    return {**defaults, **overrides}


def make_set(reps: int = 8, weight_kg: float = 80.0, **overrides) -> dict:
    """Generate a single set entry."""
    defaults = {"reps": reps, "weight_kg": weight_kg, "rpe": None, "rir": None, "set_type": "normal"}
    return {**defaults, **overrides}


def make_exercise(name: str = "Bench Press", sets: list | None = None) -> dict:
    """Generate an exercise entry with sets."""
    return {"exercise_name": name, "sets": sets or [make_set(), make_set(), make_set()]}


def past_date(days_ago: int) -> str:
    """Return a date string N days in the past."""
    return str(date.today() - timedelta(days=days_ago))
