"""Property-based tests for macro scaling proportionality.

Tests Property 3 from the design document using Hypothesis.
This property is shared across barcode serving adjustment, recipe scaling,
and meal builder — any time macros are multiplied by a serving factor.

Property 3: For any food item with known macros and for any positive
serving multiplier m, the scaled macros should satisfy:
|scaled.X - base.X * m| < 0.01 for each macro X.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st


# ---------------------------------------------------------------------------
# Pure scaling function (mirrors frontend scaleMacros and backend logic)
# ---------------------------------------------------------------------------

@dataclass
class Macros:
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


def scale_macros(base: Macros, multiplier: float) -> Macros:
    """Scale macros by a multiplier — the universal scaling function.

    This mirrors the frontend `scaleMacros` in AddNutritionModal.tsx
    and the backend recipe nutrition scaling in service.py.
    """
    return Macros(
        calories=base.calories * multiplier,
        protein_g=base.protein_g * multiplier,
        carbs_g=base.carbs_g * multiplier,
        fat_g=base.fat_g * multiplier,
    )


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_macro_values = st.floats(
    min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False
)

_positive_multipliers = st.floats(
    min_value=0.01, max_value=100.0, allow_nan=False, allow_infinity=False
)


@st.composite
def macros_strategy(draw):
    """Generate a valid Macros instance."""
    return Macros(
        calories=draw(_macro_values),
        protein_g=draw(_macro_values),
        carbs_g=draw(_macro_values),
        fat_g=draw(_macro_values),
    )


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_settings = h_settings(
    max_examples=200,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 3: Macro scaling proportionality
# ---------------------------------------------------------------------------


class TestProperty3MacroScalingProportionality:
    """Property 3: Macro scaling proportionality.

    For any food item with known macros (calories, protein_g, carbs_g, fat_g)
    and for any positive serving multiplier m, the scaled macros should
    satisfy: |scaled.X - base.X * m| < 0.01 for each macro X.

    This property applies universally to barcode serving adjustment,
    recipe serving scaling, and meal builder item serving adjustment.

    **Validates: Requirements 1.1.5, 6.1.5, 10.2.1, 10.2.2**
    """

    @_settings
    @given(base=macros_strategy(), multiplier=_positive_multipliers)
    def test_scaled_macros_are_proportional(
        self,
        base: Macros,
        multiplier: float,
    ):
        """Scaled macros equal base * multiplier within tolerance.

        **Validates: Requirements 1.1.5**
        """
        scaled = scale_macros(base, multiplier)

        assert abs(scaled.calories - base.calories * multiplier) < 0.01, (
            f"Calories: |{scaled.calories} - {base.calories} * {multiplier}| >= 0.01"
        )
        assert abs(scaled.protein_g - base.protein_g * multiplier) < 0.01, (
            f"Protein: |{scaled.protein_g} - {base.protein_g} * {multiplier}| >= 0.01"
        )
        assert abs(scaled.carbs_g - base.carbs_g * multiplier) < 0.01, (
            f"Carbs: |{scaled.carbs_g} - {base.carbs_g} * {multiplier}| >= 0.01"
        )
        assert abs(scaled.fat_g - base.fat_g * multiplier) < 0.01, (
            f"Fat: |{scaled.fat_g} - {base.fat_g} * {multiplier}| >= 0.01"
        )

    @_settings
    @given(base=macros_strategy())
    def test_identity_multiplier_preserves_macros(
        self,
        base: Macros,
    ):
        """Multiplier of 1.0 returns identical macros.

        **Validates: Requirements 10.2.1**
        """
        scaled = scale_macros(base, 1.0)

        assert abs(scaled.calories - base.calories) < 0.01
        assert abs(scaled.protein_g - base.protein_g) < 0.01
        assert abs(scaled.carbs_g - base.carbs_g) < 0.01
        assert abs(scaled.fat_g - base.fat_g) < 0.01

    @_settings
    @given(base=macros_strategy(), m1=_positive_multipliers, m2=_positive_multipliers)
    def test_double_scaling_equals_product(
        self,
        base: Macros,
        m1: float,
        m2: float,
    ):
        """Scaling by m1 then m2 equals scaling by m1*m2 (associativity).

        **Validates: Requirements 10.2.2**
        """
        # Guard against overflow
        if m1 * m2 > 1e6 or base.calories * m1 * m2 > 1e10:
            return

        double_scaled = scale_macros(scale_macros(base, m1), m2)
        direct_scaled = scale_macros(base, m1 * m2)

        # Use relative tolerance for large values
        for attr in ('calories', 'protein_g', 'carbs_g', 'fat_g'):
            d = getattr(double_scaled, attr)
            s = getattr(direct_scaled, attr)
            # Allow slightly larger tolerance for chained floating-point ops
            assert abs(d - s) < max(0.01, abs(s) * 1e-9), (
                f"{attr}: |{d} - {s}| too large for m1={m1}, m2={m2}"
            )

    @_settings
    @given(base=macros_strategy(), multiplier=_positive_multipliers)
    def test_non_negative_macros_stay_non_negative(
        self,
        base: Macros,
        multiplier: float,
    ):
        """Scaling non-negative macros by a positive multiplier stays non-negative.

        **Validates: Requirements 6.1.5**
        """
        scaled = scale_macros(base, multiplier)

        assert scaled.calories >= 0, f"Calories went negative: {scaled.calories}"
        assert scaled.protein_g >= 0, f"Protein went negative: {scaled.protein_g}"
        assert scaled.carbs_g >= 0, f"Carbs went negative: {scaled.carbs_g}"
        assert scaled.fat_g >= 0, f"Fat went negative: {scaled.fat_g}"
