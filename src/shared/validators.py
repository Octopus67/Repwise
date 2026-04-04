"""Shared Pydantic validators for input sanitization."""

from __future__ import annotations

import json
from typing import Any

MAX_JSON_SIZE_BYTES = 10_240  # 10 KB
MAX_JSON_DEPTH = 4


def validate_json_size(v: dict[str, Any] | None) -> dict[str, Any] | None:
    """Reject JSON payloads exceeding size or depth limits."""
    if v is None:
        return v
    _check_depth(v, 0)
    serialized = json.dumps(v)
    if len(serialized) > MAX_JSON_SIZE_BYTES:
        raise ValueError(f"JSON payload too large (max {MAX_JSON_SIZE_BYTES // 1024}KB)")
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
