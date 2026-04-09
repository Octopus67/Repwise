"""Tests for exercise data remediation logic.

Covers: catalog fallback, secondary muscle credit, mobility skip,
WNS trend HU calculation, intensity_pct estimation, taxonomy cleanup.
"""

import json
from pathlib import Path

import pytest

from src.modules.training.exercise_mapping import get_muscle_group
from src.modules.training.exercises import get_all_exercises, is_mobility_exercise
from src.modules.training.exercise_coefficients import get_muscle_coefficients
from src.modules.training.wns_engine import (
    stimulating_reps_per_set,
    diminishing_returns,
    rir_from_rpe,
)

VALID_GROUPS = frozenset([
    "chest", "shoulders", "biceps", "triceps", "forearms", "abs",
    "quads", "hamstrings", "glutes", "calves", "traps", "lats",
    "erectors", "adductors",
])

DATA_FILE = Path(__file__).resolve().parent.parent / "src" / "modules" / "training" / "exercises_data.json"


# ─── Taxonomy Tests ──────────────────────────────────────────────────────────


class TestTaxonomyCleanup:
    """Verify 'back' and 'full_body' are fully eliminated."""

    def test_no_back_primary(self):
        assert all(e["muscle_group"] != "back" for e in get_all_exercises())

    def test_no_full_body_primary(self):
        assert all(e["muscle_group"] != "full_body" for e in get_all_exercises())

    def test_no_back_in_secondary(self):
        for e in get_all_exercises():
            assert "back" not in (e.get("secondary_muscles") or []), e["name"]

    def test_all_primaries_valid(self):
        for e in get_all_exercises():
            assert e["muscle_group"] in VALID_GROUPS, f"{e['name']}: {e['muscle_group']}"

    def test_all_secondaries_valid(self):
        for e in get_all_exercises():
            for s in (e.get("secondary_muscles") or []):
                assert s in VALID_GROUPS, f"{e['name']} has invalid secondary '{s}'"

    def test_primary_not_in_secondary(self):
        for e in get_all_exercises():
            if e.get("secondary_muscles"):
                assert e["muscle_group"] not in e["secondary_muscles"], (
                    f"{e['name']}: primary '{e['muscle_group']}' also in secondary"
                )


# ─── Catalog Fallback Tests ──────────────────────────────────────────────────


class TestCatalogFallback:
    """Verify get_muscle_group() falls back to exercise catalog."""

    def test_hardcoded_map_still_works(self):
        assert get_muscle_group("bench press") == "chest"
        assert get_muscle_group("barbell squat") == "quads"

    def test_catalog_fallback_for_unknown(self):
        """Exercises not in hardcoded map should resolve via catalog."""
        result = get_muscle_group("Alternating Floor Press")
        assert result == "chest"

    def test_truly_unknown_returns_other(self):
        assert get_muscle_group("xyzzy nonexistent exercise") == "Other"

    def test_zero_exercises_return_other(self):
        """Every catalog exercise should resolve to a valid group."""
        others = [e["name"] for e in get_all_exercises() if get_muscle_group(e["name"]) == "Other"]
        assert others == [], f"{len(others)} exercises return 'Other': {others[:5]}"

    def test_no_exercise_returns_back(self):
        for e in get_all_exercises():
            assert get_muscle_group(e["name"]) != "back"

    def test_no_exercise_returns_full_body(self):
        for e in get_all_exercises():
            assert get_muscle_group(e["name"]) != "full_body"


# ─── Mobility Skip Tests ─────────────────────────────────────────────────────


class TestMobilitySkip:
    """Verify mobility exercises are correctly identified."""

    def test_stretches_are_mobility(self):
        assert is_mobility_exercise("Cat Stretch")
        assert is_mobility_exercise("Child's Pose")

    def test_smr_is_mobility(self):
        assert is_mobility_exercise("Latissimus Dorsi-SMR")

    def test_strength_exercises_are_not_mobility(self):
        assert not is_mobility_exercise("Barbell Bench Press")
        assert not is_mobility_exercise("Barbell Squat")
        assert not is_mobility_exercise("Barbell Row")

    def test_unknown_exercise_is_not_mobility(self):
        assert not is_mobility_exercise("xyzzy nonexistent")

    def test_case_insensitive(self):
        assert is_mobility_exercise("cat stretch")
        assert is_mobility_exercise("CAT STRETCH")

    def test_mobility_count(self):
        count = sum(1 for e in get_all_exercises() if e.get("is_mobility"))
        assert count >= 50, f"Expected ≥50 mobility exercises, got {count}"


# ─── Secondary Muscle Credit Tests ───────────────────────────────────────────


class TestSecondaryMuscleCredit:
    """Verify coefficient system works correctly."""

    def test_primary_gets_1_0(self):
        coeffs = get_muscle_coefficients("Bench Press", "chest", ["shoulders", "triceps"])
        assert coeffs["chest"] == 1.0

    def test_secondary_gets_0_5(self):
        coeffs = get_muscle_coefficients("Bench Press", "chest", ["shoulders", "triceps"])
        assert coeffs["shoulders"] == 0.5
        assert coeffs["triceps"] == 0.5

    def test_no_secondary_returns_primary_only(self):
        coeffs = get_muscle_coefficients("Bicep Curl", "biceps", [])
        assert coeffs == {"biceps": 1.0}

    def test_every_compound_has_secondary(self):
        """All compound exercises should have at least one secondary muscle."""
        missing = []
        for e in get_all_exercises():
            if e.get("category") == "compound" and not e.get("is_mobility"):
                if not e.get("secondary_muscles"):
                    missing.append(e["name"])
        assert missing == [], f"{len(missing)} compounds missing secondary: {missing[:5]}"


# ─── Coverage Tests ──────────────────────────────────────────────────────────


class TestMuscleCoverage:
    """Verify every muscle group has adequate exercise coverage."""

    def test_every_group_has_10_primary(self):
        from collections import Counter
        dist = Counter(e["muscle_group"] for e in get_all_exercises())
        for g in VALID_GROUPS:
            assert dist.get(g, 0) >= 10, f"{g} has only {dist.get(g, 0)} exercises"

    def test_every_group_appears_as_secondary(self):
        from collections import Counter
        sec = Counter()
        for e in get_all_exercises():
            for s in (e.get("secondary_muscles") or []):
                sec[s] += 1
        for g in VALID_GROUPS:
            assert sec.get(g, 0) >= 10, f"{g} appears as secondary only {sec.get(g, 0)} times"


# ─── WNS Engine Tests ────────────────────────────────────────────────────────


class TestIntensityPct:
    """Verify intensity_pct activates the heavy-load path."""

    def test_high_intensity_gives_full_stim(self):
        """At ≥85% intensity, all reps should be stimulating (up to cap)."""
        stim = stimulating_reps_per_set(3, rir=None, intensity_pct=0.90)
        assert stim > 0

    def test_low_reps_high_intensity(self):
        """Heavy singles at 95% should produce stimulus."""
        stim = stimulating_reps_per_set(1, rir=None, intensity_pct=0.95)
        assert stim > 0

    def test_none_intensity_uses_rir_path(self):
        """When intensity_pct is None, RIR-based path is used."""
        stim_rir = stimulating_reps_per_set(8, rir=2.0, intensity_pct=None)
        assert stim_rir > 0

    def test_junk_volume_produces_zero(self):
        """RIR ≥ 4 with no intensity data should produce 0 stim reps."""
        stim = stimulating_reps_per_set(10, rir=5.0, intensity_pct=None)
        assert stim == 0.0


class TestDiminishingReturns:
    """Verify diminishing returns curve."""

    def test_single_set(self):
        result = diminishing_returns([5.0])
        assert result == 5.0

    def test_more_sets_more_total_but_diminishing(self):
        one_set = diminishing_returns([5.0])
        two_sets = diminishing_returns([5.0, 5.0])
        assert two_sets > one_set
        # But second set contributes less than first
        marginal = two_sets - one_set
        assert marginal < one_set

    def test_empty_list(self):
        assert diminishing_returns([]) == 0.0
