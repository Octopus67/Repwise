"""Tests for CSV import parser — format detection, parsing, edge cases."""

import pytest
from src.modules.import_data.parser import detect_format, parse_csv, _round_weight


# --- Format detection ---


def test_detect_strong():
    assert detect_format(["Date", "Workout Name", "Exercise Name", "Weight", "Reps"]) == "strong"


def test_detect_hevy():
    assert detect_format(["title", "start_time", "exercise_title", "weight_lbs", "reps"]) == "hevy"


def test_detect_fitnotes():
    assert detect_format(["Date", "Exercise", "Category", "Weight", "Reps"]) == "fitnotes"


def test_detect_unknown():
    assert detect_format(["col1", "col2"]) == "unknown"


# --- Strong parsing ---

STRONG_CSV = """Date,Workout Name,Exercise Name,Weight,Reps,RPE
2024-01-15T10:00:00,Push Day,Bench Press (Barbell),100,8,8
2024-01-15T10:00:00,Push Day,Bench Press (Barbell),100,7,8.5
2024-01-15T10:00:00,Push Day,Overhead Press,60,10,"""


def test_parse_strong_groups_exercises():
    workouts = parse_csv(STRONG_CSV)
    assert len(workouts) == 1
    assert workouts[0].name == "Push Day"
    assert len(workouts[0].exercises) == 2
    bench = workouts[0].exercises[0]
    assert bench.name == "Bench Press (Barbell)"
    assert len(bench.sets) == 2


def test_parse_strong_weight_conversion_lbs():
    workouts = parse_csv(STRONG_CSV, weight_unit="lbs")
    bench_set = workouts[0].exercises[0].sets[0]
    assert bench_set.weight_kg < 100  # converted from lbs


def test_parse_strong_date_parsing():
    workouts = parse_csv(STRONG_CSV)
    assert workouts[0].date.year == 2024
    assert workouts[0].date.month == 1


# --- Hevy parsing ---

HEVY_CSV = """title,start_time,exercise_title,set_type,weight_lbs,reps,rpe
Leg Day,15 Jan 2024 10:00,Squat,warmup,135,10,
Leg Day,15 Jan 2024 10:00,Squat,normal,225,5,8"""


def test_parse_hevy_set_type_normalization():
    workouts = parse_csv(HEVY_CSV, fmt="hevy")
    sets = workouts[0].exercises[0].sets
    assert sets[0].set_type == "warm-up"
    assert sets[1].set_type == "normal"


def test_parse_hevy_date():
    workouts = parse_csv(HEVY_CSV, fmt="hevy")
    assert workouts[0].date.day == 15


# --- Weight rounding ---


def test_weight_rounding_float_precision():
    assert _round_weight(185.00000000000003) == 185.0


def test_weight_rounding_quarter_kg():
    assert _round_weight(60.1) == 60.0
    assert _round_weight(60.13) == 60.25


# --- Edge cases ---


def test_empty_csv():
    assert parse_csv("") == []


def test_csv_headers_only():
    assert parse_csv("Date,Workout Name,Exercise Name,Weight,Reps\n") == []


def test_unknown_format_raises():
    with pytest.raises(ValueError, match="Unknown format"):
        parse_csv("a,b\n1,2", fmt="garmin")


def test_malformed_date_raises():
    bad = "title,start_time,exercise_title,set_type,weight_lbs,reps,rpe\nW,not-a-date,Ex,normal,100,5,"
    with pytest.raises(ValueError):
        parse_csv(bad, fmt="hevy")
