"""Navy body fat percentage calculator using the Hodgdon-Beckett formula.

Formulas:
  Males:   495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
  Females: 495 / (1.29579 - 0.35004 * log10(waist + hips - neck) + 0.22100 * log10(height)) - 450
"""

from __future__ import annotations

import math


def navy_body_fat(
    sex: str,
    waist_cm: float,
    neck_cm: float,
    height_cm: float,
    hips_cm: float | None = None,
) -> float:
    """Calculate body fat percentage using the Hodgdon-Beckett (U.S. Navy) method.

    Raises ValueError if inputs would produce invalid log arguments.
    """
    if sex == "male":
        diff = waist_cm - neck_cm
        if diff <= 0:
            raise ValueError("waist must be greater than neck for male calculation")
        bf = 495 / (1.0324 - 0.19077 * math.log10(diff) + 0.15456 * math.log10(height_cm)) - 450
    elif sex == "female":
        if hips_cm is None:
            raise ValueError("hips_cm is required for female calculation")
        diff = waist_cm + hips_cm - neck_cm
        if diff <= 0:
            raise ValueError("waist + hips must be greater than neck for female calculation")
        bf = 495 / (1.29579 - 0.35004 * math.log10(diff) + 0.22100 * math.log10(height_cm)) - 450
    elif sex == "other":
        # Average male and female estimates; requires hips_cm
        diff_m = waist_cm - neck_cm
        if diff_m <= 0:
            raise ValueError("waist must be greater than neck for calculation")
        bf_m = 495 / (1.0324 - 0.19077 * math.log10(diff_m) + 0.15456 * math.log10(height_cm)) - 450
        if hips_cm is None:
            bf = bf_m  # fallback to male-only if hips not provided
        else:
            diff_f = waist_cm + hips_cm - neck_cm
            if diff_f <= 0:
                raise ValueError("waist + hips must be greater than neck for calculation")
            bf_f = 495 / (1.29579 - 0.35004 * math.log10(diff_f) + 0.22100 * math.log10(height_cm)) - 450
            bf = (bf_m + bf_f) / 2
    else:
        raise ValueError(f"Invalid sex: {sex}. Must be 'male', 'female', or 'other'.")

    return round(max(bf, 0.0), 2)
