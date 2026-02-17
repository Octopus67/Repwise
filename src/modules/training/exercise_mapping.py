"""Static exercise-to-muscle-group mapping and compound classification.

Provides lookup helpers used by the Training Analytics Service and
the Rest Timer to determine muscle groups and exercise categories.
"""

from __future__ import annotations

EXERCISE_MUSCLE_MAP: dict[str, str] = {
    # Chest
    "bench press": "chest",
    "barbell bench press": "chest",
    "dumbbell bench press": "chest",
    "incline barbell bench press": "chest",
    "incline dumbbell bench press": "chest",
    "decline barbell bench press": "chest",
    "decline dumbbell bench press": "chest",
    "dumbbell flyes": "chest",
    "incline dumbbell flyes": "chest",
    "cable crossover": "chest",
    "chest dips": "chest",
    "push-ups": "chest",
    "machine chest press": "chest",
    "pec deck fly": "chest",
    "floor press": "chest",
    "dumbbell pullover": "chest",
    # Lats
    "lat pulldown": "lats",
    "pull-ups": "lats",
    "pull up": "lats",
    "chin-ups": "lats",
    "seated cable row": "lats",
    "straight-arm pulldown": "lats",
    "barbell row": "lats",
    "dumbbell row": "lats",
    "pendlay row": "lats",
    "t-bar row": "lats",
    "machine row": "lats",
    "inverted row": "lats",
    # Erectors
    "deadlift": "erectors",
    "conventional deadlift": "erectors",
    "sumo deadlift": "erectors",
    "rack pull": "erectors",
    "good morning": "erectors",
    # Shoulders
    "overhead press": "shoulders",
    "dumbbell shoulder press": "shoulders",
    "arnold press": "shoulders",
    "machine shoulder press": "shoulders",
    "dumbbell lateral raise": "shoulders",
    "lateral raise": "shoulders",
    "cable lateral raise": "shoulders",
    "dumbbell front raise": "shoulders",
    "dumbbell reverse fly": "shoulders",
    "landmine press": "shoulders",
    "push press": "shoulders",
    # Quads
    "squat": "quads",
    "barbell back squat": "quads",
    "barbell front squat": "quads",
    "goblet squat": "quads",
    "leg press": "quads",
    "hack squat": "quads",
    "leg extension": "quads",
    "walking lunge": "quads",
    "barbell lunge": "quads",
    "step-up": "quads",
    # Hamstrings
    "romanian deadlift": "hamstrings",
    "lying leg curl": "hamstrings",
    "seated leg curl": "hamstrings",
    "stiff-leg deadlift": "hamstrings",
    "nordic curl": "hamstrings",
    "kettlebell swing": "hamstrings",
    # Glutes
    "barbell hip thrust": "glutes",
    "glute bridge": "glutes",
    "bulgarian split squat": "glutes",
    "cable kickback": "glutes",
    # Biceps
    "bicep curl": "biceps",
    "barbell curl": "biceps",
    "dumbbell curl": "biceps",
    "hammer curl": "biceps",
    "preacher curl": "biceps",
    "cable curl": "biceps",
    "concentration curl": "biceps",
    "ez-bar curl": "biceps",
    # Triceps
    "tricep extension": "triceps",
    "cable pushdown": "triceps",
    "rope pushdown": "triceps",
    "skull crusher": "triceps",
    "tricep dips": "triceps",
    "overhead tricep extension": "triceps",
    "close-grip bench press": "triceps",
    "dumbbell kickback": "triceps",
    # Calves
    "standing calf raise": "calves",
    "seated calf raise": "calves",
    # Abs
    "crunch": "abs",
    "plank": "abs",
    "hanging leg raise": "abs",
    "russian twist": "abs",
    "cable crunch": "abs",
    "ab wheel rollout": "abs",
    # Traps
    "barbell shrug": "traps",
    "dumbbell shrug": "traps",
    "upright row": "traps",
    "farmer's walk": "traps",
    "face pull": "traps",
    # Forearms
    "barbell wrist curl": "forearms",
    "reverse barbell curl": "forearms",
    "dumbbell wrist curl": "forearms",
    # Full Body
    "clean and press": "full_body",
    "thruster": "full_body",
    "burpee": "full_body",
    "turkish get-up": "full_body",
    # Adductors
    "adductor machine": "adductors",
    "cable hip adduction": "adductors",
    "copenhagen plank": "adductors",
    # Template aliases (for backward compatibility)
    "barbell rows": "lats",
    "seated cable rows": "lats",
    "face pulls": "traps",
    "barbell curls": "biceps",
    "barbell squats": "quads",
    "romanian deadlifts": "hamstrings",
    "leg curls": "hamstrings",
    "calf raises": "calves",
    "lat pulldowns": "lats",
    "dumbbell curls": "biceps",
    "hip thrusts": "glutes",
    "bulgarian split squats": "glutes",
    "lateral raises": "shoulders",
    "tricep pushdowns": "triceps",
    "incline dumbbell press": "chest",
}

COMPOUND_EXERCISES: set[str] = {
    "bench press",
    "barbell bench press",
    "dumbbell bench press",
    "incline barbell bench press",
    "incline dumbbell bench press",
    "decline barbell bench press",
    "squat",
    "barbell back squat",
    "barbell front squat",
    "goblet squat",
    "deadlift",
    "conventional deadlift",
    "sumo deadlift",
    "overhead press",
    "dumbbell shoulder press",
    "arnold press",
    "push press",
    "barbell row",
    "dumbbell row",
    "pendlay row",
    "t-bar row",
    "leg press",
    "hack squat",
    "pull-ups",
    "pull up",
    "chin-ups",
    "chest dips",
    "tricep dips",
    "romanian deadlift",
    "barbell hip thrust",
    "bulgarian split squat",
    "good morning",
    "floor press",
    "close-grip bench press",
    "lat pulldown",
    "seated cable row",
    "rack pull",
    "landmine press",
    "walking lunge",
    "barbell lunge",
    "dip",
}


def get_muscle_group(exercise_name: str) -> str:
    """Return the muscle group for *exercise_name*, or ``"Other"`` if unknown."""
    return EXERCISE_MUSCLE_MAP.get(exercise_name.lower().strip(), "Other")


def is_compound(exercise_name: str) -> bool:
    """Return ``True`` if *exercise_name* is classified as a compound movement."""
    return exercise_name.lower().strip() in COMPOUND_EXERCISES
