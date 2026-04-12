"""CSV parser for Strong, Hevy, and FitNotes workout data."""

import csv
import io
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

LBS_PER_KG = 2.20462

SET_TYPE_MAP = {"warmup": "warm-up", "dropset": "drop-set", "failure": "normal"}


@dataclass
class ImportedSet:
    weight_kg: float
    reps: int
    rpe: float | None = None
    set_type: str = "normal"  # normal, warmup, failure, dropset
    notes: str = ""


@dataclass
class ImportedExercise:
    name: str
    sets: list[ImportedSet] = field(default_factory=list)


@dataclass
class ImportedWorkout:
    date: datetime
    name: str
    duration_minutes: int | None = None
    exercises: list[ImportedExercise] = field(default_factory=list)


def _round_weight(w: float) -> float:
    """Round to nearest 0.25 kg."""
    return round(w * 4) / 4


def _to_kg(val: str | float, unit: str) -> float:
    w = float(val) if val else 0.0
    if unit == "lbs":
        w /= LBS_PER_KG
    return _round_weight(w)


def detect_format(header: list[str]) -> Literal["strong", "hevy", "fitnotes", "unknown"]:
    h = {c.strip() for c in header}
    if "Exercise Name" in h:
        return "strong"
    if "exercise_title" in h:
        return "hevy"
    if "Exercise" in h and "Category" in h:
        return "fitnotes"
    return "unknown"


def parse_csv(
    content: str, fmt: str | None = None, weight_unit: str = "kg"
) -> list[ImportedWorkout]:
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        return []
    if fmt is None:
        fmt = detect_format(list(rows[0].keys()))
    parsers = {"strong": _parse_strong, "hevy": _parse_hevy, "fitnotes": _parse_fitnotes}
    parser = parsers.get(fmt)
    if not parser:
        raise ValueError(f"Unknown format: {fmt}")
    return parser(rows, weight_unit)


def _group_workouts(rows: list[dict], key_fn, date_fn, name_fn, set_fn) -> list[ImportedWorkout]:
    """Generic grouping: rows → workouts → exercises → sets."""
    groups: dict[str, list[dict]] = {}
    for r in rows:
        k = key_fn(r)
        groups.setdefault(k, []).append(r)

    workouts = []
    for _, group in groups.items():
        dt = date_fn(group[0])
        name = name_fn(group[0])
        exercises: dict[str, ImportedExercise] = {}
        for r in group:
            ex_name = (
                r.get("Exercise Name") or r.get("exercise_title") or r.get("Exercise", "Unknown")
            )
            if ex_name not in exercises:
                exercises[ex_name] = ImportedExercise(name=ex_name)
            exercises[ex_name].sets.append(set_fn(r))
        workouts.append(ImportedWorkout(date=dt, name=name, exercises=list(exercises.values())))
    return sorted(workouts, key=lambda w: w.date)


def _parse_strong(rows: list[dict], weight_unit: str) -> list[ImportedWorkout]:
    return _group_workouts(
        rows,
        key_fn=lambda r: f"{r.get('Date', '')}|{r.get('Workout Name', '')}",
        date_fn=lambda r: datetime.fromisoformat(r["Date"]),
        name_fn=lambda r: r.get("Workout Name", "Workout"),
        set_fn=lambda r: ImportedSet(
            weight_kg=_to_kg(r.get("Weight", 0), weight_unit),
            reps=int(float(r.get("Reps", 0))),
            rpe=float(r["RPE"]) if r.get("RPE") else None,
        ),
    )


def _parse_hevy(rows: list[dict], weight_unit: str) -> list[ImportedWorkout]:
    # Hevy weight_lbs column — always convert to kg regardless of weight_unit param
    def hevy_set(r: dict) -> ImportedSet:
        raw_type = r.get("set_type", "normal").lower()
        set_type = SET_TYPE_MAP.get(raw_type, raw_type)
        return ImportedSet(
            weight_kg=_to_kg(r.get("weight_lbs", 0), "lbs"),
            reps=int(float(r.get("reps", 0))),
            rpe=float(r["rpe"]) if r.get("rpe") else None,
            set_type=set_type,
        )

    def parse_hevy_date(r: dict) -> datetime:
        raw = r.get("start_time", "")
        for fmt in ("%d %b %Y, %H:%M", "%d %b %Y %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(raw)
        except (ValueError, TypeError):
            raise ValueError(f"Could not parse date: {raw}")

    return _group_workouts(
        rows,
        key_fn=lambda r: f"{r.get('title', '')}|{r.get('start_time', '')}",
        date_fn=parse_hevy_date,
        name_fn=lambda r: r.get("title", "Workout"),
        set_fn=hevy_set,
    )


def _parse_fitnotes(rows: list[dict], weight_unit: str) -> list[ImportedWorkout]:
    return _group_workouts(
        rows,
        key_fn=lambda r: r.get("Date", ""),
        date_fn=lambda r: datetime.strptime(r["Date"], "%Y-%m-%d"),
        name_fn=lambda r: r.get("Category", "Workout"),
        set_fn=lambda r: ImportedSet(
            weight_kg=_to_kg(r.get("Weight", 0), weight_unit),
            reps=int(float(r.get("Reps", 0))),
        ),
    )
