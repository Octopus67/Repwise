"""Motivational milestone generation from strength classifications.

Computes deficit to next level and generates human-readable messages.
No database or I/O dependencies — fully testable in isolation.
"""

from __future__ import annotations
from typing import Optional

from dataclasses import dataclass

from src.modules.training.strength_standards import (
    StrengthClassification,
    StrengthLevel,
)


@dataclass
class Milestone:
    """A motivational milestone for a single lift."""

    exercise_name: str
    current_e1rm_kg: float
    next_level: Optional[StrengthLevel]
    deficit_kg: float
    message: str


def generate_milestones(
    classifications: list[StrengthClassification],
    unit_system: str = "metric",
) -> list[Milestone]:
    """Generate milestone messages sorted by smallest deficit first.

    - Elite lifts get congratulatory message with deficit_kg=0.
    - Omits lifts with level == UNKNOWN.
    - Supports metric (kg) and imperial (lb) formatting.
    """
    milestones: list[Milestone] = []

    for c in classifications:
        if c.level == StrengthLevel.UNKNOWN:
            continue

        if c.level == StrengthLevel.ELITE:
            milestones.append(
                Milestone(
                    exercise_name=c.exercise_name,
                    current_e1rm_kg=c.e1rm_kg,
                    next_level=None,
                    deficit_kg=0.0,
                    message=f"You've reached Elite {c.exercise_name}!",
                )
            )
        elif c.next_level is not None and c.next_level_threshold_kg is not None:
            deficit_kg = c.next_level_threshold_kg - c.e1rm_kg
            deficit_kg = max(deficit_kg, 0.0)  # Guard against negative

            if unit_system == "imperial":
                deficit_display = f"{round(deficit_kg * 2.20462, 1)} lb"
            else:
                deficit_display = f"{round(deficit_kg, 1)} kg"

            milestones.append(
                Milestone(
                    exercise_name=c.exercise_name,
                    current_e1rm_kg=c.e1rm_kg,
                    next_level=c.next_level,
                    deficit_kg=round(deficit_kg, 2),
                    message=f"You're {deficit_display} away from {c.next_level.value} {c.exercise_name}",
                )
            )

    # Sort by deficit ascending (smallest first, elite at 0)
    milestones.sort(key=lambda m: m.deficit_kg)
    return milestones
