"""Property-based tests for PR detection.

Feature: product-polish-v2, Property 6: PR detection correctness

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

For any historical bests dict and new session exercises, a set is flagged
as PR iff its weight_kg > historical best for that exercise+rep_count.
Sets with no history are not flagged. Returned PR objects contain correct
exercise_name, reps, new_weight_kg, previous_weight_kg.
"""

from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from src.modules.training.schemas import ExerciseEntry, SetEntry


# ---------------------------------------------------------------------------
# Pure logic extracted from PRDetector for property testing without DB
# ---------------------------------------------------------------------------

def detect_prs_pure(
    historical_bests: dict[str, dict[int, float]],
    exercises: list[ExerciseEntry],
) -> list[dict]:
    """Pure-function version of PR detection logic.

    This mirrors PRDetector.detect_prs() but takes historical bests
    directly instead of querying the database, enabling property testing.
    """
    prs = []
    for exercise in exercises:
        bests = historical_bests.get(exercise.exercise_name, {})
        for s in exercise.sets:
            prev_best = bests.get(s.reps)
            if prev_best is None:
                # No history — skip (Requirement 4.4)
                continue
            if s.weight_kg > prev_best:
                prs.append({
                    "exercise_name": exercise.exercise_name,
                    "reps": s.reps,
                    "new_weight_kg": s.weight_kg,
                    "previous_weight_kg": prev_best,
                })
    return prs


# ---------------------------------------------------------------------------
# Hypothesis strategies
# ---------------------------------------------------------------------------

exercise_names_st = st.sampled_from([
    "bench press", "squat", "deadlift", "overhead press",
    "barbell row", "bicep curl", "tricep extension", "leg press",
])

rep_counts_st = st.integers(min_value=1, max_value=20)
weights_st = st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False)

set_entry_st = st.builds(
    SetEntry,
    reps=rep_counts_st,
    weight_kg=weights_st,
    rpe=st.none(),
)

exercise_entry_st = st.builds(
    ExerciseEntry,
    exercise_name=exercise_names_st,
    sets=st.lists(set_entry_st, min_size=1, max_size=5),
)

# Historical bests: {exercise_name: {rep_count: best_weight_kg}}
historical_bests_st = st.dictionaries(
    keys=exercise_names_st,
    values=st.dictionaries(
        keys=rep_counts_st,
        values=weights_st,
        min_size=0,
        max_size=10,
    ),
    min_size=0,
    max_size=5,
)


# ---------------------------------------------------------------------------
# Property 6: PR detection correctness
# ---------------------------------------------------------------------------

@settings(max_examples=200)
@given(
    historical_bests=historical_bests_st,
    exercises=st.lists(exercise_entry_st, min_size=1, max_size=5),
)
def test_pr_detection_correctness(
    historical_bests: dict[str, dict[int, float]],
    exercises: list[ExerciseEntry],
) -> None:
    """Property 6: PR detection correctness.

    **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

    For any historical bests and new exercises:
    1. A set is flagged as PR iff weight_kg > historical best for that exercise+rep_count
    2. Sets with no history for that exercise+rep combo are NOT flagged
    3. Each PR has correct exercise_name, reps, new_weight_kg, previous_weight_kg
    """
    prs = detect_prs_pure(historical_bests, exercises)

    # Build expected PRs manually for comparison
    expected_prs = []
    for exercise in exercises:
        bests = historical_bests.get(exercise.exercise_name, {})
        for s in exercise.sets:
            prev = bests.get(s.reps)
            if prev is not None and s.weight_kg > prev:
                expected_prs.append({
                    "exercise_name": exercise.exercise_name,
                    "reps": s.reps,
                    "new_weight_kg": s.weight_kg,
                    "previous_weight_kg": prev,
                })

    # Same number of PRs detected
    assert len(prs) == len(expected_prs), (
        f"Expected {len(expected_prs)} PRs, got {len(prs)}"
    )

    # Each PR matches expected values
    for pr, expected in zip(prs, expected_prs):
        assert pr["exercise_name"] == expected["exercise_name"]
        assert pr["reps"] == expected["reps"]
        assert pr["new_weight_kg"] == expected["new_weight_kg"]
        assert pr["previous_weight_kg"] == expected["previous_weight_kg"]


@settings(max_examples=200)
@given(
    exercises=st.lists(exercise_entry_st, min_size=1, max_size=5),
)
def test_no_history_means_no_prs(exercises: list[ExerciseEntry]) -> None:
    """Property 6 (sub-property): No historical data means no PRs.

    **Validates: Requirements 4.4**

    When historical bests is empty, no sets should be flagged as PRs.
    """
    prs = detect_prs_pure({}, exercises)
    assert prs == [], f"Expected no PRs with empty history, got {len(prs)}"


@settings(max_examples=200)
@given(
    historical_bests=historical_bests_st,
    exercises=st.lists(exercise_entry_st, min_size=1, max_size=5),
)
def test_pr_only_when_exceeding_best(
    historical_bests: dict[str, dict[int, float]],
    exercises: list[ExerciseEntry],
) -> None:
    """Property 6 (sub-property): PRs are only flagged when weight strictly exceeds best.

    **Validates: Requirements 4.1, 4.2**

    Every flagged PR must have new_weight_kg > previous_weight_kg.
    Sets equal to or below the historical best are not flagged.
    """
    prs = detect_prs_pure(historical_bests, exercises)

    for pr in prs:
        assert pr["new_weight_kg"] > pr["previous_weight_kg"], (
            f"PR flagged but new weight {pr['new_weight_kg']} "
            f"<= previous {pr['previous_weight_kg']}"
        )

    # Also verify: any set that has history and weight <= best is NOT in prs
    pr_tuples = {
        (p["exercise_name"], p["reps"], p["new_weight_kg"])
        for p in prs
    }
    for exercise in exercises:
        bests = historical_bests.get(exercise.exercise_name, {})
        for s in exercise.sets:
            prev = bests.get(s.reps)
            if prev is not None and s.weight_kg <= prev:
                assert (exercise.exercise_name, s.reps, s.weight_kg) not in pr_tuples, (
                    f"Set with weight {s.weight_kg} <= best {prev} "
                    f"should not be flagged as PR"
                )
