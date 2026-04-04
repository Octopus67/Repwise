"""
Static exercise database for Repwise.

Auto-generated — DO NOT EDIT MANUALLY.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

_DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "exercises.json"


def _load_exercises() -> list[dict]:
    with open(_DATA_FILE) as f:
        return json.load(f)


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
