#!/usr/bin/env python3
"""Import exercises from the wger public API and merge with existing exercises.

Fetches exercises from https://wger.de/api/v2/, maps wger muscle/equipment
categories to our 13 muscle groups and 8 equipment types, deduplicates against
existing exercises by name similarity, and writes the merged EXERCISES list
back to exercises.py.

API responses are cached locally in scripts/wger_cache/ so the script is
idempotent and doesn't hammer the wger API on repeated runs.

Usage:
    python scripts/import_wger.py          # fetch + merge + write
    python scripts/import_wger.py --dry    # fetch + merge, print stats only
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import textwrap
import time
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CACHE_DIR = SCRIPT_DIR / "wger_cache"
EXERCISES_PY = PROJECT_ROOT / "src" / "modules" / "training" / "exercises.py"

# ---------------------------------------------------------------------------
# wger API endpoints
# ---------------------------------------------------------------------------

WGER_EXERCISE_URL = (
    "https://wger.de/api/v2/exercise/?format=json&language=2&limit=500"
)
WGER_EXERCISE_INFO_URL = (
    "https://wger.de/api/v2/exerciseinfo/?format=json&limit=500"
)
WGER_MUSCLE_URL = "https://wger.de/api/v2/muscle/?format=json&limit=100"
WGER_EQUIPMENT_URL = "https://wger.de/api/v2/equipment/?format=json&limit=100"
WGER_EXERCISE_IMAGE_URL = (
    "https://wger.de/api/v2/exerciseimage/?format=json&limit=1000"
)
WGER_EXERCISE_CATEGORY_URL = (
    "https://wger.de/api/v2/exercisecategory/?format=json&limit=50"
)

# ---------------------------------------------------------------------------
# Mapping: wger muscle IDs → our 13 muscle groups
#
# wger muscle IDs (from /api/v2/muscle/):
#   1  Biceps brachii              → biceps
#   2  Anterior deltoid            → shoulders
#   3  Serratus anterior           → chest
#   4  Pectoralis major            → chest
#   5  Obliquus externus abdominis → abs
#   6  Gastrocnemius               → calves
#   7  Brachialis                  → biceps
#   8  Gluteus maximus             → glutes
#   9  Trapezius                   → traps
#  10  Rectus abdominis            → abs
#  11  Soleus                      → calves
#  12  Biceps femoris              → hamstrings
#  13  Latissimus dorsi            → back
#  14  Triceps brachii             → triceps
#  15  Infraspinatus               → back
#  16  Erector spinae              → back
# ---------------------------------------------------------------------------

WGER_MUSCLE_TO_GROUP: dict[int, str] = {
    1: "biceps",
    2: "shoulders",
    3: "chest",
    4: "chest",
    5: "abs",
    6: "calves",
    7: "biceps",
    8: "glutes",
    9: "traps",
    10: "abs",
    11: "calves",
    12: "hamstrings",
    13: "back",
    14: "triceps",
    15: "back",
    16: "back",
}

# ---------------------------------------------------------------------------
# Mapping: wger equipment IDs → our 8 equipment types
#
# wger equipment IDs (from /api/v2/equipment/):
#   1  Barbell          → barbell
#   2  SZ-Bar           → barbell
#   3  Dumbbell         → dumbbell
#   4  Gym mat          → bodyweight
#   5  Swiss Ball       → bodyweight
#   6  Pull-up bar      → bodyweight
#   7  none (bodyweight) → bodyweight
#   8  Bench            → bodyweight  (bench is not an equipment type for us)
#   9  Incline bench    → bodyweight
#  10  Kettlebell       → kettlebell
# ---------------------------------------------------------------------------

WGER_EQUIPMENT_TO_TYPE: dict[int, str] = {
    1: "barbell",
    2: "barbell",       # SZ-bar / EZ-bar
    3: "dumbbell",
    4: "bodyweight",    # gym mat
    5: "bodyweight",    # swiss ball
    6: "bodyweight",    # pull-up bar
    7: "bodyweight",    # none / bodyweight
    8: "bodyweight",    # bench (accessory, not primary equipment)
    9: "bodyweight",    # incline bench
    10: "kettlebell",
}

# ---------------------------------------------------------------------------
# Mapping: wger exercise category IDs → our compound/isolation heuristic
#
# wger categories (from /api/v2/exercisecategory/):
#   8  Arms        → isolation
#   9  Legs        → compound
#  10  Abs         → isolation
#  11  Chest       → compound
#  12  Back        → compound
#  13  Shoulders   → compound
#  14  Calves      → isolation
#  15  Cardio      → compound (full_body)
# ---------------------------------------------------------------------------

WGER_CATEGORY_TO_COMPOUND: dict[int, str] = {
    8: "isolation",
    9: "compound",
    10: "isolation",
    11: "compound",
    12: "compound",
    13: "compound",
    14: "isolation",
    15: "compound",
}

# wger category → our muscle group fallback (when no muscles listed)
WGER_CATEGORY_FALLBACK_MUSCLE: dict[int, str] = {
    8: "biceps",      # Arms — default to biceps
    9: "quads",       # Legs — default to quads
    10: "abs",
    11: "chest",
    12: "back",
    13: "shoulders",
    14: "calves",
    15: "full_body",  # Cardio
}

# Our valid muscle groups
VALID_MUSCLE_GROUPS = {
    "chest", "back", "shoulders", "biceps", "triceps",
    "quads", "hamstrings", "glutes", "calves", "abs",
    "traps", "forearms", "full_body",
}

# Our valid equipment types
VALID_EQUIPMENT = {
    "barbell", "dumbbell", "cable", "machine",
    "bodyweight", "band", "kettlebell", "smith_machine",
}

# Name similarity threshold for deduplication
DEDUP_THRESHOLD = 0.80


# ---------------------------------------------------------------------------
# HTTP helpers with caching
# ---------------------------------------------------------------------------

def _ensure_cache_dir() -> None:
    """Create the cache directory if it doesn't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_path(url: str) -> Path:
    """Return a deterministic cache file path for a URL."""
    # Use a simple hash of the URL as filename
    safe = re.sub(r"[^a-zA-Z0-9]", "_", url)[:120]
    return CACHE_DIR / f"{safe}.json"


def fetch_json(url: str, use_cache: bool = True) -> Any:
    """Fetch JSON from a URL, with local file caching.

    If a cached response exists and *use_cache* is True, return it without
    hitting the network.  Otherwise fetch, cache, and return.
    """
    _ensure_cache_dir()
    cache_file = _cache_path(url)

    if use_cache and cache_file.exists():
        print(f"  [cache hit] {url[:80]}...")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    print(f"  [fetching] {url[:80]}...")
    req = Request(url, headers={"User-Agent": "Repwise-ImportScript/1.0"})

    try:
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        print(f"  [error] Failed to fetch {url}: {exc}")
        raise

    cache_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
    # Be polite — small delay between requests
    time.sleep(0.5)
    return data


def fetch_all_pages(base_url: str, use_cache: bool = True) -> list[dict]:
    """Fetch all pages from a paginated wger API endpoint."""
    results: list[dict] = []
    url: Optional[str] = base_url
    page = 1

    while url:
        data = fetch_json(url, use_cache=use_cache)
        results.extend(data.get("results", []))
        url = data.get("next")
        page += 1

        # Safety valve — don't fetch more than 20 pages
        if page > 20:
            print("  [warn] Stopping pagination at 20 pages")
            break

    return results


# ---------------------------------------------------------------------------
# Name normalization
# ---------------------------------------------------------------------------

def to_kebab_case(name: str) -> str:
    """Convert an exercise name to a kebab-case ID.

    Examples:
        "Barbell Bench Press" → "barbell-bench-press"
        "Dumbbell Bicep Curl (Seated)" → "dumbbell-bicep-curl-seated"
        "EZ-Bar Curl" → "ez-bar-curl"
    """
    # Remove parentheses but keep their content
    s = re.sub(r"[()]", " ", name)
    # Replace non-alphanumeric (except hyphens) with spaces
    s = re.sub(r"[^a-zA-Z0-9\-]", " ", s)
    # Collapse whitespace and strip
    s = re.sub(r"\s+", " ", s).strip()
    # Convert to lowercase kebab
    return s.lower().replace(" ", "-")


def normalize_name(name: str) -> str:
    """Normalize an exercise name for comparison."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


# ---------------------------------------------------------------------------
# Exercise building
# ---------------------------------------------------------------------------

def determine_muscle_group(
    muscles: list[int],
    muscles_secondary: list[int],
    category_id: int,
) -> str:
    """Determine the primary muscle group from wger muscle IDs.

    Priority:
    1. First primary muscle that maps to a known group
    2. Category-based fallback
    3. "full_body" as last resort
    """
    for mid in muscles:
        group = WGER_MUSCLE_TO_GROUP.get(mid)
        if group and group in VALID_MUSCLE_GROUPS:
            return group

    # Fallback to category
    return WGER_CATEGORY_FALLBACK_MUSCLE.get(category_id, "full_body")


def determine_secondary_muscles(
    muscles: list[int],
    muscles_secondary: list[int],
    primary_group: str,
) -> list[str]:
    """Build the secondary_muscles list from wger muscle IDs.

    Includes secondary muscles from wger, plus any primary muscles that
    map to a different group than the chosen primary.
    """
    secondary = set()

    # All explicitly secondary muscles
    for mid in muscles_secondary:
        group = WGER_MUSCLE_TO_GROUP.get(mid)
        if group and group in VALID_MUSCLE_GROUPS and group != primary_group:
            secondary.add(group)

    # Primary muscles that map to a different group (e.g., bench press
    # has pectoralis + anterior deltoid → chest primary, shoulders secondary)
    for mid in muscles:
        group = WGER_MUSCLE_TO_GROUP.get(mid)
        if group and group in VALID_MUSCLE_GROUPS and group != primary_group:
            secondary.add(group)

    return sorted(secondary)


def determine_equipment(equipment_ids: list[int]) -> str:
    """Determine equipment type from wger equipment IDs.

    If multiple equipment items, pick the most specific one (prefer
    barbell/dumbbell/kettlebell over bodyweight).
    """
    if not equipment_ids:
        return "bodyweight"

    mapped = []
    for eid in equipment_ids:
        eq = WGER_EQUIPMENT_TO_TYPE.get(eid, "bodyweight")
        mapped.append(eq)

    # Prefer specific equipment over bodyweight
    priority = ["barbell", "dumbbell", "kettlebell", "cable", "machine",
                 "smith_machine", "band", "bodyweight"]
    for p in priority:
        if p in mapped:
            return p

    return mapped[0] if mapped else "bodyweight"


def determine_category(
    muscle_group: str,
    equipment: str,
    category_id: int,
    name: str,
) -> str:
    """Determine compound vs isolation.

    Heuristic: use wger category mapping, then override for known patterns.
    """
    cat = WGER_CATEGORY_TO_COMPOUND.get(category_id, "compound")

    # Override: multi-joint movements are always compound
    compound_keywords = [
        "press", "squat", "deadlift", "row", "pull-up", "chin-up",
        "dip", "lunge", "clean", "snatch", "thruster",
    ]
    name_lower = name.lower()
    if any(kw in name_lower for kw in compound_keywords):
        cat = "compound"

    # Override: curls, raises, extensions, flyes are isolation
    isolation_keywords = [
        "curl", "raise", "extension", "fly", "flye", "kickback",
        "pullover", "crossover", "shrug",
    ]
    if any(kw in name_lower for kw in isolation_keywords):
        cat = "isolation"

    return cat


def build_image_url(exercise_id: int, images: dict[int, list[dict]]) -> Optional[str]:
    """Build an image URL for a wger exercise.

    Uses the wger CDN image if available, otherwise returns None.
    """
    exercise_images = images.get(exercise_id, [])
    if not exercise_images:
        return None

    # Prefer main images (is_main=True), then any image
    main_images = [img for img in exercise_images if img.get("is_main")]
    chosen = main_images[0] if main_images else exercise_images[0]

    image_path = chosen.get("image")
    if image_path:
        # wger returns relative paths like "/media/exercise-images/..."
        # or full URLs
        if image_path.startswith("http"):
            return image_path
        return f"https://wger.de{image_path}"

    return None


def clean_html(text: Optional[str]) -> Optional[str]:
    """Strip HTML tags from wger description text."""
    if not text:
        return None
    # Remove HTML tags
    clean = re.sub(r"<[^>]+>", "", text)
    # Collapse whitespace
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean if clean else None


def build_exercise_dict(
    wger_exercise: dict,
    images: dict[int, list[dict]],
) -> Optional[dict]:
    """Convert a wger exercise API object into our exercise dict format.

    Returns None if the exercise should be skipped (e.g., no name, invalid data).
    """
    name = wger_exercise.get("name", "").strip()
    if not name or len(name) < 3:
        return None

    exercise_id = to_kebab_case(name)
    if not exercise_id or len(exercise_id) < 3:
        return None

    wger_id = wger_exercise.get("id", 0)
    muscles = wger_exercise.get("muscles", [])
    muscles_secondary = wger_exercise.get("muscles_secondary", [])
    equipment_ids = wger_exercise.get("equipment", [])
    category_id = wger_exercise.get("category", {})

    # category can be an int or a dict with "id"
    if isinstance(category_id, dict):
        category_id = category_id.get("id", 0)

    muscle_group = determine_muscle_group(muscles, muscles_secondary, category_id)
    secondary = determine_secondary_muscles(muscles, muscles_secondary, muscle_group)
    equipment = determine_equipment(equipment_ids)
    category = determine_category(muscle_group, equipment, category_id, name)
    image_url = build_image_url(wger_id, images)
    description = clean_html(wger_exercise.get("description"))

    return {
        "id": exercise_id,
        "name": name,
        "muscle_group": muscle_group,
        "secondary_muscles": secondary,
        "equipment": equipment,
        "category": category,
        "image_url": image_url,
        "animation_url": None,
        "description": description,
        "instructions": None,
        "tips": None,
    }


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def is_duplicate(
    new_name: str,
    existing_names: set[str],
    existing_ids: set[str],
    new_id: str,
) -> bool:
    """Check if an exercise is a duplicate of an existing one.

    Uses both exact ID match and fuzzy name matching.
    """
    # Exact ID match
    if new_id in existing_ids:
        return True

    # Fuzzy name match
    norm_new = normalize_name(new_name)
    for existing in existing_names:
        norm_existing = normalize_name(existing)
        ratio = difflib.SequenceMatcher(None, norm_new, norm_existing).ratio()
        if ratio >= DEDUP_THRESHOLD:
            return True

    return False


# ---------------------------------------------------------------------------
# exercises.py writer
# ---------------------------------------------------------------------------

def load_existing_exercises() -> list[dict]:
    """Import the current EXERCISES list from exercises.py."""
    # Add project root to path so we can import
    sys.path.insert(0, str(PROJECT_ROOT))
    from src.modules.training.exercises import EXERCISES
    return list(EXERCISES)


def format_exercise_dict(ex: dict, img_var: str = "_IMG") -> str:
    """Format a single exercise dict as a Python source line."""
    parts = []
    parts.append(f'"id": "{ex["id"]}"')
    parts.append(f'"name": "{ex["name"]}"')
    parts.append(f'"muscle_group": "{ex["muscle_group"]}"')

    # secondary_muscles
    sm = ex.get("secondary_muscles", [])
    if sm:
        sm_str = "[" + ", ".join(f'"{m}"' for m in sm) + "]"
    else:
        sm_str = "[]"
    parts.append(f'"secondary_muscles": {sm_str}')

    parts.append(f'"equipment": "{ex["equipment"]}"')
    parts.append(f'"category": "{ex["category"]}"')

    # image_url
    img = ex.get("image_url")
    if img is None:
        parts.append('"image_url": None')
    elif "{_IMG}" in str(img) or img.startswith("https://raw.githubusercontent.com/yuhonas"):
        # Keep f-string reference for existing GitHub-hosted images
        # Extract the path after the base URL
        base = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
        if img.startswith(base):
            rel = img[len(base):]
            parts.append(f'"image_url": f"{{{img_var}}}{rel}"')
        else:
            parts.append(f'"image_url": "{img}"')
    else:
        parts.append(f'"image_url": "{img}"')

    # animation_url
    anim = ex.get("animation_url")
    parts.append(f'"animation_url": {repr(anim)}' if anim else '"animation_url": None')

    # description
    desc = ex.get("description")
    if desc:
        # Escape quotes in description
        desc_escaped = desc.replace("\\", "\\\\").replace('"', '\\"')
        parts.append(f'"description": "{desc_escaped}"')
    else:
        parts.append('"description": None')

    # instructions
    instr = ex.get("instructions")
    if instr:
        parts.append(f'"instructions": {repr(instr)}')
    else:
        parts.append('"instructions": None')

    # tips
    tips = ex.get("tips")
    if tips:
        parts.append(f'"tips": {repr(tips)}')
    else:
        parts.append('"tips": None')

    return "    {" + ", ".join(parts) + "}"



def group_exercises_by_muscle(exercises: list[dict]) -> dict[str, list[dict]]:
    """Group exercises by muscle_group, preserving order."""
    groups: dict[str, list[dict]] = {}
    for ex in exercises:
        mg = ex["muscle_group"]
        groups.setdefault(mg, []).append(ex)
    return groups


def write_exercises_py(exercises: list[dict]) -> None:
    """Write the merged EXERCISES list to exercises.py.

    Preserves the file header, _IMG variable, and organizes exercises
    by muscle group with section comments.
    """
    # Sort exercises: by muscle group (in canonical order), then by name
    muscle_order = [
        "chest", "back", "shoulders", "biceps", "triceps",
        "quads", "hamstrings", "glutes", "calves", "abs",
        "traps", "forearms", "full_body",
    ]

    def sort_key(ex: dict) -> tuple:
        mg = ex["muscle_group"]
        idx = muscle_order.index(mg) if mg in muscle_order else 99
        return (idx, ex["name"].lower())

    exercises_sorted = sorted(exercises, key=sort_key)
    grouped = group_exercises_by_muscle(exercises_sorted)

    # Build the file content
    lines: list[str] = []
    lines.append('"""Static exercise database for Repwise.')
    lines.append("")
    lines.append(f"~{len(exercises)}+ exercises organized by muscle group with search helpers.")
    lines.append('"""')
    lines.append("")
    lines.append("from __future__ import annotations")
    lines.append("from typing import Optional")
    lines.append("")
    lines.append(
        '_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"'
    )
    lines.append("")
    lines.append("EXERCISES: list[dict] = [")

    for mg in muscle_order:
        group_exercises = grouped.get(mg, [])
        if not group_exercises:
            continue

        # Section comment
        label = mg.replace("_", " ").title()
        count = len(group_exercises)
        lines.append(f"    # ─── {label} ({count}) " + "─" * max(1, 55 - len(label) - len(str(count))))

        for ex in group_exercises:
            lines.append(format_exercise_dict(ex) + ",")

        lines.append("")

    lines.append("]")
    lines.append("")
    lines.append("")

    # Now append the helper code — everything after the EXERCISES list
    # This includes _MUSCLE_GROUPS, get_all_exercises, search_exercises,
    # and get_muscle_groups.
    existing_content = EXERCISES_PY.read_text(encoding="utf-8")

    # Find the closing bracket of the EXERCISES list and grab everything after
    # Look for the _MUSCLE_GROUPS line as the start of helper code
    helpers_match = re.search(
        r"^(# Pre-compute lookup structures\n.*)",
        existing_content,
        re.MULTILINE | re.DOTALL,
    )

    if helpers_match:
        helper_code = helpers_match.group(1)
        lines.append(helper_code.rstrip())
        lines.append("")
    else:
        # Fallback: look for get_all_exercises or search_exercises
        fallback_match = re.search(
            r"^((?:_MUSCLE_GROUPS|def\s+get_all_exercises|def\s+search_exercises)\b.*)",
            existing_content,
            re.MULTILINE | re.DOTALL,
        )
        if fallback_match:
            helper_code = fallback_match.group(1)
            lines.append(helper_code.rstrip())
            lines.append("")

    output = "\n".join(lines)
    EXERCISES_PY.write_text(output, encoding="utf-8")
    print(f"\n✅ Wrote {len(exercises)} exercises to {EXERCISES_PY}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def fetch_wger_data(use_cache: bool = True) -> tuple[list[dict], dict[int, list[dict]]]:
    """Fetch exercises and images from the wger API.

    Returns:
        (exercises, images_by_exercise_id)
    """
    print("\n📡 Fetching wger exercise data...")

    # Fetch exercises (English, language=2)
    print("  Fetching exercises...")
    exercises = fetch_all_pages(WGER_EXERCISE_URL, use_cache=use_cache)
    print(f"  → {len(exercises)} exercises fetched")

    # Fetch exercise images
    print("  Fetching exercise images...")
    raw_images = fetch_all_pages(WGER_EXERCISE_IMAGE_URL, use_cache=use_cache)
    print(f"  → {len(raw_images)} images fetched")

    # Index images by exercise ID
    images: dict[int, list[dict]] = {}
    for img in raw_images:
        eid = img.get("exercise_base") or img.get("exercise")
        if eid:
            images.setdefault(eid, []).append(img)

    return exercises, images


def convert_wger_exercises(
    wger_exercises: list[dict],
    images: dict[int, list[dict]],
) -> list[dict]:
    """Convert wger API exercises to our format."""
    print("\n🔄 Converting wger exercises to our format...")
    converted = []
    skipped = 0

    for wex in wger_exercises:
        ex = build_exercise_dict(wex, images)
        if ex is None:
            skipped += 1
            continue
        converted.append(ex)

    print(f"  → {len(converted)} converted, {skipped} skipped")
    return converted


def merge_exercises(
    existing: list[dict],
    new_exercises: list[dict],
) -> list[dict]:
    """Merge new exercises with existing ones, deduplicating by name similarity.

    Existing exercises always take priority — they are never overwritten.
    New exercises are only added if they don't match any existing exercise.
    """
    print("\n🔀 Merging exercises...")

    existing_names = {ex["name"] for ex in existing}
    existing_ids = {ex["id"] for ex in existing}
    merged = list(existing)  # Start with all existing exercises

    added = 0
    dupes = 0

    for new_ex in new_exercises:
        if is_duplicate(new_ex["name"], existing_names, existing_ids, new_ex["id"]):
            dupes += 1
            continue

        # Ensure no ID collision — append a suffix if needed
        base_id = new_ex["id"]
        final_id = base_id
        counter = 2
        while final_id in existing_ids:
            final_id = f"{base_id}-{counter}"
            counter += 1
        new_ex["id"] = final_id

        merged.append(new_ex)
        existing_names.add(new_ex["name"])
        existing_ids.add(new_ex["id"])
        added += 1

    print(f"  → {len(existing)} existing + {added} new = {len(merged)} total")
    print(f"  → {dupes} duplicates skipped")
    return merged


def print_stats(exercises: list[dict]) -> None:
    """Print summary statistics about the exercise database."""
    print("\n📊 Exercise Database Stats:")
    print(f"  Total exercises: {len(exercises)}")

    # By muscle group
    by_muscle: dict[str, int] = {}
    for ex in exercises:
        mg = ex["muscle_group"]
        by_muscle[mg] = by_muscle.get(mg, 0) + 1

    print("\n  By muscle group:")
    for mg in sorted(by_muscle, key=lambda m: by_muscle[m], reverse=True):
        print(f"    {mg:15s}: {by_muscle[mg]:3d}")

    # By equipment
    by_equip: dict[str, int] = {}
    for ex in exercises:
        eq = ex["equipment"]
        by_equip[eq] = by_equip.get(eq, 0) + 1

    print("\n  By equipment:")
    for eq in sorted(by_equip, key=lambda e: by_equip[e], reverse=True):
        print(f"    {eq:15s}: {by_equip[eq]:3d}")

    # Image coverage
    with_image = sum(1 for ex in exercises if ex.get("image_url"))
    with_anim = sum(1 for ex in exercises if ex.get("animation_url"))
    with_desc = sum(1 for ex in exercises if ex.get("description"))
    with_secondary = sum(1 for ex in exercises if ex.get("secondary_muscles"))

    print(f"\n  Image coverage:     {with_image}/{len(exercises)} ({100*with_image//len(exercises)}%)")
    print(f"  Animation coverage: {with_anim}/{len(exercises)} ({100*with_anim//len(exercises)}%)")
    print(f"  Description:        {with_desc}/{len(exercises)} ({100*with_desc//len(exercises)}%)")
    print(f"  Secondary muscles:  {with_secondary}/{len(exercises)} ({100*with_secondary//len(exercises)}%)")

    # Duplicate ID check
    ids = [ex["id"] for ex in exercises]
    unique_ids = set(ids)
    if len(ids) != len(unique_ids):
        dupes = [eid for eid in ids if ids.count(eid) > 1]
        print(f"\n  ⚠️  Duplicate IDs found: {set(dupes)}")
    else:
        print(f"\n  ✅ No duplicate IDs")

    # Validate all muscle groups
    invalid_muscles = [
        ex["name"] for ex in exercises
        if ex["muscle_group"] not in VALID_MUSCLE_GROUPS
    ]
    if invalid_muscles:
        print(f"  ⚠️  Invalid muscle groups: {invalid_muscles[:5]}...")
    else:
        print(f"  ✅ All muscle groups valid")

    # Validate all equipment
    invalid_equip = [
        ex["name"] for ex in exercises
        if ex["equipment"] not in VALID_EQUIPMENT
    ]
    if invalid_equip:
        print(f"  ⚠️  Invalid equipment: {invalid_equip[:5]}...")
    else:
        print(f"  ✅ All equipment types valid")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import exercises from wger API and merge with existing database."
    )
    parser.add_argument(
        "--dry",
        action="store_true",
        help="Dry run — fetch and merge but don't write to exercises.py",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Ignore cached API responses and fetch fresh data",
    )
    args = parser.parse_args()

    use_cache = not args.no_cache

    # 1. Load existing exercises
    print("📂 Loading existing exercises...")
    existing = load_existing_exercises()
    print(f"  → {len(existing)} existing exercises loaded")

    # 2. Fetch from wger
    wger_exercises, images = fetch_wger_data(use_cache=use_cache)

    # 3. Convert to our format
    converted = convert_wger_exercises(wger_exercises, images)

    # 4. Merge
    merged = merge_exercises(existing, converted)

    # 5. Stats
    print_stats(merged)

    # 6. Write (unless dry run)
    if args.dry:
        print("\n🏜️  Dry run — not writing to exercises.py")
    else:
        write_exercises_py(merged)
        print("\n🎉 Done! Run the following to verify:")
        print('  python -c "from src.modules.training.exercises import EXERCISES; print(len(EXERCISES))"')


if __name__ == "__main__":
    main()
