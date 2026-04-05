"""Shared Pydantic validators for input sanitization."""

from __future__ import annotations

import json
from typing import Any

# Audit fix 6.9 — JSONB validation
MAX_JSON_SIZE_BYTES = 65_536  # 64 KB
MAX_JSON_DEPTH = 4


def validate_json_size(
    v: dict[str, Any] | list[Any] | None,
    *,
    max_bytes: int = MAX_JSON_SIZE_BYTES,
    expected_type: type | None = None,
) -> dict[str, Any] | list[Any] | None:
    """Reject JSON payloads exceeding size or depth limits.

    Args:
        v: The value to validate.
        max_bytes: Maximum serialized size in bytes (default 64 KB).
        expected_type: If provided, enforce that *v* is an instance of this type
            (e.g. ``dict`` for slot_splits, ``list`` for document_urls).
    """
    if v is None:
        return v
    # Audit fix 6.9 — JSONB validation
    if expected_type is not None and not isinstance(v, expected_type):
        raise ValueError(f"Expected {expected_type.__name__}, got {type(v).__name__}")
    _check_depth(v, 0)
    serialized = json.dumps(v)
    if len(serialized) > max_bytes:
        raise ValueError(f"JSON payload too large (max {max_bytes // 1024}KB)")
    return v


def _check_depth(obj: Any, depth: int) -> None:
    if depth > MAX_JSON_DEPTH:
        raise ValueError(f"JSON nesting too deep (max {MAX_JSON_DEPTH} levels)")
    if isinstance(obj, dict):
        for val in obj.values():
            _check_depth(val, depth + 1)
    elif isinstance(obj, list):
        for item in obj:
            _check_depth(item, depth + 1)
