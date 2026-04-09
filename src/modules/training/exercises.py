"""
Static exercise database for Repwise.

Auto-generated — DO NOT EDIT MANUALLY.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

_DATA_FILE = Path(__file__).resolve().parent / "exercises_data.json"

_CACHED_EXERCISES: list[dict] | None = None


def _load_exercises() -> list[dict]:
    global _CACHED_EXERCISES
    if _CACHED_EXERCISES is not None:
        return _CACHED_EXERCISES
    with open(_DATA_FILE) as f:
        _CACHED_EXERCISES = json.load(f)
    return _CACHED_EXERCISES


try:
    EXERCISES: list[dict] = _load_exercises()
except (FileNotFoundError, json.JSONDecodeError) as e:
    raise RuntimeError(f"Failed to load exercises data: {e}") from e

_MUSCLE_GROUPS = sorted({ex["muscle_group"] for ex in EXERCISES})


def get_all_exercises() -> list[dict]:
    """Return every exercise in the database."""
    return EXERCISES


def search_exercises(
    query: str,
    muscle_group: Optional[str] = None,
    equipment: Optional[str] = None,
    category: Optional[str] = None,
) -> list[dict]:
    """Case-insensitive name search with optional muscle group, equipment, and category filters."""
    has_filters = any([muscle_group, equipment, category])
    if not query.strip() and not has_filters:
        return []
    results = EXERCISES
    if query.strip():
        words = query.lower().split()
        results = [ex for ex in results if all(w in ex["name"].lower() for w in words)]
    if muscle_group:
        mg = muscle_group.lower()
        results = [ex for ex in results if ex["muscle_group"] == mg]
    if equipment:
        eq = equipment.lower()
        results = [ex for ex in results if ex["equipment"] == eq]
    if category:
        cat = category.lower()
        results = [ex for ex in results if ex["category"] == cat]
    return results


def get_muscle_groups() -> list[str]:
    """Return sorted list of all muscle group names."""
    return _MUSCLE_GROUPS


# Mobility exercise lookup (cached)
_MOBILITY_SET: frozenset[str] | None = None


def is_mobility_exercise(name: str) -> bool:
    """Return True if the exercise is a stretch/mobility drill that shouldn't count as volume."""
    global _MOBILITY_SET
    if _MOBILITY_SET is None:
        _MOBILITY_SET = frozenset(
            ex["name"].lower() for ex in EXERCISES if ex.get("is_mobility")
        )
    return name.strip().lower() in _MOBILITY_SET
