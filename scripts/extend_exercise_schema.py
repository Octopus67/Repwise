#!/usr/bin/env python3
"""Extend every exercise dict in exercises.py with new schema fields.

Adds safe defaults for:
  - secondary_muscles: []
  - description: None
  - instructions: None
  - tips: None
  - animation_url: None

Existing fields are never modified. Idempotent — running twice is safe.
"""

import re
import sys
from pathlib import Path

EXERCISES_FILE = Path("src/modules/training/exercises.py")

NEW_FIELDS = {
    "secondary_muscles": "[]",
    "description": "None",
    "instructions": "None",
    "tips": "None",
    "animation_url": "None",
}


def main() -> None:
    source = EXERCISES_FILE.read_text(encoding="utf-8")

    # Strategy: find every exercise dict (line starting with `{` containing "id":)
    # and insert missing fields right before the closing `}`.
    # We process line-by-line, collecting dict blocks.

    lines = source.split("\n")
    output_lines: list[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Detect single-line exercise dict: {"id": ..., "image_url": ...}
        stripped = line.strip()
        if stripped.startswith("{") and '"id"' in stripped and stripped.rstrip(",").endswith("}"):
            # Single-line dict — check which fields are missing
            missing = [k for k in NEW_FIELDS if f'"{k}"' not in stripped]
            if missing:
                # Insert missing fields before the closing }
                # Find the last } in the line
                last_brace = line.rindex("}")
                trailing = line[last_brace + 1:]  # e.g. "," or ",\n"
                before_brace = line[:last_brace].rstrip()
                # Ensure there's a comma after the last existing field
                if not before_brace.endswith(","):
                    before_brace += ","
                # Build new field entries
                additions = ", ".join(f'"{k}": {NEW_FIELDS[k]}' for k in missing)
                new_line = f"{before_brace} {additions}}}{trailing}"
                output_lines.append(new_line)
            else:
                output_lines.append(line)
            i += 1
            continue

        # Multi-line dict: starts with { and "id" but doesn't end with }
        if stripped.startswith("{") and '"id"' in stripped and not stripped.rstrip(",").endswith("}"):
            block_lines = [line]
            i += 1
            while i < len(lines):
                block_lines.append(lines[i])
                if lines[i].strip().startswith("}"):
                    break
                i += 1
            # Check missing fields in the whole block
            block_text = "\n".join(block_lines)
            missing = [k for k in NEW_FIELDS if f'"{k}"' not in block_text]
            if missing:
                # Insert before the closing } line
                closing_line = block_lines[-1]
                indent = "     "  # match typical field indentation
                # Ensure the line before closing } has a trailing comma
                prev_line = block_lines[-2].rstrip()
                if not prev_line.endswith(","):
                    block_lines[-2] = prev_line + ","
                new_field_lines = [f'{indent}"{k}": {NEW_FIELDS[k]},' for k in missing]
                # Remove trailing comma from last new field
                new_field_lines[-1] = new_field_lines[-1].rstrip(",")
                block_lines = block_lines[:-1] + new_field_lines + [closing_line]
            output_lines.extend(block_lines)
            i += 1
            continue

        output_lines.append(line)
        i += 1

    result = "\n".join(output_lines)
    EXERCISES_FILE.write_text(result, encoding="utf-8")

    # Verify
    # Re-import to check
    sys.path.insert(0, str(Path.cwd()))
    # Clear cached module
    if "src.modules.training.exercises" in sys.modules:
        del sys.modules["src.modules.training.exercises"]

    from src.modules.training.exercises import EXERCISES

    total = len(EXERCISES)
    all_fields = ["id", "name", "muscle_group", "secondary_muscles", "equipment",
                  "category", "image_url", "animation_url", "description",
                  "instructions", "tips"]

    errors = []
    for idx, ex in enumerate(EXERCISES):
        for field in all_fields:
            if field not in ex:
                errors.append(f"Exercise #{idx} ({ex.get('id', '?')}): missing '{field}'")

    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors[:20]:
            print(f"  {e}")
        sys.exit(1)
    else:
        print(f"SUCCESS: All {total} exercises have all {len(all_fields)} fields.")


if __name__ == "__main__":
    main()
