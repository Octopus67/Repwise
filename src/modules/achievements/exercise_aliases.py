"""Exercise name alias resolution for PR badge matching.

Maps common exercise name variations to canonical exercise groups so
that PR badge detection works regardless of how the user names their
exercises.
"""

from __future__ import annotations
from typing import Optional

EXERCISE_ALIASES: dict[str, str] = {
    # Bench press variants
    "bench press": "bench_press",
    "flat bench press": "bench_press",
    "barbell bench press": "bench_press",
    "flat barbell bench press": "bench_press",
    "bb bench press": "bench_press",
    "bench": "bench_press",
    # Squat variants
    "squat": "squat",
    "back squat": "squat",
    "barbell squat": "squat",
    "barbell back squat": "squat",
    "bb squat": "squat",
    "high bar squat": "squat",
    "low bar squat": "squat",
    # Deadlift variants
    "deadlift": "deadlift",
    "conventional deadlift": "deadlift",
    "barbell deadlift": "deadlift",
    "bb deadlift": "deadlift",
    # TODO: expand with data-driven aliases post-launch
}


def resolve_exercise_group(exercise_name: str) -> Optional[str]:
    """Return the canonical exercise group for *exercise_name*, or ``None``.

    Matching is case-insensitive with leading/trailing whitespace stripped.
    """
    return EXERCISE_ALIASES.get(exercise_name.lower().strip())
