#!/usr/bin/env python3
"""
Populate secondary_muscles for exercises that currently have empty lists.

Uses keyword-based heuristics grounded in standard kinesiology to assign
secondary muscle groups. Only modifies exercises where secondary_muscles == [].

Usage:
    python scripts/populate_secondary_muscles.py
"""

from __future__ import annotations

import re
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.modules.training.exercises import EXERCISES


# ---------------------------------------------------------------------------
# Heuristic rules: (muscle_group, name_keywords) -> secondary_muscles
#
# Rules are checked in order. The FIRST matching rule wins for each exercise.
# Keywords are matched case-insensitively against the exercise name.
# ---------------------------------------------------------------------------

def _assign_secondary(name: str, muscle_group: str, equipment: str, category: str) -> list[str]:
    """Return secondary muscles based on exercise name, muscle group, and metadata."""
    n = name.lower()

    # ── CHEST ──────────────────────────────────────────────────────────────
    if muscle_group == "chest":
        # Compound chest presses involve triceps + shoulders
        if category == "compound":
            # Dips hit triceps heavily
            if "dip" in n:
                return ["triceps", "shoulders"]
            # Push-ups and presses
            return ["triceps", "shoulders"]
        # Isolation chest: flyes, crossovers, pec deck
        if "fly" in n or "flye" in n or "crossover" in n or "pec deck" in n:
            return ["shoulders"]
        # Pullover is chest + lats
        if "pullover" in n:
            return ["back"]
        return []

    # ── BACK ───────────────────────────────────────────────────────────────
    if muscle_group == "back":
        # Deadlifts are back + hamstrings + glutes
        if "deadlift" in n:
            return ["hamstrings", "glutes"]
        # Face pulls target rear delts + traps
        if "face pull" in n:
            return ["shoulders"]
        # Straight-arm pulldown is lats isolation, minimal secondary
        if "straight-arm" in n or "straight arm" in n:
            return []
        # Rows and pulldowns involve biceps
        if "row" in n or "pulldown" in n or "pull-up" in n or "pull up" in n or "chin" in n:
            return ["biceps"]
        return ["biceps"]

    # ── SHOULDERS ──────────────────────────────────────────────────────────
    if muscle_group == "shoulders":
        # Overhead/military/arnold presses involve triceps
        if "press" in n or "push press" in n:
            return ["triceps"]
        # Lateral raises are isolation — traps assist
        if "lateral" in n or "raise" in n:
            if "front" in n:
                return ["chest"]
            return ["traps"]
        # Reverse fly / rear delt work
        if "reverse" in n or "rear" in n:
            return ["back"]
        # External rotation is rotator cuff isolation
        if "external" in n or "rotation" in n:
            return []
        # Lu raise (lateral + front raise combo)
        if "lu raise" in n:
            return ["traps"]
        return []

    # ── QUADS ──────────────────────────────────────────────────────────────
    if muscle_group == "quads":
        # Leg extensions are pure quad isolation
        if "extension" in n:
            return []
        # Sissy squat is quad isolation
        if "sissy" in n:
            return []
        # Wall sit is quad isolation
        if "wall sit" in n:
            return []
        # Spanish squat is quad-focused
        if "spanish" in n:
            return []
        # Compound quad movements (squats, lunges, leg press, step-ups)
        if category == "compound":
            return ["glutes"]
        return []

    # ── HAMSTRINGS ─────────────────────────────────────────────────────────
    if muscle_group == "hamstrings":
        # Leg curls are hamstring isolation
        if "curl" in n:
            return []
        # Nordic curls are hamstring isolation
        if "nordic" in n:
            return []
        # Romanian/stiff-leg/single-leg deadlifts involve glutes
        if "deadlift" in n or "rdl" in n:
            return ["glutes", "back"]
        return []

    # ── GLUTES ─────────────────────────────────────────────────────────────
    if muscle_group == "glutes":
        # Compound glute movements involve quads/hamstrings
        if "split squat" in n or "lunge" in n:
            return ["quads", "hamstrings"]
        if "squat" in n:
            return ["quads"]
        # Hip thrust / glute bridge
        if "bridge" in n or "thrust" in n:
            return ["hamstrings"]
        # Kickbacks
        if "kickback" in n:
            return ["hamstrings"]
        # Abduction / clamshell / lateral walk / fire hydrant are glute isolation
        if "abduction" in n or "clamshell" in n or "lateral walk" in n:
            return []
        # Frog pump
        if "frog" in n:
            return ["hamstrings"]
        # Donkey kick
        if "donkey" in n:
            return ["hamstrings"]
        # Fire hydrant
        if "fire hydrant" in n or "hydrant" in n:
            return []
        return []

    # ── BICEPS ─────────────────────────────────────────────────────────────
    if muscle_group == "biceps":
        # Hammer curls and reverse curls involve forearms more
        if "hammer" in n or "reverse" in n:
            return ["forearms"]
        # Most curls are isolation with minimal secondary
        return ["forearms"]

    # ── TRICEPS ────────────────────────────────────────────────────────────
    if muscle_group == "triceps":
        # Compound tricep movements (dips, diamond push-ups) involve chest/shoulders
        if "dip" in n:
            return ["chest", "shoulders"]
        if "push-up" in n or "push up" in n or "pushup" in n:
            return ["chest", "shoulders"]
        # Isolation tricep work (pushdowns, extensions, skull crushers)
        return []

    # ── CALVES ─────────────────────────────────────────────────────────────
    if muscle_group == "calves":
        # Tibialis raise targets the front of the shin
        if "tibialis" in n:
            return []
        # All calf raises are isolation
        return []

    # ── ABS ────────────────────────────────────────────────────────────────
    if muscle_group == "abs":
        # Woodchopper involves obliques (still abs group) + shoulders
        if "woodchopper" in n or "wood chop" in n:
            return []
        # Side plank targets obliques
        if "side" in n:
            return []
        # Suitcase carry involves forearms + obliques
        if "suitcase" in n or "carry" in n:
            return ["forearms"]
        # Hanging exercises involve forearms for grip
        if "hanging" in n:
            return ["forearms"]
        # Most ab exercises are isolation
        return []

    # ── TRAPS ──────────────────────────────────────────────────────────────
    if muscle_group == "traps":
        # Upright row involves shoulders
        if "upright" in n or "row" in n:
            return ["shoulders"]
        # Shrugs are trap isolation
        return []

    # ── FOREARMS ───────────────────────────────────────────────────────────
    if muscle_group == "forearms":
        # Farmer's walk is compound
        if "farmer" in n or "walk" in n:
            return ["traps"]
        # Wrist curls and grip work are isolation
        return []

    # ── FULL BODY ──────────────────────────────────────────────────────────
    if muscle_group == "full_body":
        if "thruster" in n:
            return ["quads", "shoulders", "triceps"]
        if "burpee" in n:
            return ["chest", "quads"]
        if "turkish" in n or "get-up" in n or "get up" in n:
            return ["shoulders", "abs"]
        if "man maker" in n:
            return ["chest", "shoulders", "quads"]
        if "battle rope" in n:
            return ["shoulders", "abs"]
        return []

    return []


def main():
    updated = 0
    skipped = 0

    for ex in EXERCISES:
        if ex["secondary_muscles"]:
            skipped += 1
            continue

        secondary = _assign_secondary(
            ex["name"], ex["muscle_group"], ex["equipment"], ex["category"]
        )
        if secondary:
            ex["secondary_muscles"] = secondary
            updated += 1
            print(f"  ✓ {ex['name']} ({ex['muscle_group']}): {secondary}")
        else:
            skipped += 1
            print(f"  – {ex['name']} ({ex['muscle_group']}): kept empty (isolation)")

    print(f"\nUpdated: {updated}, Skipped (already populated or kept empty): {skipped}")
    print(f"Total exercises: {len(EXERCISES)}")

    # Now write back to exercises.py
    exercises_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "src", "modules", "training", "exercises.py",
    )

    with open(exercises_path, "r") as f:
        content = f.read()

    # For each exercise that was updated, find and replace its secondary_muscles line
    for ex in EXERCISES:
        if not ex["secondary_muscles"]:
            continue
        # We need to find the pattern: "name": "ExName" ... "secondary_muscles": []
        # and replace the [] with the actual list
        # Use a targeted regex that matches the exercise by name and replaces its empty secondary_muscles
        pass

    # Instead of fragile regex, re-serialize the entire EXERCISES list
    _write_exercises(exercises_path, EXERCISES)

    # Verify
    print("\nVerifying...")
    # Re-import to check
    import importlib
    import src.modules.training.exercises as mod
    importlib.reload(mod)
    empty_count = sum(1 for e in mod.EXERCISES if e["secondary_muscles"] == [])
    total = len(mod.EXERCISES)
    print(f"After update: {empty_count} exercises still have empty secondary_muscles (out of {total})")


def _write_exercises(path: str, exercises: list[dict]):
    """Read the exercises.py file and replace only the empty secondary_muscles entries.

    Strategy: find each exercise block by matching its unique "id" field,
    then within that block (up to the next exercise block or closing bracket),
    replace "secondary_muscles": [] with the populated list.
    """
    with open(path, "r") as f:
        lines = f.readlines()

    # Build a map of exercise id -> secondary_muscles for exercises that were updated
    updates: dict[str, list[str]] = {}
    for ex in exercises:
        if ex["secondary_muscles"]:
            updates[ex["id"]] = ex["secondary_muscles"]

    # Walk through lines, find "id": "xxx" lines, then find the next "secondary_muscles": []
    current_id = None
    new_lines = []
    for line in lines:
        # Check if this line has an "id" field
        id_match = re.match(r'^(\s*)"id":\s*"([^"]+)"', line)
        if id_match:
            current_id = id_match.group(2)

        # Check if this line has "secondary_muscles": []
        sm_match = re.match(r'^(\s*)"secondary_muscles":\s*\[\]', line)
        if sm_match and current_id and current_id in updates:
            indent = sm_match.group(1)
            muscles = updates[current_id]
            muscles_str = repr(muscles)
            # Replace the line
            line = f'{indent}"secondary_muscles": {muscles_str},\n'
            del updates[current_id]  # Mark as done

        new_lines.append(line)

    with open(path, "w") as f:
        f.writelines(new_lines)

    remaining = len(updates)
    if remaining:
        print(f"WARNING: {remaining} exercises could not be updated in the file")
        for eid in updates:
            print(f"  - {eid}")
    else:
        print(f"Wrote updated exercises to {path}")

    print(f"Wrote updated exercises to {path}")


if __name__ == "__main__":
    main()
