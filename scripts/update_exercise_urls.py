#!/usr/bin/env python3
"""Replace GitHub image URLs in exercises.py with local static paths."""

import os
import re

EXERCISES_FILE = os.path.join(os.path.dirname(__file__), "..", "src", "modules", "training", "exercises.py")

GITHUB_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"


def main():
    with open(EXERCISES_FILE, "r") as f:
        content = f.read()

    original = content

    # Replace full GitHub URLs with local static paths
    content = content.replace(GITHUB_BASE, "/static/exercises/")

    # Replace f-string patterns: f"{_IMG}/Folder/0.jpg" -> "/static/exercises/Folder/0.jpg"
    content = re.sub(
        r'f"\{_IMG\}/([^"]+)"',
        r'"/static/exercises/\1"',
        content,
    )

    # Remove the _IMG variable since it's no longer needed
    content = re.sub(
        r'\n_IMG = "https://raw\.githubusercontent\.com[^"]*"\n',
        "\n",
        content,
    )

    if content == original:
        print("No changes needed — URLs already updated.")
        return

    with open(EXERCISES_FILE, "w") as f:
        f.write(content)

    # Count replacements
    local_count = content.count("/static/exercises/")
    print(f"Updated exercises.py — {local_count} local image references")


if __name__ == "__main__":
    main()
