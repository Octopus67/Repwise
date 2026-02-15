"""
PostHog analytics service.

Tracks user engagement, conversion, and feature usage events.
Fire-and-forget — analytics failures are silently dropped (non-critical).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

# PostHog client placeholder — initialised at app startup via init_analytics()
_posthog_client: Optional[Any] = None


def init_analytics(api_key: Optional[str] = None, host: str = "https://app.posthog.com") -> None:
    """Initialise the PostHog client. Safe to call with None (analytics disabled)."""
    global _posthog_client
    if not api_key:
        logger.info("PostHog API key not set — analytics disabled")
        return
    try:
        import posthog  # type: ignore[import-untyped]

        posthog.project_api_key = api_key
        posthog.host = host
        _posthog_client = posthog
        logger.info("PostHog analytics initialised")
    except ImportError:
        logger.warning("posthog package not installed — analytics disabled")


def track_event(
    user_id: UUID | str,
    event: str,
    properties: Optional[dict[str, Any]] = None,
) -> None:
    """Track a discrete event. Fire-and-forget."""
    if _posthog_client is None:
        return
    try:
        _posthog_client.capture(
            distinct_id=str(user_id),
            event=event,
            properties={
                **(properties or {}),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception:
        logger.debug("Failed to send analytics event %s", event, exc_info=True)


def track_page_view(
    user_id: UUID | str,
    page: str,
    properties: Optional[dict[str, Any]] = None,
) -> None:
    """Track a page/screen view."""
    track_event(user_id, "$pageview", {"$current_url": page, **(properties or {})})


# ── Convenience helpers for standard platform events ─────────────────────────


def track_user_registered(user_id: UUID | str) -> None:
    track_event(user_id, "user.registered")


def track_user_logged_in(user_id: UUID | str, method: str = "email") -> None:
    track_event(user_id, "user.logged_in", {"method": method})


def track_subscription_created(
    user_id: UUID | str, plan_id: str, currency: str
) -> None:
    track_event(
        user_id,
        "subscription.created",
        {"plan_id": plan_id, "currency": currency},
    )


def track_article_read(user_id: UUID | str, article_id: UUID | str) -> None:
    track_event(user_id, "article.read", {"article_id": str(article_id)})


def track_coaching_requested(user_id: UUID | str) -> None:
    track_event(user_id, "coaching.requested")


def track_feature_used(user_id: UUID | str, feature: str) -> None:
    track_event(user_id, "feature.used", {"feature": feature})
