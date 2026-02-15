"""Property-based tests for nutrition macro scaling.

Tests Property 5 from the Tier 1 Retention Features design document:
Serving multiplier scales macros linearly.

**Validates: Requirements 5.5**

The scaleMacros logic is a pure function: given base macro values and a positive
multiplier, each output field equals the corresponding base value times the
multiplier. We re-implement the same trivial arithmetic in Python and verify the
property with Hypothesis.
"""

from __future__ import annotations

import math

import pytest
from hypothesis import given, settings as h_settings, strategies as st


# ---------------------------------------------------------------------------
# Pure function under test (mirrors the TypeScript scaleMacros export)
# ---------------------------------------------------------------------------

def scale_macros(
    base_calories: float,
    base_protein: float,
    base_carbs: float,
    base_fat: float,
    multiplier: float,
) -> dict[str, float]:
    """Scale macro values by a serving multiplier.

    This is the Python equivalent of the exported ``scaleMacros`` function in
    ``app/components/modals/AddNutritionModal.tsx``.
    """
    return {
        "calories": base_calories * multiplier,
        "protein_g": base_protein * multiplier,
        "carbs_g": base_carbs * multiplier,
        "fat_g": base_fat * multiplier,
    }


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Realistic macro values (non-negative, finite)
_macro_value = st.floats(min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False)

# Positive multiplier within the app's allowed range (0, 20]
_positive_multiplier = st.floats(
    min_value=0.01, max_value=20.0, allow_nan=False, allow_infinity=False,
)


# ---------------------------------------------------------------------------
# Property 5: Serving multiplier scales macros linearly
# ---------------------------------------------------------------------------

class TestServingMultiplierScaling:
    """Feature: tier1-retention-features, Property 5: Serving multiplier scales macros linearly"""

    @given(
        base_cal=_macro_value,
        base_pro=_macro_value,
        base_carb=_macro_value,
        base_fat=_macro_value,
        multiplier=_positive_multiplier,
    )
    @h_settings(max_examples=200)
    def test_scaled_values_equal_base_times_multiplier(
        self,
        base_cal: float,
        base_pro: float,
        base_carb: float,
        base_fat: float,
        multiplier: float,
    ) -> None:
        """**Validates: Requirements 5.5**

        For any food item macros and any positive multiplier m, each scaled
        macro value must equal the base value multiplied by m.
        """
        result = scale_macros(base_cal, base_pro, base_carb, base_fat, multiplier)

        assert math.isclose(result["calories"], base_cal * multiplier, rel_tol=1e-9, abs_tol=1e-12)
        assert math.isclose(result["protein_g"], base_pro * multiplier, rel_tol=1e-9, abs_tol=1e-12)
        assert math.isclose(result["carbs_g"], base_carb * multiplier, rel_tol=1e-9, abs_tol=1e-12)
        assert math.isclose(result["fat_g"], base_fat * multiplier, rel_tol=1e-9, abs_tol=1e-12)

    @given(
        base_cal=_macro_value,
        base_pro=_macro_value,
        base_carb=_macro_value,
        base_fat=_macro_value,
    )
    @h_settings(max_examples=100)
    def test_multiplier_of_one_returns_base_values(
        self,
        base_cal: float,
        base_pro: float,
        base_carb: float,
        base_fat: float,
    ) -> None:
        """**Validates: Requirements 5.5**

        Identity property: a multiplier of 1.0 must return the original values.
        """
        result = scale_macros(base_cal, base_pro, base_carb, base_fat, 1.0)

        assert result["calories"] == base_cal
        assert result["protein_g"] == base_pro
        assert result["carbs_g"] == base_carb
        assert result["fat_g"] == base_fat

    @given(
        base_cal=_macro_value,
        base_pro=_macro_value,
        base_carb=_macro_value,
        base_fat=_macro_value,
        m1=_positive_multiplier,
        m2=_positive_multiplier,
    )
    @h_settings(max_examples=100)
    def test_scaling_is_associative(
        self,
        base_cal: float,
        base_pro: float,
        base_carb: float,
        base_fat: float,
        m1: float,
        m2: float,
    ) -> None:
        """**Validates: Requirements 5.5**

        Associativity: scaling by m1 then m2 should equal scaling by m1*m2.
        """
        step1 = scale_macros(base_cal, base_pro, base_carb, base_fat, m1)
        step2 = scale_macros(step1["calories"], step1["protein_g"], step1["carbs_g"], step1["fat_g"], m2)
        direct = scale_macros(base_cal, base_pro, base_carb, base_fat, m1 * m2)

        for key in ("calories", "protein_g", "carbs_g", "fat_g"):
            assert math.isclose(step2[key], direct[key], rel_tol=1e-6, abs_tol=1e-9), (
                f"{key}: two-step={step2[key]}, direct={direct[key]}"
            )
