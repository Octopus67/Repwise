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
        _MOBILITY_SET = frozenset(ex["name"].lower() for ex in EXERCISES if ex.get("is_mobility"))
    return name.strip().lower() in _MOBILITY_SET


def find_substitutes(
    exercise_identifier: str,
    available_equipment: list[str] | None = None,
    limit: int = 5,
) -> list[dict]:
    """Find substitute exercises based on biomechanics similarity.

    Scores candidates by: same muscle_group (required), loading_position match,
    strength_curve match, category match, SFR match, secondary muscle overlap.
    """
    exercises = get_all_exercises()

    # Find source by id or name
    source = None
    for e in exercises:
        if e["id"] == exercise_identifier or e["name"].lower() == exercise_identifier.lower():
            source = e
            break
    if source is None:
        return []

    # Filter candidates
    candidates = []
    for e in exercises:
        if e["id"] == source["id"]:
            continue
        if e["muscle_group"] != source["muscle_group"]:
            continue
        if e.get("is_mobility", False):
            continue
        if available_equipment and e["equipment"] not in available_equipment:
            continue
        candidates.append(e)

    # Score each candidate (0-100)
    src_sec = set(source.get("secondary_muscles", []))
    scored = []
    for c in candidates:
        score = 0
        if c.get("loading_position") == source.get("loading_position"):
            score += 30
        if c.get("strength_curve") == source.get("strength_curve"):
            score += 20
        if c.get("category") == source.get("category"):
            score += 15
        # SFR: same or better
        sfr_order = {"excellent": 4, "good": 3, "moderate": 2, "poor": 1}
        c_sfr = sfr_order.get(c.get("stimulus_to_fatigue", ""), 0)
        s_sfr = sfr_order.get(source.get("stimulus_to_fatigue", ""), 0)
        if c_sfr >= s_sfr:
            score += 15
        # Secondary muscle overlap (Jaccard)
        c_sec = set(c.get("secondary_muscles", []))
        if src_sec or c_sec:
            jaccard = len(src_sec & c_sec) / len(src_sec | c_sec) if (src_sec | c_sec) else 0
            score += int(jaccard * 10)
        # Equipment match bonus
        if c["equipment"] == source["equipment"]:
            score += 10
        scored.append({**c, "_similarity_score": score})

    scored.sort(key=lambda x: x["_similarity_score"], reverse=True)
    return scored[:limit]


def get_exercise_biomechanics(exercise_name: str) -> dict | None:
    """Return biomechanics fields for an exercise, or None if not found/no data."""
    exercises = get_all_exercises()
    for e in exercises:
        if e["name"].lower() == exercise_name.lower():
            sc = e.get("strength_curve")
            if sc is None:
                return None  # No biomechanics data (custom exercise)
            return {
                "strength_curve": sc,
                "loading_position": e.get("loading_position"),
                "stimulus_to_fatigue": e.get("stimulus_to_fatigue"),
                "fatigue_rating": e.get("fatigue_rating"),
                "stretch_hypertrophy_potential": e.get("stretch_hypertrophy_potential"),
            }
    return None  # Exercise not in static DB (custom exercise)
