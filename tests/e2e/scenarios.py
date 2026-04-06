"""Parameterized test scenarios for E2E flow tests."""

from __future__ import annotations

import pytest

from tests.e2e.factories import make_onboarding_payload

# ── Onboarding Scenarios (24 combos) ─────────────────────────────────────────

ONBOARDING_SCENARIOS = [
    # Core goal × activity × sex combos
    pytest.param(make_onboarding_payload(goal_type="cutting", activity_level="sedentary", sex="male", diet_style="balanced", body_fat_pct=25.0, goal_rate_per_week=-0.5), id="cut-sedentary-male"),
    pytest.param(make_onboarding_payload(goal_type="cutting", activity_level="active", sex="female", diet_style="high_protein", goal_rate_per_week=-1.0), id="cut-active-female"),
    pytest.param(make_onboarding_payload(goal_type="cutting", activity_level="very_active", sex="male", diet_style="low_carb", body_fat_pct=15.0, goal_rate_per_week=-2.0), id="cut-veryactive-male-lowcarb"),
    pytest.param(make_onboarding_payload(goal_type="bulking", activity_level="sedentary", sex="female", diet_style="balanced", body_fat_pct=30.0, goal_rate_per_week=0.25), id="bulk-sedentary-female"),
    pytest.param(make_onboarding_payload(goal_type="bulking", activity_level="moderate", sex="male", diet_style="high_protein", body_fat_pct=18.0, goal_rate_per_week=0.5), id="bulk-moderate-male"),
    pytest.param(make_onboarding_payload(goal_type="bulking", activity_level="very_active", sex="other", goal_rate_per_week=1.0), id="bulk-veryactive-other"),
    pytest.param(make_onboarding_payload(goal_type="maintaining", activity_level="light", sex="male", diet_style="keto", body_fat_pct=12.0), id="maintain-light-male-keto"),
    pytest.param(make_onboarding_payload(goal_type="maintaining", activity_level="active", sex="female"), id="maintain-active-female"),
    pytest.param(make_onboarding_payload(goal_type="recomposition", activity_level="moderate", sex="male", diet_style="high_protein", body_fat_pct=20.0), id="recomp-moderate-male"),
    pytest.param(make_onboarding_payload(goal_type="recomposition", activity_level="active", sex="female", diet_style="low_carb", body_fat_pct=28.0), id="recomp-active-female"),
    pytest.param(make_onboarding_payload(goal_type="cutting", activity_level="light", sex="other", diet_style="keto", body_fat_pct=35.0, goal_rate_per_week=-0.75), id="cut-light-other-keto"),
    pytest.param(make_onboarding_payload(goal_type="bulking", activity_level="moderate", sex="male", diet_style="keto", body_fat_pct=10.0, goal_rate_per_week=2.0), id="bulk-moderate-male-keto"),
    # Boundary: age extremes
    pytest.param(make_onboarding_payload(age_years=13, weight_kg=45.0, height_cm=155.0), id="boundary-age-min"),
    pytest.param(make_onboarding_payload(age_years=80, weight_kg=70.0), id="boundary-age-max"),
    # Boundary: body size extremes
    pytest.param(make_onboarding_payload(height_cm=150.0, weight_kg=40.0), id="boundary-small"),
    pytest.param(make_onboarding_payload(height_cm=210.0, weight_kg=150.0), id="boundary-large"),
    # Boundary: aggressive cut/bulk rates
    pytest.param(make_onboarding_payload(goal_type="cutting", goal_rate_per_week=-2.0, weight_kg=60.0), id="boundary-aggressive-cut"),
    pytest.param(make_onboarding_payload(goal_type="bulking", goal_rate_per_week=2.0, weight_kg=100.0), id="boundary-aggressive-bulk"),
    # All exercise types
    pytest.param(make_onboarding_payload(exercise_types=["strength", "cardio", "sports", "yoga", "walking"], exercise_sessions_per_week=7), id="all-exercise-types"),
    # Minimal exercise
    pytest.param(make_onboarding_payload(exercise_types=[], exercise_sessions_per_week=0, activity_level="sedentary"), id="no-exercise"),
    # Full food DNA
    pytest.param(make_onboarding_payload(dietary_restrictions=["vegetarian"], allergies=["nuts", "shellfish"], cuisine_preferences=["indian", "mediterranean"], meal_frequency=6, protein_per_kg=2.5), id="full-food-dna"),
    # Keto + high body fat
    pytest.param(make_onboarding_payload(diet_style="keto", body_fat_pct=40.0, goal_type="cutting", goal_rate_per_week=-1.0), id="keto-high-bf"),
    # Low carb recomp
    pytest.param(make_onboarding_payload(diet_style="low_carb", goal_type="recomposition", body_fat_pct=22.0, sex="female"), id="lowcarb-recomp-female"),
    # High protein bulk
    pytest.param(make_onboarding_payload(diet_style="high_protein", goal_type="bulking", protein_per_kg=3.0, goal_rate_per_week=0.5), id="highprot-bulk"),
]

# ── Training Set Type Combos ─────────────────────────────────────────────────

SET_TYPE_COMBOS = [
    pytest.param({"reps": 8, "weight_kg": 100, "rpe": 8.0, "rir": None, "set_type": "normal"}, id="normal-rpe-only"),
    pytest.param({"reps": 12, "weight_kg": 80, "rpe": None, "rir": 2, "set_type": "normal"}, id="normal-rir-only"),
    pytest.param({"reps": 5, "weight_kg": 120, "rpe": 9.5, "rir": 1, "set_type": "normal"}, id="normal-both"),
    pytest.param({"reps": 15, "weight_kg": 60, "rpe": None, "rir": None, "set_type": "normal"}, id="normal-neither"),
    pytest.param({"reps": 10, "weight_kg": 40, "rpe": 5.0, "rir": None, "set_type": "warm-up"}, id="warmup-rpe"),
    pytest.param({"reps": 15, "weight_kg": 20, "rpe": None, "rir": None, "set_type": "warm-up"}, id="warmup-light"),
    pytest.param({"reps": 8, "weight_kg": 80, "rpe": 9.0, "rir": 0, "set_type": "drop-set"}, id="dropset"),
    pytest.param({"reps": 20, "weight_kg": 60, "rpe": 10.0, "rir": 0, "set_type": "amrap"}, id="amrap"),
    pytest.param({"reps": 1, "weight_kg": 1000, "rpe": 10, "rir": 0, "set_type": "normal"}, id="boundary-max-weight"),
    pytest.param({"reps": 1000, "weight_kg": 0, "rpe": 0, "rir": 5, "set_type": "normal"}, id="boundary-max-reps"),
]
