#!/usr/bin/env python3
"""Enrich exercises with data from free-exercise-db (yuhonas/free-exercise-db).

This script:
1. Fetches the free-exercise-db dataset (873 exercises with instructions + images)
2. Fuzzy-matches against our existing exercises
3. Enriches with: instructions, secondary_muscles, image_url
4. Sets animation_url for matched exercises using the image URLs as animated demos

Usage:
    python scripts/enrich_from_free_db.py
"""

from __future__ import annotations

import difflib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

CACHE_DIR = PROJECT_ROOT / "scripts" / "wger_cache"
FREE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
MATCH_THRESHOLD = 0.80


def fetch_free_db(use_cache: bool = True) -> list[dict]:
    """Fetch the free-exercise-db dataset."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / "free_exercise_db.json"

    if use_cache and cache_file.exists():
        print(f"  [cache hit] {cache_file.name}")
        return json.loads(cache_file.read_text())

    print(f"  [fetching] {FREE_DB_URL[:80]}...")
    req = Request(FREE_DB_URL, headers={"User-Agent": "Repwise/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        cache_file.write_text(json.dumps(data, indent=2))
        print(f"  → {len(data)} exercises fetched")
        return data
    except (HTTPError, URLError, TimeoutError) as e:
        if cache_file.exists():
            print(f"  [warn] Fetch failed ({e}), using stale cache")
            return json.loads(cache_file.read_text())
        raise


def normalize(name: str) -> str:
    """Normalize exercise name for matching."""
    s = name.lower().strip()
    # Remove common suffixes/prefixes
    s = re.sub(r"\b(exercise|movement|with|using)\b", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def find_best_match(
    our_name: str,
    free_db: list[dict],
    free_db_normalized: dict[str, dict],
) -> Optional[tuple[dict, float]]:
    """Find the best matching exercise from free-exercise-db."""
    norm = normalize(our_name)

    # Exact match first
    if norm in free_db_normalized:
        return free_db_normalized[norm], 1.0

    # Fuzzy match
    best_score = 0.0
    best_match = None
    for fdb_norm, fdb_ex in free_db_normalized.items():
        score = difflib.SequenceMatcher(None, norm, fdb_norm).ratio()
        if score > best_score:
            best_score = score
            best_match = fdb_ex

    if best_score >= MATCH_THRESHOLD and best_match:
        return best_match, best_score
    return None


MUSCLE_MAP = {
    "abdominals": "abs",
    "abductors": "glutes",
    "adductors": "quads",
    "biceps": "biceps",
    "calves": "calves",
    "chest": "chest",
    "forearms": "forearms",
    "glutes": "glutes",
    "hamstrings": "hamstrings",
    "lats": "back",
    "lower back": "back",
    "middle back": "back",
    "neck": "traps",
    "quadriceps": "quads",
    "shoulders": "shoulders",
    "traps": "traps",
    "triceps": "triceps",
}


def map_muscles(muscles: list[str], primary_group: str) -> list[str]:
    """Map free-exercise-db muscle names to our muscle groups."""
    result = set()
    for m in muscles:
        mapped = MUSCLE_MAP.get(m.lower(), None)
        if mapped and mapped != primary_group:
            result.add(mapped)
    return sorted(result)


def load_existing_exercises() -> list[dict]:
    """Load current exercises."""
    from src.modules.training.exercises import EXERCISES
    return list(EXERCISES)


def format_exercise_dict(ex: dict, img_var: str = "_IMG") -> str:
    """Format a single exercise dict as a Python source string."""
    lines = []
    lines.append("    {")

    def _fmt(val):
        if val is None:
            return "None"
        if isinstance(val, bool):
            return "True" if val else "False"
        if isinstance(val, list):
            if not val:
                return "[]"
            formatted_items = []
            for v in val:
                if isinstance(v, str):
                    escaped = v.replace("\\", "\\\\").replace('"', '\\"')
                    formatted_items.append(f'"{escaped}"')
                else:
                    formatted_items.append(repr(v))
            joined = ", ".join(formatted_items)
            if len(joined) > 80:
                inner = ",\n            ".join(formatted_items)
                return f"[\n            {inner},\n        ]"
            return f"[{joined}]"
        if isinstance(val, str):
            escaped = val.replace("\\", "\\\\").replace('"', '\\"')
            return f'"{escaped}"'
        return repr(val)

    for key in [
        "id", "name", "muscle_group", "secondary_muscles",
        "equipment", "category", "image_url", "animation_url",
        "description", "instructions", "tips",
    ]:
        val = ex.get(key)
        if key == "image_url" and val and val.startswith(_IMG):
            suffix = val[len(_IMG):]
            lines.append(f'        "{key}": f"{{{img_var}}}{suffix}",')
        else:
            lines.append(f'        "{key}": {_fmt(val)},')

    lines.append("    },")
    return "\n".join(lines)


def group_exercises_by_muscle(exercises: list[dict]) -> dict[str, list[dict]]:
    """Group exercises by muscle_group."""
    groups: dict[str, list[dict]] = {}
    for ex in exercises:
        mg = ex["muscle_group"]
        if mg not in groups:
            groups[mg] = []
        groups[mg].append(ex)
    return groups


def write_exercises_py(exercises: list[dict]) -> None:
    """Write the complete exercises.py file."""
    target = PROJECT_ROOT / "src" / "modules" / "training" / "exercises.py"
    existing_content = target.read_text()

    func_marker = "\ndef get_all_exercises"
    func_idx = existing_content.find(func_marker)
    if func_idx == -1:
        func_marker = "\n\ndef get_all_exercises"
        func_idx = existing_content.find(func_marker)

    functions_section = ""
    if func_idx != -1:
        functions_section = existing_content[func_idx:]

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
    lines.append(f'_IMG = "{_IMG}"')
    lines.append("")

    grouped = group_exercises_by_muscle(exercises)
    muscle_order = [
        "chest", "back", "shoulders", "quads", "hamstrings", "glutes",
        "biceps", "triceps", "calves", "abs", "traps", "forearms", "full_body",
    ]

    lines.append("EXERCISES: list[dict] = [")
    for mg in muscle_order:
        group = grouped.get(mg, [])
        if not group:
            continue
        lines.append(f"    # ===== {mg.upper()} ({len(group)} exercises) =====")
        for ex in group:
            lines.append(format_exercise_dict(ex))
    lines.append("]")
    lines.append("")

    if functions_section:
        lines.append(functions_section.strip())
        lines.append("")

    target.write_text("\n".join(lines) + "\n")
    print(f"\n✅ Wrote {len(exercises)} exercises to {target}")


def main() -> None:
    print("=" * 60)
    print("Free Exercise DB Enrichment Script")
    print("=" * 60)

    print("\n📂 Loading existing exercises...")
    exercises = load_existing_exercises()
    print(f"  → {len(exercises)} exercises loaded")

    print("\n📡 Fetching free-exercise-db dataset...")
    free_db = fetch_free_db()

    # Build normalized lookup
    free_db_normalized: dict[str, dict] = {}
    for fdb_ex in free_db:
        norm = normalize(fdb_ex.get("name", ""))
        if norm:
            free_db_normalized[norm] = fdb_ex

    print(f"\n🔄 Enriching exercises...")
    matched = 0
    enriched_instructions = 0
    enriched_secondary = 0
    enriched_animation = 0

    for ex in exercises:
        result = find_best_match(ex["name"], free_db, free_db_normalized)
        if result is None:
            continue

        fdb_ex, score = result
        matched += 1

        # Enrich instructions if we don't have them
        if not ex.get("instructions") and fdb_ex.get("instructions"):
            ex["instructions"] = fdb_ex["instructions"]
            enriched_instructions += 1

        # Enrich secondary muscles if empty
        if not ex.get("secondary_muscles") and fdb_ex.get("secondaryMuscles"):
            mapped = map_muscles(fdb_ex["secondaryMuscles"], ex["muscle_group"])
            if mapped:
                ex["secondary_muscles"] = mapped
                enriched_secondary += 1

        # Set animation_url from free-exercise-db images (second image as "animation")
        images = fdb_ex.get("images", [])
        if not ex.get("animation_url") and len(images) >= 2:
            # Use the second image as the "animation" frame
            ex["animation_url"] = f"{_IMG}/{images[1]}"
            enriched_animation += 1
        elif not ex.get("animation_url") and len(images) >= 1:
            # Use first image as animation if only one available
            ex["animation_url"] = f"{_IMG}/{images[0]}"
            enriched_animation += 1

        # Ensure image_url is set
        if not ex.get("image_url") and images:
            ex["image_url"] = f"{_IMG}/{images[0]}"

    print(f"  → {matched} exercises matched ({matched*100//len(exercises)}%)")
    print(f"  → {enriched_instructions} enriched with instructions")
    print(f"  → {enriched_secondary} enriched with secondary muscles")
    print(f"  → {enriched_animation} enriched with animation_url")

    # Stats
    img_count = sum(1 for e in exercises if e.get("image_url"))
    anim_count = sum(1 for e in exercises if e.get("animation_url"))
    instr_count = sum(1 for e in exercises if e.get("instructions"))
    sec_count = sum(1 for e in exercises if e.get("secondary_muscles"))

    print(f"\n📊 Final Stats:")
    print(f"  Total exercises:    {len(exercises)}")
    print(f"  Image coverage:     {img_count}/{len(exercises)} ({100*img_count//len(exercises)}%)")
    print(f"  Animation coverage: {anim_count}/{len(exercises)} ({100*anim_count//len(exercises)}%)")
    print(f"  Instructions:       {instr_count}/{len(exercises)} ({100*instr_count//len(exercises)}%)")
    print(f"  Secondary muscles:  {sec_count}/{len(exercises)} ({100*sec_count//len(exercises)}%)")

    write_exercises_py(exercises)

    print("\n🎉 Done!")
    print('  python -c "from src.modules.training.exercises import EXERCISES; print(len(EXERCISES))"')


if __name__ == "__main__":
    main()
