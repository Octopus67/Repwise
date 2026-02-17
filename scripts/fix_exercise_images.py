#!/usr/bin/env python3
"""
Fix broken exercise image/animation URLs in exercises.py by matching
folder names against the actual GitHub repo folder list.
"""

import re
import difflib
from pathlib import Path

REPO_FOLDERS_FILE = "/tmp/repo_folders.txt"
EXERCISES_FILE = "src/modules/training/exercises.py"
BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"


def load_repo_folders(path: str) -> set[str]:
    with open(path) as f:
        return {line.strip() for line in f if line.strip()}


def normalize(name: str) -> str:
    """Normalize a folder name for comparison."""
    return name.lower().replace("-", "_").replace(" ", "_")


def extract_folder_from_url(url: str) -> str | None:
    """Extract the folder name from a GitHub raw URL."""
    if not url or "exercises/" not in url:
        return None
    # Pattern: .../exercises/{FolderName}/0.jpg or /1.jpg
    match = re.search(r"/exercises/([^/]+)/\d+\.jpg", url)
    if match:
        return match.group(1)
    return None


def find_best_match(folder_name: str, repo_folders: set[str], norm_map: dict[str, str]) -> str | None:
    """Find the best matching repo folder for a given folder name."""
    # 1. Exact match
    if folder_name in repo_folders:
        return folder_name

    # 2. Normalized exact match
    norm = normalize(folder_name)
    if norm in norm_map:
        return norm_map[norm]

    # 3. Try substring matching
    for repo_folder in repo_folders:
        repo_norm = normalize(repo_folder)
        if norm in repo_norm or repo_norm in norm:
            return repo_folder

    # 4. Fuzzy matching with SequenceMatcher
    best_ratio = 0.0
    best_match = None
    for repo_folder in repo_folders:
        ratio = difflib.SequenceMatcher(None, norm, normalize(repo_folder)).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = repo_folder

    if best_ratio >= 0.6:
        return best_match

    return None


def fix_url(url: str, repo_folders: set[str], norm_map: dict[str, str], suffix: str) -> str | None:
    """Fix a single URL. Returns corrected URL or None if no match."""
    if not url or url == "None":
        return None

    folder = extract_folder_from_url(url)
    if not folder:
        return None

    # Already valid
    if folder in repo_folders:
        return url

    match = find_best_match(folder, repo_folders, norm_map)
    if match:
        return f"{BASE_URL}/{match}/{suffix}"
    return None


def main():
    repo_folders = load_repo_folders(REPO_FOLDERS_FILE)
    print(f"Loaded {len(repo_folders)} repo folders")

    # Build normalized lookup map
    norm_map: dict[str, str] = {}
    for f in repo_folders:
        n = normalize(f)
        norm_map[n] = f

    # Read the exercises file
    exercises_path = Path(EXERCISES_FILE)
    content = exercises_path.read_text()

    # Track stats
    total_image = 0
    total_anim = 0
    fixed_image = 0
    fixed_anim = 0
    nulled_image = 0
    nulled_anim = 0
    already_valid_image = 0
    already_valid_anim = 0
    already_none_image = 0
    already_none_anim = 0

    def replace_url(match_obj, suffix, stats_key):
        nonlocal total_image, total_anim, fixed_image, fixed_anim
        nonlocal nulled_image, nulled_anim, already_valid_image, already_valid_anim
        nonlocal already_none_image, already_none_anim

        full_match = match_obj.group(0)
        key = match_obj.group(1)  # image_url or animation_url
        value = match_obj.group(2)  # the URL string or None

        is_image = key == "image_url"

        if is_image:
            total_image += 1
        else:
            total_anim += 1

        # Already None
        if value.strip() == "None":
            if is_image:
                already_none_image += 1
            else:
                already_none_anim += 1
            return full_match

        # Strip quotes
        url = value.strip().strip('"').strip("'")
        if not url or url == "None":
            if is_image:
                already_none_image += 1
            else:
                already_none_anim += 1
            return full_match

        folder = extract_folder_from_url(url)
        if not folder:
            # Not a standard URL, leave as is
            return full_match

        if folder in repo_folders:
            if is_image:
                already_valid_image += 1
            else:
                already_valid_anim += 1
            return full_match

        # Need to fix
        best = find_best_match(folder, repo_folders, norm_map)
        if best:
            new_url = f"{BASE_URL}/{best}/{suffix}"
            if is_image:
                fixed_image += 1
            else:
                fixed_anim += 1
            return f'"{key}": "{new_url}"'
        else:
            if is_image:
                nulled_image += 1
            else:
                nulled_anim += 1
            return f'"{key}": None'

    # Process image_url entries
    def replace_image(m):
        return replace_url(m, "0.jpg", "image")

    def replace_anim(m):
        return replace_url(m, "1.jpg", "anim")

    # Match patterns like: "image_url": "https://..." or "image_url": None
    image_pattern = r'"(image_url)":\s*((?:"[^"]*")|(?:None))'
    anim_pattern = r'"(animation_url)":\s*((?:"[^"]*")|(?:None))'

    content = re.sub(image_pattern, replace_image, content)
    content = re.sub(anim_pattern, replace_anim, content)

    # Write back
    exercises_path.write_text(content)

    print(f"\n=== IMAGE URL STATS ===")
    print(f"Total image_url entries: {total_image}")
    print(f"Already valid: {already_valid_image}")
    print(f"Already None: {already_none_image}")
    print(f"Fixed (matched): {fixed_image}")
    print(f"Set to None (no match): {nulled_image}")

    print(f"\n=== ANIMATION URL STATS ===")
    print(f"Total animation_url entries: {total_anim}")
    print(f"Already valid: {already_valid_anim}")
    print(f"Already None: {already_none_anim}")
    print(f"Fixed (matched): {fixed_anim}")
    print(f"Set to None (no match): {nulled_anim}")

    # Verify final counts
    final_content = exercises_path.read_text()
    valid_images = len(re.findall(r'"image_url":\s*"https?://[^"]*"', final_content))
    none_images = len(re.findall(r'"image_url":\s*None', final_content))
    valid_anims = len(re.findall(r'"animation_url":\s*"https?://[^"]*"', final_content))
    none_anims = len(re.findall(r'"animation_url":\s*None', final_content))

    print(f"\n=== FINAL VERIFICATION ===")
    print(f"image_url - Valid URLs: {valid_images}, None: {none_images}")
    print(f"animation_url - Valid URLs: {valid_anims}, None: {none_anims}")


if __name__ == "__main__":
    main()
