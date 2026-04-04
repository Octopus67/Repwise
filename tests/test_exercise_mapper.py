"""Tests for exercise mapper — token matching, thresholds, edge cases."""

import pytest
from src.modules.import_data.exercise_mapper import (
    map_exercises, normalize_exercise, jaccard_similarity, MATCH_THRESHOLD,
)

DB_EXERCISES = [
    {"id": "1", "name": "Bench Press (Barbell)"},
    {"id": "2", "name": "Squat (Barbell)"},
    {"id": "3", "name": "Deadlift (Barbell)"},
    {"id": "4", "name": "Lat Pulldown (Cable)"},
]


def test_exact_match():
    result = map_exercises(["Bench Press (Barbell)"], DB_EXERCISES)
    assert result["Bench Press (Barbell)"]["matched"] == "Bench Press (Barbell)"
    assert result["Bench Press (Barbell)"]["confidence"] == 1.0


def test_reordered_tokens_match():
    result = map_exercises(["Barbell Bench Press"], DB_EXERCISES)
    assert result["Barbell Bench Press"]["matched"] == "Bench Press (Barbell)"
    assert result["Barbell Bench Press"]["confidence"] >= MATCH_THRESHOLD


def test_no_match_creates_custom():
    result = map_exercises(["Unknown Exercise XYZ"], DB_EXERCISES)
    assert result["Unknown Exercise XYZ"]["matched"] is None
    assert result["Unknown Exercise XYZ"]["create_as_custom"] is True


def test_threshold_boundary():
    # Jaccard of exactly 0.7 should match
    # tokens: {a, b, c, d, e, f, g} vs {a, b, c, d, e, f, g} = 1.0
    # We need sets where |intersection|/|union| = 0.7
    # {a,b,c,d,e,f,g} & {a,b,c,d,e,x,y} = {a,b,c,d,e} / {a,b,c,d,e,f,g,x,y} = 5/9 ≈ 0.556 < 0.7
    # {a,b,c} & {a,b,c,d} = 3/4 = 0.75 >= 0.7
    db = [{"id": "99", "name": "alpha beta gamma delta"}]
    result = map_exercises(["alpha beta gamma"], db)
    score = jaccard_similarity({"alpha", "beta", "gamma"}, {"alpha", "beta", "gamma", "delta"})
    assert score == 0.75
    assert result["alpha beta gamma"]["matched"] is not None


def test_empty_input():
    result = map_exercises([], DB_EXERCISES)
    assert result == {}


def test_normalize_strips_parens():
    assert normalize_exercise("Bench Press (Barbell)") == {"bench", "press", "barbell"}


def test_jaccard_empty_sets():
    assert jaccard_similarity(set(), {"a"}) == 0.0
    assert jaccard_similarity(set(), set()) == 0.0
