"""Exercise muscle coefficient mapping for WNS calculations.

Provides functions to determine muscle coefficients for exercises,
used by the WNS engine to weight stimulus per muscle group.
"""

from __future__ import annotations

from src.modules.training.exercise_mapping import get_muscle_group


def get_muscle_coefficients(
    exercise_name: str,
    primary_muscle: str,
    secondary_muscles: list[str] | None = None,
) -> dict[str, float]:
    """Get muscle coefficients for an exercise.

    Args:
        exercise_name: Name of the exercise
        primary_muscle: Primary muscle group
        secondary_muscles: List of secondary muscle groups

    Returns:
        Dict mapping muscle group names to coefficients.
        Primary muscle gets 1.0, secondary muscles get 0.5.
        Falls back to exercise_mapping if primary is empty/None and no secondary.
    """
    coefficients: dict[str, float] = {}

    # Handle primary muscle
    if primary_muscle:
        coefficients[primary_muscle] = 1.0

    # Handle secondary muscles
    if secondary_muscles:
        for muscle in secondary_muscles:
            coefficients[muscle] = 0.5

    # Fallback to exercise mapping if no muscles specified
    if not primary_muscle and not secondary_muscles:
        fallback_muscle = get_muscle_group(exercise_name)
        if fallback_muscle != "Other":
            coefficients[fallback_muscle] = 1.0

    # Validate coefficients are between 0.0 and 1.0
    for muscle, coeff in coefficients.items():
        if not (0.0 <= coeff <= 1.0):
            coefficients[muscle] = max(0.0, min(1.0, coeff))

    return coefficients


def get_exercise_coefficient(
    exercise_name: str,
    target_muscle: str,
    primary_muscle: str,
    secondary_muscles: list[str] | None = None,
) -> float:
    """Get coefficient for a single target muscle.

    Args:
        exercise_name: Name of the exercise
        target_muscle: Target muscle group to get coefficient for
        primary_muscle: Primary muscle group
        secondary_muscles: List of secondary muscle groups

    Returns:
        Coefficient for the target muscle (1.0 for primary, 0.5 for secondary, 0.0 if not targeted)
    """
    coefficients = get_muscle_coefficients(exercise_name, primary_muscle, secondary_muscles)
    return coefficients.get(target_muscle, 0.0)
