#!/usr/bin/env python3
"""
Fill animation_url for exercises that currently have None.

For exercises with image_url starting with /static/exercises/, derives
animation_url by replacing /0.jpg with /1.jpg.
For other image_url patterns, uses the image_url as a fallback animation.

Usage:
    python scripts/fill_animation_urls.py
"""

from __future__ import annotations

import re
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.modules.training.exercises import EXERCISES


def _derive_animation_url(image_url: str) -> str:
    """Derive an animation URL from the image URL."""
    if image_url.startswith("/static/exercises/"):
        return image_url.replace("/0.jpg", "/1.jpg")
    return image_url


def main():
    exercises_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "src", "modules", "training", "exercises.py",
    )

    with open(exercises_path, "r") as f:
        lines = f.readlines()

    # Build a map of exercise id -> animation_url for exercises that need updating
    updates: dict[str, str] = {}
    for ex in EXERCISES:
        if ex["animation_url"] is None and ex.get("image_url") is not None:
            updates[ex["id"]] = _derive_animation_url(ex["image_url"])

    print(f"Exercises to update: {len(updates)}")

    # Walk through lines, track current exercise id, replace animation_url: None
    current_id = None
    new_lines = []
    replaced = 0

    for line in lines:
        # Check if this line has an "id" field
        id_match = re.match(r'^(\s*)"id":\s*"([^"]+)"', line)
        if id_match:
            current_id = id_match.group(2)

        # Check if this line has "animation_url": None
        anim_match = re.match(r'^(\s*)"animation_url":\s*None', line)
        if anim_match and current_id and current_id in updates:
            indent = anim_match.group(1)
            new_url = updates[current_id]
            line = f'{indent}"animation_url": "{new_url}",\n'
            replaced += 1
            del updates[current_id]

        new_lines.append(line)

    with open(exercises_path, "w") as f:
        f.writelines(new_lines)

    print(f"Replaced: {replaced}")

    remaining = len(updates)
    if remaining:
        print(f"WARNING: {remaining} exercises could not be updated in the file")
        for eid in updates:
            print(f"  - {eid}")
    else:
        print("All exercises updated successfully.")

    # Verify
    print("\nVerifying...")
    import importlib
    import src.modules.training.exercises as mod
    importlib.reload(mod)
    total = len(mod.EXERCISES)
    anim = sum(1 for e in mod.EXERCISES if e.get("animation_url"))
    print(f"Animations: {anim}/{total} ({100 * anim // total}%)")


if __name__ == "__main__":
    main()
