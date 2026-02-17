#!/usr/bin/env python3
"""Download exercise images from GitHub to local static directory."""

import os
import re
import sys
import urllib.request
import urllib.error

EXERCISES_FILE = os.path.join(os.path.dirname(__file__), "..", "src", "modules", "training", "exercises.py")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "exercises")

GITHUB_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"

# Patterns to extract URLs from exercises.py
FULL_URL_RE = re.compile(
    r'"(?:image_url|animation_url)":\s*"(https://raw\.githubusercontent\.com/yuhonas/free-exercise-db/main/exercises/([^"]+))"'
)
FSTRING_URL_RE = re.compile(
    r'"(?:image_url|animation_url)":\s*f"\{_IMG\}/([^"]+)"'
)


def collect_urls(filepath: str) -> list[tuple[str, str]]:
    """Return list of (download_url, relative_path) tuples."""
    urls: list[tuple[str, str]] = []
    seen: set[str] = set()

    with open(filepath, "r") as f:
        content = f.read()

    for match in FULL_URL_RE.finditer(content):
        url = match.group(1)
        rel_path = match.group(2)
        if rel_path not in seen:
            seen.add(rel_path)
            urls.append((url, rel_path))

    for match in FSTRING_URL_RE.finditer(content):
        rel_path = match.group(1)
        if rel_path not in seen:
            seen.add(rel_path)
            url = f"{GITHUB_BASE}/{rel_path}"
            urls.append((url, rel_path))

    return urls


def download_image(url: str, dest: str) -> bool:
    """Download a single image. Returns True on success."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest):
        return True
    try:
        urllib.request.urlretrieve(url, dest)
        return True
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        print(f"  FAILED: {url} -> {e}")
        return False


def main():
    if not os.path.exists(EXERCISES_FILE):
        print(f"ERROR: exercises.py not found at {EXERCISES_FILE}")
        sys.exit(1)

    urls = collect_urls(EXERCISES_FILE)
    print(f"Found {len(urls)} unique image URLs to download")

    success = 0
    failed = 0
    skipped = 0

    for i, (url, rel_path) in enumerate(urls, 1):
        dest = os.path.join(STATIC_DIR, rel_path)
        if os.path.exists(dest):
            skipped += 1
            continue
        print(f"[{i}/{len(urls)}] Downloading {rel_path}...")
        if download_image(url, dest):
            success += 1
        else:
            failed += 1

    print(f"\nDone! Downloaded: {success}, Skipped (existing): {skipped}, Failed: {failed}")


if __name__ == "__main__":
    main()
