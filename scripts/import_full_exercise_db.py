#!/usr/bin/env python3
"""
Import exercises from free-exercise-db JSON into exercises.py.

Merges: keeps all existing exercises (they have custom data), adds new ones from repo.
Match by name (case-insensitive) to avoid duplicates.
"""

import json
import re
import sys
import os

REPO_JSON = "/tmp/free_exercise_db.json"
EXERCISES_PY = "src/modules/training/exercises.py"

# ── Mapping tables ──────────────────────────────────────────────────────────

MUSCLE_MAP = {
    "abdominals": "abs",
    "abductors": "glutes",
    "adductors": "glutes",
    "biceps": "biceps",
    "calves": "calves",
    "chest": "chest",
    "forearms": "forearms",
    "glutes": "glutes",
    "hamstrings": "hamstrings",
    "lats": "back",
    "lower back": "back",
    "middle back": "back",
    "neck": "shoulders",
    "quadriceps": "quads",
    "shoulders": "shoulders",
    "traps": "shoulders",
    "triceps": "triceps",
}

EQUIPMENT_MAP = {
    "body only": "bodyweight",
    "bands": "band",
    "e-z curl bar": "barbell",
    "exercise ball": "bodyweight",
    "foam roll": "bodyweight",
    "kettlebells": "kettlebell",
    "medicine ball": "bodyweight",
    "none": "bodyweight",
    "other": "bodyweight",
    # pass-through
    "barbell": "barbell",
    "cable": "cable",
    "dumbbell": "dumbbell",
    "machine": "machine",
}


def name_to_id(name: str) -> str:
    """Convert exercise name to kebab-case id."""
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s


def map_exercise(ex: dict) -> dict:
    """Convert a repo exercise dict to our format."""
    primary = ex.get("primaryMuscles", [])
    muscle_group = MUSCLE_MAP.get(primary[0].lower(), "other") if primary else "other"

    secondary = ex.get("secondaryMuscles", [])
    mapped_secondary = []
    for m in secondary:
        mapped = MUSCLE_MAP.get(m.lower())
        if mapped and mapped != muscle_group:
            mapped_secondary.append(mapped)
    # deduplicate while preserving order
    seen = set()
    deduped_secondary = []
    for m in mapped_secondary:
        if m not in seen:
            seen.add(m)
            deduped_secondary.append(m)

    raw_equip = (ex.get("equipment") or "bodyweight").lower()
    equipment = EQUIPMENT_MAP.get(raw_equip, raw_equip)

    mechanic = ex.get("mechanic")
    category = mechanic if mechanic in ("compound", "isolation") else "compound"

    repo_id = ex.get("id", "")
    image_url = f"/static/exercises/{repo_id}/0.jpg" if repo_id else None
    animation_url = f"/static/exercises/{repo_id}/1.jpg" if repo_id else None

    instructions = ex.get("instructions", [])

    return {
        "id": name_to_id(ex["name"]),
        "name": ex["name"],
        "muscle_group": muscle_group,
        "secondary_muscles": deduped_secondary,
        "equipment": equipment,
        "category": category,
        "image_url": image_url,
        "animation_url": animation_url,
        "description": None,
        "instructions": instructions,
        "tips": None,
    }



def format_exercise(ex: dict, indent: str = "    ") -> str:
    """Format a single exercise dict as Python source code."""
    lines = [f"{indent}{{"]
    lines.append(f'{indent}    "id": {repr(ex["id"])},')
    lines.append(f'{indent}    "name": {repr(ex["name"])},')
    lines.append(f'{indent}    "muscle_group": {repr(ex["muscle_group"])},')
    lines.append(f'{indent}    "secondary_muscles": {repr(ex["secondary_muscles"])},')
    lines.append(f'{indent}    "equipment": {repr(ex["equipment"])},')
    lines.append(f'{indent}    "category": {repr(ex["category"])},')
    lines.append(f'{indent}    "image_url": {repr(ex["image_url"])},')
    lines.append(f'{indent}    "animation_url": {repr(ex["animation_url"])},')
    lines.append(f'{indent}    "description": {repr(ex["description"])},')

    # instructions
    if ex["instructions"]:
        lines.append(f'{indent}    "instructions": [')
        for instr in ex["instructions"]:
            lines.append(f"{indent}        {repr(instr)},")
        lines.append(f"{indent}    ],")
    else:
        lines.append(f'{indent}    "instructions": [],')

    lines.append(f'{indent}    "tips": {repr(ex["tips"])},')
    lines.append(f"{indent}}},")
    return "\n".join(lines)


def extract_existing_exercises() -> list[dict]:
    """Import existing exercises from the module."""
    # We need to add the project root to sys.path
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    from src.modules.training.exercises import EXERCISES
    return list(EXERCISES)


# ── Muscle group display order ──────────────────────────────────────────────

MUSCLE_GROUP_ORDER = [
    "chest", "back", "shoulders", "biceps", "triceps", "forearms",
    "quads", "hamstrings", "glutes", "calves", "abs",
]


def main():
    # 1. Load repo JSON
    with open(REPO_JSON) as f:
        repo_exercises = json.load(f)
    print(f"Loaded {len(repo_exercises)} exercises from repo JSON")

    # 2. Load existing exercises
    existing = extract_existing_exercises()
    existing_names = {ex["name"].lower() for ex in existing}
    print(f"Existing exercises: {len(existing)}")

    # 3. Map new exercises
    new_exercises = []
    skipped = 0
    for rex in repo_exercises:
        if rex["name"].lower() in existing_names:
            skipped += 1
            continue
        mapped = map_exercise(rex)
        new_exercises.append(mapped)
    print(f"New exercises to add: {len(new_exercises)}")
    print(f"Skipped (already exist): {skipped}")

    # 4. Combine all exercises, dedup IDs by appending suffix
    all_exercises = existing + new_exercises
    seen_ids: set[str] = set()
    for ex in all_exercises:
        base_id = ex["id"]
        if base_id in seen_ids:
            # Append a numeric suffix
            for suffix in range(2, 100):
                candidate = f"{base_id}-{suffix}"
                if candidate not in seen_ids:
                    ex["id"] = candidate
                    break
        seen_ids.add(ex["id"])

    # 5. Group by muscle_group
    groups: dict[str, list[dict]] = {}
    for ex in all_exercises:
        mg = ex["muscle_group"]
        groups.setdefault(mg, []).append(ex)

    # Sort each group by name
    for mg in groups:
        groups[mg].sort(key=lambda e: e["name"].lower())

    # 6. Generate the Python file
    lines = []
    lines.append('"""')
    lines.append("Static exercise database for Repwise.")
    lines.append("")
    lines.append("Auto-generated — DO NOT EDIT MANUALLY.")
    lines.append('"""')
    lines.append("")
    lines.append("from __future__ import annotations")
    lines.append("from typing import Optional")
    lines.append("")
    lines.append("")
    lines.append("EXERCISES: list[dict] = [")

    total = 0
    for mg in MUSCLE_GROUP_ORDER:
        if mg not in groups:
            continue
        exs = groups[mg]
        total += len(exs)
        lines.append(f"    # ===== {mg.upper()} ({len(exs)} exercises) =====")
        for ex in exs:
            lines.append(format_exercise(ex))

    # Any muscle groups not in our order list
    for mg in sorted(groups.keys()):
        if mg in MUSCLE_GROUP_ORDER:
            continue
        exs = groups[mg]
        total += len(exs)
        lines.append(f"    # ===== {mg.upper()} ({len(exs)} exercises) =====")
        for ex in exs:
            lines.append(format_exercise(ex))

    lines.append("]")
    lines.append("")
    lines.append('_MUSCLE_GROUPS = sorted({ex["muscle_group"] for ex in EXERCISES})')
    lines.append("")
    lines.append("")
    lines.append("def get_all_exercises() -> list[dict]:")
    lines.append('    """Return every exercise in the database."""')
    lines.append("    return EXERCISES")
    lines.append("")
    lines.append("")
    lines.append("def search_exercises(")
    lines.append("    query: str,")
    lines.append("    muscle_group: Optional[str] = None,")
    lines.append("    equipment: Optional[str] = None,")
    lines.append("    category: Optional[str] = None,")
    lines.append(") -> list[dict]:")
    lines.append('    """Case-insensitive name search with optional muscle group, equipment, and category filters."""')
    lines.append("    q = query.lower()")
    lines.append('    results = [ex for ex in EXERCISES if q in ex["name"].lower()]')
    lines.append("    if muscle_group:")
    lines.append("        mg = muscle_group.lower()")
    lines.append('        results = [ex for ex in results if ex["muscle_group"] == mg]')
    lines.append("    if equipment:")
    lines.append("        eq = equipment.lower()")
    lines.append('        results = [ex for ex in results if ex["equipment"] == eq]')
    lines.append("    if category:")
    lines.append("        cat = category.lower()")
    lines.append('        results = [ex for ex in results if ex["category"] == cat]')
    lines.append("    return results")
    lines.append("")
    lines.append("")
    lines.append("def get_muscle_groups() -> list[str]:")
    lines.append('    """Return sorted list of all muscle group names."""')
    lines.append("    return _MUSCLE_GROUPS")
    lines.append("")

    content = "\n".join(lines)

    # 7. Write the file
    with open(EXERCISES_PY, "w") as f:
        f.write(content)

    print(f"\nWrote {total} exercises to {EXERCISES_PY}")
    print(f"File size: {len(content):,} bytes")

    # 8. Verify
    # Re-import to verify
    import importlib
    if "src.modules.training.exercises" in sys.modules:
        del sys.modules["src.modules.training.exercises"]
    from src.modules.training.exercises import EXERCISES as verified
    print(f"Verification: {len(verified)} exercises loaded successfully")


if __name__ == "__main__":
    main()
