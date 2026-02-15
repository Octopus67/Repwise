"""Feature flag service with in-memory TTL cache.

Provides ``is_feature_enabled``, ``get_flags``, and ``set_flag`` for
runtime feature toggling (Requirement 15.6).

The cache avoids hitting the database on every flag check.  Entries
expire after ``CACHE_TTL_SECONDS`` (default 60 s).
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.feature_flags.models import FeatureFlag


# ---------------------------------------------------------------------------
# In-memory TTL cache
# ---------------------------------------------------------------------------

CACHE_TTL_SECONDS: float = 60.0


@dataclass
class _CacheEntry:
    flag: Optional[FeatureFlag]
    expires_at: float


_cache: Dict[str, _CacheEntry] = {}


def _get_cached(flag_name: str) -> Optional[FeatureFlag] | type[_MISS]:
    """Return the cached flag, ``None`` (flag doesn't exist), or ``_MISS``."""
    entry = _cache.get(flag_name)
    if entry is None or time.monotonic() > entry.expires_at:
        return _MISS
    return entry.flag


class _MissSentinel:
    """Sentinel indicating a cache miss."""
    pass


_MISS = _MissSentinel


def _put_cached(flag_name: str, flag: Optional[FeatureFlag]) -> None:
    _cache[flag_name] = _CacheEntry(
        flag=flag,
        expires_at=time.monotonic() + CACHE_TTL_SECONDS,
    )


def invalidate_cache(flag_name: Optional[str] = None) -> None:
    """Invalidate a single flag or the entire cache."""
    if flag_name is None:
        _cache.clear()
    else:
        _cache.pop(flag_name, None)


# ---------------------------------------------------------------------------
# Public user-like object protocol (duck-typed)
# ---------------------------------------------------------------------------

class _UserLike:
    """Minimal protocol expected by ``is_feature_enabled``."""
    id: uuid.UUID
    role: str
    # Optional: region attribute for region-based conditions


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class FeatureFlagService:
    """Service for managing and evaluating feature flags."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def is_feature_enabled(
        self,
        flag_name: str,
        user: Optional[Any] = None,
    ) -> bool:
        """Evaluate whether a flag is enabled for the given user.

        Evaluation logic (from design doc):
        1. If the flag doesn't exist or ``is_enabled`` is False → False.
        2. If ``conditions`` is empty/null → True (enabled for everyone).
        3. Check ``roles``, ``regions``, ``user_ids`` conditions against user.
        """
        flag = await self._get_flag(flag_name)
        if flag is None or not flag.is_enabled:
            return False

        conditions = flag.conditions
        if not conditions:
            return True  # enabled for all

        if user is None:
            return False  # conditions exist but no user context

        # Role check
        if "roles" in conditions:
            user_role = getattr(user, "role", None)
            if user_role not in conditions["roles"]:
                return False

        # Region check
        if "regions" in conditions:
            user_region = getattr(user, "region", None)
            if user_region not in conditions["regions"]:
                return False

        # User ID allowlist
        if "user_ids" in conditions:
            user_id = str(getattr(user, "id", ""))
            if user_id not in conditions["user_ids"]:
                return False

        return True

    async def get_flags(self) -> list[FeatureFlag]:
        """Return all feature flags."""
        stmt = select(FeatureFlag).order_by(FeatureFlag.flag_name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def set_flag(
        self,
        flag_name: str,
        *,
        is_enabled: Optional[bool] = None,
        conditions: Optional[dict[str, Any]] = ...,  # type: ignore[assignment]
        description: Optional[str] = ...,  # type: ignore[assignment]
    ) -> FeatureFlag:
        """Create or update a feature flag.

        Pass explicit ``None`` for ``conditions`` or ``description`` to clear
        them.  Omit (use the ``...`` default) to leave unchanged on update.
        """
        stmt = select(FeatureFlag).where(FeatureFlag.flag_name == flag_name)
        result = await self.session.execute(stmt)
        flag = result.scalar_one_or_none()

        if flag is None:
            # Create new flag
            flag = FeatureFlag(
                flag_name=flag_name,
                is_enabled=is_enabled if is_enabled is not None else False,
                conditions=conditions if conditions is not ... else None,
                description=description if description is not ... else None,
            )
            self.session.add(flag)
        else:
            # Update existing flag
            if is_enabled is not None:
                flag.is_enabled = is_enabled
            if conditions is not ...:
                flag.conditions = conditions
            if description is not ...:
                flag.description = description

        await self.session.flush()
        invalidate_cache(flag_name)
        return flag

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_flag(self, flag_name: str) -> Optional[FeatureFlag]:
        """Fetch a flag, using the in-memory cache when possible."""
        cached = _get_cached(flag_name)
        if not isinstance(cached, type) or cached is not _MISS:
            return cached  # type: ignore[return-value]

        stmt = select(FeatureFlag).where(FeatureFlag.flag_name == flag_name)
        result = await self.session.execute(stmt)
        flag = result.scalar_one_or_none()
        _put_cached(flag_name, flag)
        return flag
