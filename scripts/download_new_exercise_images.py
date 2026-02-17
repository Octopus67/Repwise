#!/usr/bin/env python3
"""Download exercise images for all exercises using local path format."""

import os
import sys
import urllib.request
import urllib.error

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.modules.training.exercises import EXERCISES

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "exercises")
GITHUB_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"


def main():
    to_download = []
    for ex in EXERCISES:
        for url_field in ("image_url", "animation_url"):
            path = ex.get(url_field)
            if not path or not path.startswith("/static/exercises/"):
                continue
            # Extract relative path: /static/exercises/Foo/0.jpg -> Foo/0.jpg
            rel = path.replace("/static/exercises/", "")
            dest = os.path.join(STATIC_DIR, rel)
            if not os.path.exists(dest):
                download_url = f"{GITHUB_BASE}/{rel}"
                to_download.append((download_url, dest, rel))

    print(f"Need to download {len(to_download)} images")

    success = 0
    failed = 0
    for i, (url, dest, rel) in enumerate(to_download, 1):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        try:
            urllib.request.urlretrieve(url, dest)
            success += 1
            if i % 50 == 0:
                print(f"  [{i}/{len(to_download)}] downloaded...")
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            failed += 1
            if failed <= 10:
                print(f"  FAILED: {rel} -> {e}")

    print(f"\nDone! Downloaded: {success}, Failed: {failed}")
    # Count total exercise image dirs
    if os.path.exists(STATIC_DIR):
        dirs = [d for d in os.listdir(STATIC_DIR) if os.path.isdir(os.path.join(STATIC_DIR, d))]
        print(f"Total exercise image directories: {len(dirs)}")


if __name__ == "__main__":
    main()
