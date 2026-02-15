"""Pure e1RM (estimated one-rep max) computation functions.

Three formulas: Epley, Brzycki, Lombardi.
No database or I/O dependencies — fully testable in isolation.
"""

from __future__ import annotations
from typing import List, Optional

from dataclasses import dataclass

# Maximum reps accepted by the calculator.  Values above this are rejected.
MAX_REPS = 30


@dataclass
class E1RMResult:
    """Result of an e1RM computation across three formulas."""

    epley: float
    brzycki: float
    lombardi: float
    primary: float  # Always equals Epley value
    low_confidence: bool  # True when reps > MAX_REPS (only via internal path)


_ZERO_RESULT = E1RMResult(
    epley=0.0, brzycki=0.0, lombardi=0.0, primary=0.0, low_confidence=False
)


def compute_e1rm(weight_kg: float, reps: int) -> E1RMResult:
    """Compute estimated 1RM using three formulas.

    Raises ValueError for invalid inputs:
      - weight_kg < 0
      - reps < 0
      - reps > MAX_REPS (30)

    Special cases:
      - reps == 0 or weight_kg == 0: returns 0 for all formulas
      - reps == 1: returns weight_kg for all formulas
    """
    # --- Input validation ---
    if weight_kg < 0:
        raise ValueError(f"weight_kg must be >= 0, got {weight_kg}")
    if reps < 0:
        raise ValueError(f"reps must be >= 0, got {reps}")
    if reps > MAX_REPS:
        raise ValueError(f"reps must be <= {MAX_REPS}, got {reps}")

    if reps == 0 or weight_kg == 0:
        return E1RMResult(
            epley=0.0, brzycki=0.0, lombardi=0.0, primary=0.0, low_confidence=False
        )

    if reps == 1:
        return E1RMResult(
            epley=weight_kg,
            brzycki=weight_kg,
            lombardi=weight_kg,
            primary=weight_kg,
            low_confidence=False,
        )

    epley = weight_kg * (1 + reps / 30)

    # Brzycki: weight * 36 / (37 - reps).
    # With reps capped at 30 the denominator is always >= 7, so no division-by-zero.
    brzycki = weight_kg * 36 / (37 - reps)

    lombardi = weight_kg * (reps ** 0.10)

    return E1RMResult(
        epley=epley,
        brzycki=brzycki,
        lombardi=lombardi,
        primary=epley,
        low_confidence=False,
    )


def best_e1rm_for_exercise(sets: List[dict]) -> Optional[E1RMResult]:
    """Return the E1RMResult for the set with the highest Epley e1RM.

    Returns None if no valid sets (weight_kg > 0 and reps > 0) exist.
    Each set dict is expected to have 'weight_kg' and 'reps' keys.
    Sets with out-of-range values are silently skipped.
    """
    best: Optional[E1RMResult] = None

    for s in sets:
        weight = s.get("weight_kg", 0.0)
        reps = s.get("reps", 0)

        if weight <= 0 or reps <= 0 or reps > MAX_REPS:
            continue

        result = compute_e1rm(weight, reps)
        if best is None or result.epley > best.epley:
            best = result

    return best
