#!/usr/bin/env python3
"""
Fix fabricated image URLs in exercises.py.

The free-exercise-db repo uses Title_Case folder names (e.g., Barbell_Bench_Press).
Some exercises were added with fabricated kebab-case paths (e.g., dumbbell-squeeze-press)
that 404. This script nullifies those URLs so the app shows the MuscleGroupIcon placeholder.

Heuristic: if the path segment after /exercises/ starts with a lowercase letter, it's fabricated.
Valid paths start with uppercase (e.g., Barbell_Bench_Press, Pushups, Svend_Press).
"""

import re
import sys
from pathlib import Path

EXERCISES_FILE = Path(__file__).parent.parent / "src" / "modules" / "training" / "exercises.py"

def main():
    content = EXERCISES_FILE.read_text()

    # Pattern: matches image_url or animation_url lines containing a fabricated path
    # Fabricated = the folder name after /exercises/ starts with a lowercase letter
    # We match both:
    #   "image_url": "https://...exercises/lowercase-thing/0.jpg"
    #   "image_url": f"{_IMG}/lowercase-thing/0.jpg"
    
    fabricated_full = re.compile(
        r'("(?:image_url|animation_url)":\s*)"https://raw\.githubusercontent\.com/yuhonas/free-exercise-db/main/exercises/([a-z][^"]*)"'
    )
    fabricated_fstr = re.compile(
        r'("(?:image_url|animation_url)":\s*)f"\{_IMG\}/([a-z][^"]*)"'
    )

    count = 0

    def replace_full(m):
        nonlocal count
        count += 1
        return f'{m.group(1)}None'

    def replace_fstr(m):
        nonlocal count
        count += 1
        return f'{m.group(1)}None'

    content = fabricated_full.sub(replace_full, content)
    content = fabricated_fstr.sub(replace_fstr, content)

    EXERCISES_FILE.write_text(content)
    print(f"Fixed {count} fabricated URLs → None")

    # Verify: count remaining image_url/animation_url that are not None
    remaining_urls = re.findall(r'"(?:image_url|animation_url)":\s*(?!None)[^,\n]+', content)
    valid_count = len(remaining_urls)
    none_count = len(re.findall(r'"(?:image_url|animation_url)":\s*None', content))
    print(f"Remaining valid URLs: {valid_count}")
    print(f"Nullified URLs: {none_count}")

    # Sanity check: all remaining URLs should have uppercase folder names
    bad = []
    for line in remaining_urls:
        m = re.search(r'/exercises/([^/"]+)', line)
        if m and m.group(1)[0].islower():
            bad.append(line.strip())
    if bad:
        print(f"WARNING: {len(bad)} URLs still have lowercase paths:")
        for b in bad[:5]:
            print(f"  {b}")
        return 1
    else:
        print("All remaining URLs have valid Title_Case paths ✓")
    return 0

if __name__ == "__main__":
    sys.exit(main())
