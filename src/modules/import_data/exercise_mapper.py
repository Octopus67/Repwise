"""Token-based exercise name mapper using Jaccard similarity."""

import re

MATCH_THRESHOLD = 0.7


def normalize_exercise(name: str) -> set[str]:
    """'Bench Press (Barbell)' → {'bench', 'press', 'barbell'}"""
    cleaned = re.sub(r"[()\-/,]", " ", name.lower())
    return {t for t in cleaned.split() if len(t) > 1}


def jaccard_similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def map_exercises(imported_names: list[str], db_exercises: list[dict]) -> dict:
    """Match imported exercise names to DB exercises using token overlap.

    Args:
        imported_names: Exercise names from CSV import.
        db_exercises: List of dicts with 'id' and 'name' keys (loaded once, no N+1).

    Returns:
        Dict mapping each imported name to match info or create_as_custom flag.
    """
    # Pre-compute tokens for all DB exercises once
    db_tokens = [(ex, normalize_exercise(ex["name"])) for ex in db_exercises]
    result = {}

    for name in imported_names:
        tokens = normalize_exercise(name)
        best_score, best_match = 0.0, None

        for ex, ex_tokens in db_tokens:
            score = jaccard_similarity(tokens, ex_tokens)
            if score > best_score:
                best_score, best_match = score, ex

        if best_score >= MATCH_THRESHOLD and best_match:
            result[name] = {
                "matched": best_match["name"],
                "confidence": round(best_score, 3),
                "db_id": best_match["id"],
            }
        else:
            result[name] = {"matched": None, "create_as_custom": True}

    return result
