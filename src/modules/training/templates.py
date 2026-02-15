"""Static workout template definitions."""

from __future__ import annotations
from typing import Optional

WORKOUT_TEMPLATES: list[dict] = [
    {
        "id": "push",
        "name": "Push Day",
        "description": "Chest, shoulders, and triceps",
        "exercises": [
            {"exercise_name": "Barbell Bench Press", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 4},
            {"exercise_name": "Overhead Press", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Incline Dumbbell Bench Press", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Dumbbell Lateral Raise", "sets": [{"reps": 15, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Cable Pushdown", "sets": [{"reps": 12, "weight_kg": 0, "rpe": None}] * 3},
        ],
    },
    {
        "id": "pull",
        "name": "Pull Day",
        "description": "Back and biceps",
        "exercises": [
            {"exercise_name": "Barbell Row", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 4},
            {"exercise_name": "Pull-Ups", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Seated Cable Row", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Face Pull", "sets": [{"reps": 15, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Barbell Curl", "sets": [{"reps": 12, "weight_kg": 0, "rpe": None}] * 3},
        ],
    },
    {
        "id": "legs",
        "name": "Legs",
        "description": "Quads, hamstrings, and calves",
        "exercises": [
            {"exercise_name": "Barbell Back Squat", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 4},
            {"exercise_name": "Romanian Deadlift", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Leg Press", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Lying Leg Curl", "sets": [{"reps": 12, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Standing Calf Raise", "sets": [{"reps": 15, "weight_kg": 0, "rpe": None}] * 4},
        ],
    },
    {
        "id": "upper_body",
        "name": "Upper Body",
        "description": "Chest, back, shoulders, and arms",
        "exercises": [
            {"exercise_name": "Barbell Bench Press", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 4},
            {"exercise_name": "Barbell Row", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 4},
            {"exercise_name": "Overhead Press", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Lat Pulldown", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Dumbbell Curl", "sets": [{"reps": 12, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Cable Pushdown", "sets": [{"reps": 12, "weight_kg": 0, "rpe": None}] * 3},
        ],
    },
    {
        "id": "lower_body",
        "name": "Lower Body",
        "description": "Quads, glutes, hamstrings, and calves",
        "exercises": [
            {"exercise_name": "Barbell Back Squat", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 4},
            {"exercise_name": "Barbell Hip Thrust", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Bulgarian Split Squat", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Lying Leg Curl", "sets": [{"reps": 12, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Standing Calf Raise", "sets": [{"reps": 15, "weight_kg": 0, "rpe": None}] * 4},
        ],
    },
    {
        "id": "full_body",
        "name": "Full Body",
        "description": "All major muscle groups in one session",
        "exercises": [
            {"exercise_name": "Barbell Back Squat", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Barbell Bench Press", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Barbell Row", "sets": [{"reps": 8, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Overhead Press", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
            {"exercise_name": "Romanian Deadlift", "sets": [{"reps": 10, "weight_kg": 0, "rpe": None}] * 3},
        ],
    },
]


def get_templates() -> list[dict]:
    """Return all workout templates."""
    return WORKOUT_TEMPLATES


def get_template_by_id(template_id: str) -> Optional[dict]:
    """Return a single template by id, or None if not found."""
    for t in WORKOUT_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None
