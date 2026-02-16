#!/usr/bin/env python3
"""Enrich HypertrophyOS exercises with animated GIF URLs from ExerciseDB.

Downloads the ExerciseDB v1 dataset (free, open-source from exercisedb.dev),
fuzzy-matches exercises by name using difflib.SequenceMatcher (threshold 0.85),
and sets the `animation_url` field for matched exercises.

Usage:
    python scripts/enrich_exercisedb.py           # enrich and write to exercises.py
    python scripts/enrich_exercisedb.py --dry      # preview matches without writing
    python scripts/enrich_exercisedb.py --no-cache # re-download dataset (skip cache)

The ExerciseDB dataset is cached locally in scripts/exercisedb_cache/ so the
script is idempotent and doesn't re-download on subsequent runs.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
EXERCISES_PY = PROJECT_ROOT / "src" / "modules" / "training" / "exercises.py"
CACHE_DIR = SCRIPT_DIR / "exercisedb_cache"

# ---------------------------------------------------------------------------
# ExerciseDB API configuration
# ---------------------------------------------------------------------------

# ExerciseDB v1 free endpoint — returns all exercises as JSON
# The free tier provides exercise data including animated GIF URLs.
EXERCISEDB_API_URL = "https://exercisedb.p.rapidapi.com/exercises"
EXERCISEDB_FALLBACK_URL = (
    "https://raw.githubusercontent.com/exercemus/exercisedb/main/exercises.json"
)

# ---------------------------------------------------------------------------
# Fuzzy matching configuration
# ---------------------------------------------------------------------------

MATCH_THRESHOLD = 0.85  # Minimum similarity ratio to accept a match
REVIEW_THRESHOLD = 0.90  # Matches below this are flagged for manual review

# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------


def _ensure_cache_dir() -> None:
    """Create the cache directory if it doesn't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_path(name: str) -> Path:
    """Return a cache file path for a named dataset."""
    return CACHE_DIR / f"{name}.json"


def fetch_exercisedb_dataset(use_cache: bool = True) -> list[dict]:
    """Fetch the ExerciseDB dataset, using local cache when available.

    Tries the GitHub-hosted open-source mirror first (no API key needed).
    Falls back gracefully if the network is unavailable and a cache exists.

    Returns a list of exercise dicts from ExerciseDB.
    """
    _ensure_cache_dir()
    cache_file = _cache_path("exercisedb_exercises")

    if use_cache and cache_file.exists():
        print(f"  [cache hit] Loading ExerciseDB dataset from {cache_file.name}")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    # Try the free GitHub mirror first (no API key required)
    urls_to_try = [EXERCISEDB_FALLBACK_URL]

    # If RAPIDAPI_KEY is set, also try the official API
    api_key = os.environ.get("RAPIDAPI_KEY")
    if api_key:
        urls_to_try.insert(0, EXERCISEDB_API_URL)

    last_error: Optional[Exception] = None
    for url in urls_to_try:
        print(f"  [fetching] {url[:80]}...")
        headers = {"User-Agent": "HypertrophyOS-EnrichScript/1.0"}
        if url == EXERCISEDB_API_URL and api_key:
            headers["X-RapidAPI-Key"] = api_key
            headers["X-RapidAPI-Host"] = "exercisedb.p.rapidapi.com"

        req = Request(url, headers=headers)
        try:
            with urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            # Cache the result
            cache_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
            print(f"  → Fetched {len(data)} exercises from ExerciseDB")
            time.sleep(0.5)  # Be polite
            return data
        except (HTTPError, URLError, TimeoutError) as exc:
            print(f"  [warn] Failed to fetch from {url[:60]}: {exc}")
            last_error = exc
            continue

    # If all URLs failed but we have a stale cache, use it
    if cache_file.exists():
        print("  [warn] Using stale cache after fetch failures")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    raise RuntimeError(
        f"Failed to fetch ExerciseDB dataset and no cache available: {last_error}"
    )


# ---------------------------------------------------------------------------
# Name normalization for fuzzy matching
# ---------------------------------------------------------------------------

def normalize_name(name: str) -> str:
    """Normalize an exercise name for fuzzy comparison.

    Lowercases, strips parenthetical qualifiers, removes common noise words,
    and collapses whitespace.

    Examples:
        "Barbell Bench Press" → "barbell bench press"
        "Bench Press (Barbell)" → "bench press barbell"
        "Dumbbell Bicep Curl" → "dumbbell bicep curl"
    """
    s = name.lower().strip()
    # Remove parentheses but keep content
    s = s.replace("(", " ").replace(")", " ")
    # Remove slashes and dashes that aren't part of compound words
    s = re.sub(r"\s*[-/]\s*", " ", s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ---------------------------------------------------------------------------
# Fuzzy matching
# ---------------------------------------------------------------------------

def fuzzy_match_score(name_a: str, name_b: str) -> float:
    """Compute fuzzy similarity between two exercise names.

    Uses difflib.SequenceMatcher on normalized names.
    Returns a float between 0.0 and 1.0.
    """
    norm_a = normalize_name(name_a)
    norm_b = normalize_name(name_b)
    return SequenceMatcher(None, norm_a, norm_b).ratio()


def find_best_match(
    our_name: str,
    exercisedb_exercises: list[dict],
    threshold: float = MATCH_THRESHOLD,
) -> Optional[tuple[dict, float]]:
    """Find the best ExerciseDB match for one of our exercises.

    Returns (matched_exercisedb_entry, confidence_score) or None if no match
    meets the threshold.
    """
    best_match: Optional[dict] = None
    best_score: float = 0.0

    for edb_ex in exercisedb_exercises:
        edb_name = edb_ex.get("name", "")
        if not edb_name:
            continue

        score = fuzzy_match_score(our_name, edb_name)
        if score > best_score:
            best_score = score
            best_match = edb_ex

    if best_match is not None and best_score >= threshold:
        return (best_match, best_score)
    return None


# ---------------------------------------------------------------------------
# Exercise loading
# ---------------------------------------------------------------------------

def load_existing_exercises() -> list[dict]:
    """Import the current EXERCISES list from exercises.py."""
    sys.path.insert(0, str(PROJECT_ROOT))
    from src.modules.training.exercises import EXERCISES
    return list(EXERCISES)


# ---------------------------------------------------------------------------
# Enrichment logic
# ---------------------------------------------------------------------------

def extract_gif_url(edb_exercise: dict) -> Optional[str]:
    """Extract the animated GIF URL from an ExerciseDB exercise entry.

    ExerciseDB stores the GIF URL in the 'gifUrl' field.
    Returns the URL string or None if not available.
    """
    gif_url = edb_exercise.get("gifUrl")
    if gif_url and isinstance(gif_url, str) and gif_url.startswith("http"):
        return gif_url
    return None


def enrich_exercises(
    our_exercises: list[dict],
    exercisedb_data: list[dict],
    dry_run: bool = False,
) -> tuple[list[dict], list[dict], list[dict]]:
    """Match our exercises against ExerciseDB and set animation_url.

    Returns:
        (enriched_exercises, matched_log, review_log)
        - enriched_exercises: updated exercise list with animation_url set
        - matched_log: list of dicts with match details for all matches
        - review_log: subset of matched_log where score < REVIEW_THRESHOLD
    """
    enriched = []
    matched_log: list[dict] = []
    review_log: list[dict] = []

    total = len(our_exercises)
    matched_count = 0
    skipped_no_gif = 0

    for i, ex in enumerate(our_exercises, 1):
        ex_copy = dict(ex)  # Don't mutate the original
        our_name = ex["name"]

        result = find_best_match(our_name, exercisedb_data)

        if result is not None:
            edb_match, score = result
            gif_url = extract_gif_url(edb_match)

            match_entry = {
                "our_name": our_name,
                "our_id": ex["id"],
                "edb_name": edb_match.get("name", ""),
                "score": round(score, 4),
                "gif_url": gif_url,
                "edb_target": edb_match.get("target", ""),
                "edb_equipment": edb_match.get("equipment", ""),
            }
            matched_log.append(match_entry)

            if score < REVIEW_THRESHOLD:
                review_log.append(match_entry)

            if gif_url:
                if not dry_run:
                    ex_copy["animation_url"] = gif_url
                matched_count += 1
                flag = " ⚠️  REVIEW" if score < REVIEW_THRESHOLD else ""
                print(
                    f"  [{i:3d}/{total}] ✅ {our_name}"
                    f"  →  {edb_match.get('name', '?')}"
                    f"  (score={score:.3f}){flag}"
                )
            else:
                skipped_no_gif += 1
                print(
                    f"  [{i:3d}/{total}] ⚠️  {our_name}"
                    f"  →  matched but no GIF (score={score:.3f})"
                )
        else:
            print(f"  [{i:3d}/{total}] ❌ {our_name}  →  no match above {MATCH_THRESHOLD}")

        enriched.append(ex_copy)

    print(f"\n📊 Enrichment summary:")
    print(f"   Total exercises:     {total}")
    print(f"   Matched with GIF:    {matched_count}")
    print(f"   Matched, no GIF:     {skipped_no_gif}")
    print(f"   No match:            {total - matched_count - skipped_no_gif}")
    print(f"   Flagged for review:  {len(review_log)} (score < {REVIEW_THRESHOLD})")

    return enriched, matched_log, review_log


# ---------------------------------------------------------------------------
# File writing (reuses import_wger.py pattern)
# ---------------------------------------------------------------------------

def format_exercise_dict(ex: dict, img_var: str = "_IMG") -> str:
    """Format a single exercise dict as a Python source line."""
    parts = []
    parts.append(f'"id": "{ex["id"]}"')
    parts.append(f'"name": "{ex["name"]}"')
    parts.append(f'"muscle_group": "{ex["muscle_group"]}"')

    sm = ex.get("secondary_muscles", [])
    sm_str = "[" + ", ".join(f'"{m}"' for m in sm) + "]" if sm else "[]"
    parts.append(f'"secondary_muscles": {sm_str}')

    parts.append(f'"equipment": "{ex["equipment"]}"')
    parts.append(f'"category": "{ex["category"]}"')

    # image_url — preserve f-string references for GitHub-hosted images
    img = ex.get("image_url")
    if img is None:
        parts.append('"image_url": None')
    else:
        base = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
        if img.startswith(base):
            rel = img[len(base):]
            parts.append(f'"image_url": f"{{{img_var}}}{rel}"')
        else:
            parts.append(f'"image_url": "{img}"')

    # animation_url
    anim = ex.get("animation_url")
    if anim:
        parts.append(f'"animation_url": "{anim}"')
    else:
        parts.append('"animation_url": None')

    # description
    desc = ex.get("description")
    if desc:
        desc_escaped = desc.replace("\\", "\\\\").replace('"', '\\"')
        parts.append(f'"description": "{desc_escaped}"')
    else:
        parts.append('"description": None')

    # instructions
    instr = ex.get("instructions")
    parts.append(f'"instructions": {repr(instr)}' if instr else '"instructions": None')

    # tips
    tips = ex.get("tips")
    parts.append(f'"tips": {repr(tips)}' if tips else '"tips": None')

    return "    {" + ", ".join(parts) + "}"


def group_exercises_by_muscle(exercises: list[dict]) -> dict[str, list[dict]]:
    """Group exercises by muscle_group, preserving order."""
    groups: dict[str, list[dict]] = {}
    for ex in exercises:
        mg = ex["muscle_group"]
        groups.setdefault(mg, []).append(ex)
    return groups


def write_exercises_py(exercises: list[dict]) -> None:
    """Write the enriched EXERCISES list back to exercises.py.

    Preserves the file header, _IMG variable, and helper functions.
    Uses the same format as import_wger.py for consistency.
    """
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

    lines: list[str] = []
    lines.append('"""Static exercise database for HypertrophyOS.')
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

        label = mg.replace("_", " ").title()
        count = len(group_exercises)
        lines.append(
            f"    # ─── {label} ({count}) "
            + "─" * max(1, 55 - len(label) - len(str(count)))
        )

        for ex in group_exercises:
            lines.append(format_exercise_dict(ex) + ",")

        lines.append("")

    lines.append("]")
    lines.append("")
    lines.append("")

    # Preserve helper functions from the existing file
    existing_content = EXERCISES_PY.read_text(encoding="utf-8")

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
# Match report
# ---------------------------------------------------------------------------

def write_match_report(
    matched_log: list[dict],
    review_log: list[dict],
) -> None:
    """Write a JSON match report to the cache directory for auditing."""
    _ensure_cache_dir()

    report = {
        "total_matches": len(matched_log),
        "flagged_for_review": len(review_log),
        "threshold": MATCH_THRESHOLD,
        "review_threshold": REVIEW_THRESHOLD,
        "matches": matched_log,
        "review_needed": review_log,
    }

    report_path = CACHE_DIR / "match_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"📝 Match report written to {report_path}")

    if review_log:
        print(f"\n⚠️  {len(review_log)} matches need manual review (score < {REVIEW_THRESHOLD}):")
        for entry in review_log:
            print(
                f"   {entry['our_name']}"
                f"  →  {entry['edb_name']}"
                f"  (score={entry['score']:.3f})"
            )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich exercises with ExerciseDB animated GIF URLs",
    )
    parser.add_argument(
        "--dry",
        action="store_true",
        help="Preview matches without writing to exercises.py",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Re-download ExerciseDB dataset (ignore cache)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    print("=" * 60)
    print("ExerciseDB Enrichment Script")
    print("=" * 60)

    if args.dry:
        print("🔍 DRY RUN — no files will be modified\n")

    # 1. Load our exercises
    print("📂 Loading existing exercises...")
    our_exercises = load_existing_exercises()
    print(f"   → {len(our_exercises)} exercises loaded")

    # 2. Fetch ExerciseDB dataset
    print("\n📡 Fetching ExerciseDB dataset...")
    use_cache = not args.no_cache
    exercisedb_data = fetch_exercisedb_dataset(use_cache=use_cache)
    print(f"   → {len(exercisedb_data)} ExerciseDB exercises available")

    # 3. Fuzzy match and enrich
    print(f"\n🔗 Matching exercises (threshold={MATCH_THRESHOLD})...\n")
    enriched, matched_log, review_log = enrich_exercises(
        our_exercises, exercisedb_data, dry_run=args.dry
    )

    # 4. Write match report (always, even in dry run)
    write_match_report(matched_log, review_log)

    # 5. Write enriched exercises back to exercises.py
    if not args.dry:
        print("\n📝 Writing enriched exercises to exercises.py...")
        write_exercises_py(enriched)
    else:
        print("\n🔍 Dry run complete — no files modified")
        anim_count = sum(
            1 for m in matched_log if m.get("gif_url")
        )
        print(f"   Would set animation_url for {anim_count} exercises")

    print("\n✨ Done!")


if __name__ == "__main__":
    main()
