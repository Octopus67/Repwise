#!/usr/bin/env python3
"""Fix broken exercise image URLs in exercises.py by matching against actual repo folder names."""

import re
import difflib

# Load repo folder names
with open('/tmp/repo_folders.txt') as f:
    repo_folders = [line.strip() for line in f if line.strip()]

repo_folders_set = set(repo_folders)
repo_folders_lower = {f.lower(): f for f in repo_folders}

# Read exercises.py
with open('src/modules/training/exercises.py') as f:
    content = f.read()

BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"

def normalize(name):
    """Normalize a name for comparison."""
    return name.replace(' ', '_').replace('-', '_').replace('__', '_').strip('_')

def find_matching_folder(current_folder):
    """Try to find the correct repo folder for a given current folder name."""
    # 1. Exact match
    if current_folder in repo_folders_set:
        return current_folder
    
    # 2. Case-insensitive exact match
    lower = current_folder.lower()
    if lower in repo_folders_lower:
        return repo_folders_lower[lower]
    
    # 3. Normalized match (replace hyphens with underscores, etc.)
    norm = normalize(current_folder)
    norm_lower = norm.lower()
    for folder in repo_folders:
        if normalize(folder).lower() == norm_lower:
            return folder
    
    # 4. Fuzzy match using difflib - high cutoff first
    matches = difflib.get_close_matches(current_folder, repo_folders, n=1, cutoff=0.85)
    if matches:
        return matches[0]
    
    # Try normalized fuzzy match
    norm_map = {normalize(f).lower(): f for f in repo_folders}
    matches = difflib.get_close_matches(norm_lower, list(norm_map.keys()), n=1, cutoff=0.85)
    if matches:
        return norm_map[matches[0]]
    
    # Lower cutoff
    matches = difflib.get_close_matches(current_folder, repo_folders, n=1, cutoff=0.7)
    if matches:
        return matches[0]
    
    matches = difflib.get_close_matches(norm_lower, list(norm_map.keys()), n=1, cutoff=0.7)
    if matches:
        return norm_map[matches[0]]
    
    # 5. Word-based Jaccard similarity
    current_words = set(current_folder.lower().replace('-', '_').split('_'))
    best_score = 0
    best_folder = None
    for folder in repo_folders:
        folder_words = set(folder.lower().replace('-', '_').split('_'))
        if current_words and folder_words:
            intersection = current_words & folder_words
            union = current_words | folder_words
            score = len(intersection) / len(union)
            if score > best_score and score >= 0.6:
                best_score = score
                best_folder = folder
    
    if best_folder:
        return best_folder
    
    return None

# Track statistics
fixed = 0
already_ok = 0
set_to_none = 0
changes = []

def replace_url(match):
    global fixed, already_ok, set_to_none
    full_match = match.group(0)
    field_name = match.group(1)  # image_url or animation_url
    current_folder = match.group(2)
    suffix = match.group(3)  # 0.jpg or 1.jpg
    
    if current_folder in repo_folders_set:
        already_ok += 1
        return full_match
    
    new_folder = find_matching_folder(current_folder)
    if new_folder:
        fixed += 1
        changes.append(f"  FIXED: {current_folder} -> {new_folder}")
        return f'"{field_name}": "{BASE_URL}/{new_folder}/{suffix}"'
    else:
        set_to_none += 1
        changes.append(f"  NONE: {current_folder} (no match found)")
        return f'"{field_name}": None'

# Pattern matches both image_url and animation_url
pattern = r'"(image_url|animation_url)":\s*"https://raw\.githubusercontent\.com/yuhonas/free-exercise-db/main/exercises/([^/]+)/(\d+\.jpg)"'

new_content = re.sub(pattern, replace_url, content)

# Write back
with open('src/modules/training/exercises.py', 'w') as f:
    f.write(new_content)

print(f"Results:")
print(f"  Already OK: {already_ok}")
print(f"  Fixed: {fixed}")
print(f"  Set to None: {set_to_none}")
print(f"  Total URLs processed: {already_ok + fixed + set_to_none}")
print()
for c in changes:
    print(c)
