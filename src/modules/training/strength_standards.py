"""Static strength standards thresholds and classification logic.

Bodyweight-ratio multipliers for five supported lifts across four levels.
No database or I/O dependencies — fully testable in isolation.
"""

from __future__ import annotations
from typing import Dict, List, Optional

from dataclasses import dataclass
from enum import Enum


class StrengthLevel(str, Enum):
    """Strength classification levels."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    ELITE = "elite"
    UNKNOWN = "unknown"


# Bodyweight multiplier thresholds per lift per level.
# A user meets a level when their e1RM / bodyweight >= threshold.
STRENGTH_STANDARDS: Dict[str, Dict[StrengthLevel, float]] = {
    "barbell bench press": {
        StrengthLevel.BEGINNER: 0.5,
        StrengthLevel.INTERMEDIATE: 1.0,
        StrengthLevel.ADVANCED: 1.5,
        StrengthLevel.ELITE: 2.0,
    },
    "barbell back squat": {
        StrengthLevel.BEGINNER: 0.75,
        StrengthLevel.INTERMEDIATE: 1.25,
        StrengthLevel.ADVANCED: 1.75,
        StrengthLevel.ELITE: 2.5,
    },
    "conventional deadlift": {
        StrengthLevel.BEGINNER: 1.0,
        StrengthLevel.INTERMEDIATE: 1.5,
        StrengthLevel.ADVANCED: 2.0,
        StrengthLevel.ELITE: 3.0,
    },
    "overhead press": {
        StrengthLevel.BEGINNER: 0.35,
        StrengthLevel.INTERMEDIATE: 0.65,
        StrengthLevel.ADVANCED: 1.0,
        StrengthLevel.ELITE: 1.4,
    },
    "barbell row": {
        StrengthLevel.BEGINNER: 0.4,
        StrengthLevel.INTERMEDIATE: 0.75,
        StrengthLevel.ADVANCED: 1.1,
        StrengthLevel.ELITE: 1.5,
    },
}

SUPPORTED_LIFTS: List[str] = list(STRENGTH_STANDARDS.keys())

# Ordered levels for iteration (ascending strength).
_ORDERED_LEVELS: List[StrengthLevel] = [
    StrengthLevel.BEGINNER,
    StrengthLevel.INTERMEDIATE,
    StrengthLevel.ADVANCED,
    StrengthLevel.ELITE,
]


@dataclass
class StrengthClassification:
    """Classification result for a single lift."""

    exercise_name: str
    e1rm_kg: float
    bodyweight_kg: float
    bodyweight_ratio: float
    level: StrengthLevel
    next_level: Optional[StrengthLevel]
    next_level_threshold_kg: Optional[float]


def classify_strength(
    exercise_name: str, e1rm_kg: float, bodyweight_kg: float
) -> StrengthClassification:
    """Classify strength level for a supported lift.

    Raises ValueError if:
      - exercise_name is not in SUPPORTED_LIFTS
      - e1rm_kg < 0
      - bodyweight_kg < 0
    """
    if e1rm_kg < 0:
        raise ValueError(f"e1rm_kg must be >= 0, got {e1rm_kg}")
    if bodyweight_kg < 0:
        raise ValueError(f"bodyweight_kg must be >= 0, got {bodyweight_kg}")

    key = exercise_name.lower().strip()
    if key not in STRENGTH_STANDARDS:
        raise ValueError(f"Unsupported exercise: {exercise_name}")

    thresholds = STRENGTH_STANDARDS[key]
    ratio = e1rm_kg / bodyweight_kg if bodyweight_kg > 0 else 0.0

    # Find the highest level whose threshold is met
    achieved_level = StrengthLevel.UNKNOWN
    for level in _ORDERED_LEVELS:
        if ratio >= thresholds[level]:
            achieved_level = level

    # Determine next level
    next_level: Optional[StrengthLevel] = None
    next_level_threshold_kg: Optional[float] = None

    if achieved_level == StrengthLevel.UNKNOWN:
        # Below beginner — next level is beginner
        next_level = StrengthLevel.BEGINNER
        next_level_threshold_kg = round(thresholds[StrengthLevel.BEGINNER] * bodyweight_kg, 2)
    elif achieved_level != StrengthLevel.ELITE:
        idx = _ORDERED_LEVELS.index(achieved_level)
        next_level = _ORDERED_LEVELS[idx + 1]
        next_level_threshold_kg = round(thresholds[next_level] * bodyweight_kg, 2)
    # Elite: next_level stays None

    return StrengthClassification(
        exercise_name=key,
        e1rm_kg=e1rm_kg,
        bodyweight_kg=bodyweight_kg,
        bodyweight_ratio=round(ratio, 4),
        level=achieved_level,
        next_level=next_level,
        next_level_threshold_kg=next_level_threshold_kg,
    )


def rank_by_strength(
    classifications: List[StrengthClassification],
) -> List[StrengthClassification]:
    """Rank classifications by bodyweight_ratio descending."""
    return sorted(classifications, key=lambda c: c.bodyweight_ratio, reverse=True)


def get_supported_lifts() -> List[str]:
    """Return the list of supported lift names."""
    return list(SUPPORTED_LIFTS)
