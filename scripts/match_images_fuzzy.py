#!/usr/bin/env python3
"""
Fuzzy-match exercise images from free-exercise-db to improve image coverage.

The previous enrichment script used exact name matching (threshold 0.80) and
only matched ~153/404 exercises. This script uses aggressive fuzzy matching
with normalization to catch many more matches.

Strategy:
1. Fetch the free-exercise-db JSON (873 exercises with images)
2. For each of our exercises missing image_url:
   - Try exact normalized match
   - Try fuzzy match with threshold 0.70
   - Try matching after stripping equipment prefixes
   - Try matching after removing parenthetical qualifiers
3. Write updates back using targeted line replacement

Usage:
    python scripts/match_images_fuzzy.py
"""

from __future__ import annotations

import difflib
import json
import os
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

CACHE_DIR = PROJECT_ROOT / "scripts" / "wger_cache"
FREE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
MATCH_THRESHOLD = 0.70


def fetch_free_db(use_cache: bool = True) -> list[dict]:
    """Fetch the free-exercise-db dataset, with local caching."""
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
        print(f"  → {len(data)} exercises fetched and cached")
        return data
    except (HTTPError, URLError, TimeoutError) as e:
        if cache_file.exists():
            print(f"  [warn] Fetch failed ({e}), using stale cache")
            return json.loads(cache_file.read_text())
        raise


def normalize(name: str) -> str:
    """Normalize exercise name for matching."""
    s = name.lower().strip()
    s = re.sub(r"\([^)]*\)", "", s)  # Remove parenthetical qualifiers
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def strip_equipment_prefix(name: str) -> str:
    """Remove common equipment prefixes for broader matching."""
    prefixes = [
        "barbell", "dumbbell", "cable", "machine", "smith machine",
        "resistance band", "band", "kettlebell", "ez bar", "ez-bar",
        "trap bar",
    ]
    s = name.lower().strip()
    for p in prefixes:
        if s.startswith(p + " "):
            s = s[len(p):].strip()
            break
    return s



# Common name variations: our name -> free-exercise-db name patterns
MANUAL_OVERRIDES: dict[str, str] = {
    # Chest
    "high cable crossover": "Cable Crossover",
    "decline cable fly": "Cable Crossover",
    "cable chest fly standing": "Cable Crossover",
    "seated cable fly": "Cable Crossover",
    "dumbbell fly flat": "Dumbbell Flyes",
    "decline dumbbell fly": "Decline Dumbbell Flyes",
    "decline push-up": "Decline Push-Up",
    "wide push-up": "Wide-Grip Decline Barbell Pullover",  # no exact match
    "clap push-up": "Pushups",
    "archer push-up": "Pushups",
    # Back
    "chest supported t-bar row": "T-Bar Row",
    "reverse grip lat pulldown": "Reverse Grip Bent-Over Rows",
    "v-bar lat pulldown": "V-Bar Pulldown",
    "neutral grip pull-up": "Pullups",
    "wide grip pull-up": "Wide-Grip Rear Pull-Up",
    "commando pull-up": "Pullups",
    "rope face pull": "Face Pull",
    "banded pull apart back": "Face Pull",
    "gorilla row": "Alternating Kettlebell Row",
    "renegade row": "Alternating Renegade Row",
    "trap bar deadlift": "Trap Bar Deadlift",
    "snatch grip deadlift": "Snatch Deadlift",
    "deficit deadlift": "Deficit Deadlift",
    # Shoulders
    "dumbbell lateral raise": "Dumbbell Lateral Raise",
    "arnold press": "Arnold Dumbbell Press",
    "cable lateral raise": "Cable Lateral Raise",  # may not exist
    "face pull": "Face Pull",
    "barbell upright row": "Upright Barbell Row",
    "dumbbell front raise": "Front Dumbbell Raise",
    "cable front raise": "Front Cable Raise",
    "reverse pec deck": "Reverse Machine Flyes",
    "dumbbell rear delt fly": "Seated Bent-Over Rear Delt Raise",
    "cable rear delt fly": "Seated Bent-Over Rear Delt Raise",
    "landmine press": "Barbell Shoulder Press",
    "z press": "Barbell Shoulder Press",
    # Quads
    "barbell front squat": "Front Barbell Squat",
    "barbell back squat": "Barbell Squat",
    "goblet squat": "Goblet Squat",
    "leg press": "Leg Press",
    "hack squat": "Hack Squat",
    "leg extension": "Leg Extensions",
    "walking lunge": "Walking Barbell Lunge",
    "dumbbell lunge": "Dumbbell Lunges",
    "barbell lunge": "Barbell Lunge",
    "step up": "Barbell Step Ups",
    "dumbbell step up": "Dumbbell Step Ups",
    "sissy squat": "Sissy Squat",
    "wall sit": "Wall Squat",
    "split squat": "Barbell Lunge",
    "bulgarian split squat": "Single Leg Squat",
    "smith machine squat": "Smith Machine Squat",
    # Hamstrings
    "seated leg curl": "Seated Leg Curl",
    "lying leg curl": "Lying Leg Curls",
    "nordic hamstring curl": "Lying Leg Curls",
    "single leg romanian deadlift": "Single Leg Deadlift",
    "barbell romanian deadlift": "Romanian Deadlift With Dumbbells",
    "dumbbell romanian deadlift": "Romanian Deadlift With Dumbbells",
    "stiff leg deadlift": "Stiff-Legged Barbell Deadlift",
    "good morning": "Good Morning",
    # Glutes
    "barbell hip thrust": "Barbell Hip Thrust",
    "glute bridge": "Barbell Glute Bridge",
    "cable kickback": "Cable Hip Adduction",
    "cable pull through": "Pull Through",
    "donkey kick": "Kneeling Hip Flexor",
    # Biceps
    "barbell curl": "Barbell Curl",
    "dumbbell curl": "Dumbbell Bicep Curl",
    "hammer curl": "Hammer Curls",
    "preacher curl": "Preacher Curl",
    "concentration curl": "Concentration Curls",
    "incline dumbbell curl": "Incline Dumbbell Curl",
    "cable curl": "Cable Curl",  # may not exist
    "ez bar curl": "EZ-Bar Curl",
    "spider curl": "Spider Curl",
    "reverse curl": "Reverse Barbell Curl",
    "bayesian curl": "Dumbbell Bicep Curl",
    "drag curl": "Barbell Curl",
    # Triceps
    "tricep pushdown": "Triceps Pushdown",
    "overhead tricep extension": "Dumbbell Tricep Extension",
    "skull crusher": "EZ-Bar Skullcrusher",
    "close grip bench press": "Close-Grip Barbell Bench Press",
    "tricep dips": "Dips - Triceps Version",
    "diamond push-up": "Pushups - Close Triceps",
    "cable overhead extension": "Cable Overhead Triceps Extension",  # may not exist
    "tricep kickback": "Tricep Dumbbell Kickback",
    "rope pushdown": "Triceps Pushdown - Rope Attachment",
    # Calves
    "standing calf raise": "Standing Calf Raises",
    "seated calf raise": "Seated Calf Raise",
    "donkey calf raise": "Donkey Calf Raises",
    "calf press on leg press": "Calf Press On The Leg Press Machine",
    "single leg calf raise": "Standing Calf Raises",
    # Abs
    "hanging leg raise": "Hanging Leg Raise",
    "cable crunch": "Cable Crunch",
    "ab wheel rollout": "Ab Roller",
    "plank": "Plank",
    "russian twist": "Russian Twist",
    "bicycle crunch": "Air Bike",
    "decline sit-up": "Decline Crunch",
    "captain's chair leg raise": "Hanging Leg Raise",
    "woodchopper": "Cross-Body Crunch",
    "dead bug": "Lying Leg Curls",  # no exact match
    "mountain climber": "Mountain Climbers",
    "toe touch crunch": "Toe Touchers",
    "flutter kick": "Flutter Kicks",
    "v-up": "V-Bar Pullup",  # no exact match
    # Traps
    "barbell shrug": "Barbell Shrug",
    "dumbbell shrug": "Dumbbell Shrug",
    "upright row": "Upright Barbell Row",
    "farmer's walk": "Farmer's Walk",
    # Forearms
    "wrist curl": "Palms-Up Barbell Wrist Curl",
    "reverse wrist curl": "Palms-Down Wrist Curl Over A Bench",
    "farmer's carry": "Farmer's Walk",
}


def build_free_db_lookup(free_db: list[dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    """Build normalized and stripped lookups for the free-exercise-db."""
    norm_lookup: dict[str, dict] = {}
    stripped_lookup: dict[str, dict] = {}

    for fdb_ex in free_db:
        name = fdb_ex.get("name", "")
        if not name:
            continue
        norm = normalize(name)
        norm_lookup[norm] = fdb_ex
        stripped = strip_equipment_prefix(normalize(name))
        stripped_lookup[stripped] = fdb_ex

    return norm_lookup, stripped_lookup


def find_best_match(
    our_name: str,
    free_db: list[dict],
    norm_lookup: dict[str, dict],
    stripped_lookup: dict[str, dict],
    name_to_fdb: dict[str, dict],
) -> tuple[dict, float] | None:
    """Find the best matching exercise using multiple strategies."""
    our_norm = normalize(our_name)
    our_stripped = strip_equipment_prefix(our_norm)

    # Strategy 0: Manual override
    if our_norm in MANUAL_OVERRIDES:
        override_name = MANUAL_OVERRIDES[our_norm]
        override_norm = normalize(override_name)
        if override_norm in norm_lookup:
            return norm_lookup[override_norm], 1.0

    # Strategy 1: Exact normalized match
    if our_norm in norm_lookup:
        return norm_lookup[our_norm], 1.0

    # Strategy 2: Exact match by original name (case-insensitive)
    if our_name.lower() in name_to_fdb:
        return name_to_fdb[our_name.lower()], 1.0

    # Strategy 3: Stripped prefix match
    if our_stripped in stripped_lookup and our_stripped != our_norm:
        return stripped_lookup[our_stripped], 0.95

    # Strategy 4: Fuzzy match on normalized names
    best_score = 0.0
    best_match = None
    for fdb_norm, fdb_ex in norm_lookup.items():
        score = difflib.SequenceMatcher(None, our_norm, fdb_norm).ratio()
        if score > best_score:
            best_score = score
            best_match = fdb_ex

    if best_score >= MATCH_THRESHOLD and best_match:
        return best_match, best_score

    # Strategy 5: Fuzzy match on stripped names
    best_score2 = 0.0
    best_match2 = None
    for fdb_stripped, fdb_ex in stripped_lookup.items():
        score = difflib.SequenceMatcher(None, our_stripped, fdb_stripped).ratio()
        if score > best_score2:
            best_score2 = score
            best_match2 = fdb_ex

    if best_score2 >= MATCH_THRESHOLD and best_match2:
        return best_match2, best_score2

    return None


def write_updates(exercises_path: str, updates: dict[str, dict]) -> None:
    """Write image_url and animation_url updates using targeted line replacement.

    For each exercise ID in updates, find the exercise block in the file
    and replace the image_url/animation_url lines.
    """
    with open(exercises_path, "r") as f:
        lines = f.readlines()

    current_id = None
    new_lines = []
    changes = 0

    for line in lines:
        # Track which exercise block we're in
        id_match = re.match(r'^(\s*)"id":\s*"([^"]+)"', line)
        if id_match:
            current_id = id_match.group(2)

        # Replace image_url: None lines
        img_match = re.match(r'^(\s*)"image_url":\s*None,', line)
        if img_match and current_id and current_id in updates:
            indent = img_match.group(1)
            new_url = updates[current_id].get("image_url")
            if new_url:
                line = f'{indent}"image_url": "{new_url}",\n'
                changes += 1

        # Replace animation_url: None lines
        anim_match = re.match(r'^(\s*)"animation_url":\s*None,', line)
        if anim_match and current_id and current_id in updates:
            indent = anim_match.group(1)
            new_url = updates[current_id].get("animation_url")
            if new_url:
                line = f'{indent}"animation_url": "{new_url}",\n'
                changes += 1

        new_lines.append(line)

    with open(exercises_path, "w") as f:
        f.writelines(new_lines)

    print(f"  → {changes} line replacements written to {exercises_path}")



def main() -> None:
    print("=" * 60)
    print("Fuzzy Image Matching Script")
    print("=" * 60)

    # Load our exercises
    print("\n📂 Loading exercises...")
    from src.modules.training.exercises import EXERCISES
    exercises = list(EXERCISES)
    total = len(exercises)
    print(f"  → {total} exercises loaded")

    before_img = sum(1 for e in exercises if e.get("image_url") is not None)
    before_anim = sum(1 for e in exercises if e.get("animation_url") is not None)
    print(f"  → Before: {before_img}/{total} with image_url, {before_anim}/{total} with animation_url")

    # Fetch free-exercise-db
    print("\n📡 Fetching free-exercise-db...")
    free_db = fetch_free_db()
    print(f"  → {len(free_db)} exercises in free-exercise-db")

    # Build lookups
    norm_lookup, stripped_lookup = build_free_db_lookup(free_db)
    name_to_fdb: dict[str, dict] = {}
    for fdb_ex in free_db:
        name_to_fdb[fdb_ex.get("name", "").lower()] = fdb_ex

    # Match exercises
    print("\n🔄 Fuzzy matching exercises...")
    updates: dict[str, dict] = {}  # exercise_id -> {image_url, animation_url}
    new_image_matches = 0
    new_anim_matches = 0
    match_details: list[tuple[str, str, float]] = []

    for ex in exercises:
        needs_image = ex.get("image_url") is None
        needs_anim = ex.get("animation_url") is None

        if not needs_image and not needs_anim:
            continue

        result = find_best_match(ex["name"], free_db, norm_lookup, stripped_lookup, name_to_fdb)
        if result is None:
            continue

        fdb_ex, score = result
        images = fdb_ex.get("images", [])
        if not images:
            continue

        update = {}
        if needs_image:
            update["image_url"] = f"{_IMG}/{images[0]}"
            new_image_matches += 1
            match_details.append((ex["name"], fdb_ex["name"], score))

        if needs_anim and len(images) >= 2:
            update["animation_url"] = f"{_IMG}/{images[1]}"
            new_anim_matches += 1
        elif needs_anim and len(images) >= 1:
            update["animation_url"] = f"{_IMG}/{images[0]}"
            new_anim_matches += 1

        if update:
            updates[ex["id"]] = update

    # Print match details
    print(f"\n📋 Match details ({new_image_matches} new image matches):")
    for our_name, fdb_name, score in sorted(match_details, key=lambda x: -x[2]):
        marker = "✓" if score >= 0.85 else "~"
        print(f"  {marker} {our_name:45s} → {fdb_name:45s} ({score:.2f})")

    # Print unmatched exercises
    unmatched = [
        ex["name"] for ex in exercises
        if ex.get("image_url") is None and ex["id"] not in updates
    ]
    if unmatched:
        print(f"\n❌ Still unmatched ({len(unmatched)} exercises):")
        for name in sorted(unmatched):
            print(f"  - {name}")

    # Write updates
    if updates:
        print(f"\n✏️  Writing {len(updates)} exercise updates...")
        exercises_path = str(PROJECT_ROOT / "src" / "modules" / "training" / "exercises.py")
        write_updates(exercises_path, updates)

    # Verify results
    print("\n📊 Verifying results...")
    import importlib
    import src.modules.training.exercises as mod
    importlib.reload(mod)

    after_img = sum(1 for e in mod.EXERCISES if e.get("image_url") is not None)
    after_anim = sum(1 for e in mod.EXERCISES if e.get("animation_url") is not None)
    total_after = len(mod.EXERCISES)

    print(f"\n{'='*60}")
    print(f"📊 RESULTS")
    print(f"{'='*60}")
    print(f"  Total exercises:       {total_after}")
    print(f"  Image coverage before: {before_img}/{total} ({100*before_img//total}%)")
    print(f"  Image coverage after:  {after_img}/{total_after} ({100*after_img//total_after}%)")
    print(f"  New image matches:     {new_image_matches}")
    print(f"  Anim coverage before:  {before_anim}/{total} ({100*before_anim//total}%)")
    print(f"  Anim coverage after:   {after_anim}/{total_after} ({100*after_anim//total_after}%)")
    print(f"  New anim matches:      {new_anim_matches}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
