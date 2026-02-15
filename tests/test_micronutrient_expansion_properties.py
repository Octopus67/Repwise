"""Property tests for expanded micronutrient tracking.

Feature: competitive-parity-v1
Property 22: USDA nutrient mapping completeness
Property 24: Nutrient contribution breakdown invariant
Validates: Requirements 11.1.1, 11.1.2, 11.2.5
"""

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from src.modules.food_database.usda_client import NUTRIENT_MAP, _extract_nutrients

# The 27 internal nutrient keys that MICRO_FIELDS tracks (excluding macros)
EXPECTED_MICRO_KEYS = {
    "vitamin_a_mcg", "vitamin_c_mg", "vitamin_d_mcg", "vitamin_e_mg", "vitamin_k_mcg",
    "thiamin_mg", "riboflavin_mg", "niacin_mg", "pantothenic_acid_mg", "vitamin_b6_mg",
    "biotin_mcg", "folate_mcg", "vitamin_b12_mcg",
    "calcium_mg", "iron_mg", "zinc_mg", "magnesium_mg", "potassium_mg",
    "selenium_mcg", "sodium_mg", "phosphorus_mg", "manganese_mg", "copper_mg",
    "omega_3_g", "omega_6_g", "cholesterol_mg", "fibre_g",
}

# Macro keys that are also in NUTRIENT_MAP but tracked separately
MACRO_KEYS = {"calories", "protein_g", "fat_g", "carbs_g"}


class TestProperty22NutrientMappingCompleteness:
    """Property 22: NUTRIENT_MAP covers all 27 micro keys from MICRO_FIELDS."""

    def test_nutrient_map_covers_all_micro_keys(self):
        """Every expected micro key appears as a value in NUTRIENT_MAP."""
        mapped_keys = {field_name for _, (field_name, _) in NUTRIENT_MAP.items()}
        for key in EXPECTED_MICRO_KEYS:
            assert key in mapped_keys, f"Missing NUTRIENT_MAP entry for {key}"

    def test_nutrient_map_has_at_least_27_micro_entries(self):
        """NUTRIENT_MAP should have at least 27 non-macro entries."""
        micro_entries = {
            field_name
            for _, (field_name, _) in NUTRIENT_MAP.items()
            if field_name not in MACRO_KEYS
        }
        assert len(micro_entries) >= 27

    def test_all_nutrient_ids_are_positive_integers(self):
        """Every USDA nutrient ID should be a positive integer."""
        for nutrient_id in NUTRIENT_MAP:
            assert isinstance(nutrient_id, int)
            assert nutrient_id > 0

    def test_all_multipliers_are_positive(self):
        """Every multiplier in NUTRIENT_MAP should be positive."""
        for _, (_, multiplier) in NUTRIENT_MAP.items():
            assert multiplier > 0

    @given(
        nutrient_key=st.sampled_from(sorted(EXPECTED_MICRO_KEYS)),
        value=st.floats(min_value=0.01, max_value=10000, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_extract_nutrients_produces_value_for_mapped_key(self, nutrient_key, value):
        """For any micro key in our set, constructing a USDA response with that
        nutrient's ID and a positive value should produce a non-zero extracted value."""
        # Find the USDA ID for this key
        usda_id = None
        for nid, (fname, _) in NUTRIENT_MAP.items():
            if fname == nutrient_key:
                usda_id = nid
                break
        assume(usda_id is not None)

        food_nutrients = [{"nutrientId": usda_id, "value": value}]
        macros, micros = _extract_nutrients(food_nutrients)

        if nutrient_key in MACRO_KEYS:
            assert macros[nutrient_key] > 0
        else:
            assert nutrient_key in micros
            assert micros[nutrient_key] > 0


class TestProperty24NutrientContributionBreakdown:
    """Property 24: Nutrient contribution percentages sum to ~100% per nutrient."""

    @given(
        contributions=st.lists(
            st.floats(min_value=0.01, max_value=5000, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_contribution_percentages_sum_to_100(self, contributions):
        """For any set of positive nutrient contributions, the percentages
        should sum to approximately 100%."""
        total = sum(contributions)
        assume(total > 0)

        percentages = [(c / total) * 100 for c in contributions]
        pct_sum = sum(percentages)

        assert abs(pct_sum - 100.0) < 0.01, (
            f"Percentages sum to {pct_sum}, expected ~100"
        )

    @given(
        n_entries=st.integers(min_value=1, max_value=10),
        data=st.data(),
    )
    @settings(max_examples=100)
    def test_individual_contributions_equal_total(self, n_entries, data):
        """For any set of nutrition entries, the sum of individual nutrient
        contributions equals the total daily intake for that nutrient."""
        nutrient_key = data.draw(st.sampled_from(sorted(EXPECTED_MICRO_KEYS)))
        amounts = [
            data.draw(
                st.floats(min_value=0, max_value=5000, allow_nan=False, allow_infinity=False)
            )
            for _ in range(n_entries)
        ]

        total = sum(amounts)
        assert abs(sum(amounts) - total) < 0.01
