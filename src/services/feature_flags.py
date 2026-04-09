"""PostHog-based feature flag evaluation service.

Provides ``is_feature_enabled`` for evaluating feature flags via PostHog's
Python SDK. Used by ``require_feature`` middleware for feature-level gating.

Fail-open policy: if PostHog is unreachable, access is granted (all features
are free at launch). Flag values are cached for 60 seconds.
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Optional, Tuple

from src.config.settings import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory TTL cache for PostHog flag evaluations
# ---------------------------------------------------------------------------

_CACHE_TTL: float = 60.0
_cache: Dict[Tuple[str, str], Tuple[bool, float]] = {}


def _get_cached(flag_name: str, user_id: str) -> Optional[bool]:
    key = (flag_name, user_id)
    entry = _cache.get(key)
    if entry is None or time.monotonic() > entry[1]:
        return None
    return entry[0]


def _put_cached(flag_name: str, user_id: str, value: bool) -> None:
    _cache[(flag_name, user_id)] = (value, time.monotonic() + _CACHE_TTL)


def invalidate_posthog_cache(flag_name: Optional[str] = None) -> None:
    """Clear PostHog flag cache entries. Called on flag updates for cross-cache consistency."""
    if flag_name is None:
        _cache.clear()
    else:
        to_remove = [k for k in _cache if k[0] == flag_name]
        for k in to_remove:
            del _cache[k]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def is_feature_enabled(
    flag_name: str,
    user_id: str,
    properties: dict | None = None,
) -> bool:
    """Evaluate a PostHog feature flag for a user.

    Returns True (fail open) if PostHog is not configured or unreachable.
    """
    # No API key configured — fail open
    if not settings.POSTHOG_PROJECT_API_KEY:
        return True

    cached = _get_cached(flag_name, user_id)
    if cached is not None:
        return cached

    try:
        import posthog

        posthog.project_api_key = settings.POSTHOG_PROJECT_API_KEY
        posthog.host = settings.POSTHOG_HOST

        result = posthog.feature_enabled(
            flag_name,
            user_id,
            person_properties=properties or {},
        )
        enabled = bool(result) if result is not None else True
        _put_cached(flag_name, user_id, enabled)
        return enabled
    except (ImportError, OSError, ValueError) as exc:
        logger.warning("PostHog unreachable for flag '%s' (%s) — failing open", flag_name, type(exc).__name__)
        return True
