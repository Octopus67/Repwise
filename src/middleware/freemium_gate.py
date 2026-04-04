"""Freemium gating middleware — require_premium & require_feature dependencies.

FastAPI dependency that checks whether the authenticated user has an
active premium subscription. Used to gate premium-only endpoints.

``require_feature`` provides PostHog-based feature-level gating.
It fails open if PostHog is unreachable (all features free at launch).

Requirement 10.9: Enforce freemium gating on premium features.
"""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.payments.models import Subscription
from src.services.feature_flags import is_feature_enabled
from src.shared.errors import PremiumRequiredError
from src.shared.types import SubscriptionStatus

logger = logging.getLogger(__name__)


async def require_premium(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that enforces premium subscription access.

    Checks the user's most recent subscription record. Access is granted
    if the subscription status is ``active`` or ``past_due`` (grace period)
    and the subscription has not expired.

    Unverified users can access basic features freely. Email verification
    is no longer a hard gate for premium — it is prompted separately.

    Raises PremiumRequiredError (403) if the user does not have an active
    premium subscription.
    """
    # Admin users always have access
    if user.role == "admin":
        return user

    stmt = (
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .where(Subscription.deleted_at.is_(None))
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    subscription = result.scalar_one_or_none()

    if subscription is None or subscription.status not in (
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
    ):
        raise PremiumRequiredError("Active subscription required")

    # Check expiry date (applies to both trial and paid)
    if subscription.current_period_end:
        from datetime import datetime, timezone
        if datetime.now(timezone.utc) > subscription.current_period_end:
            raise PremiumRequiredError("Subscription has expired")

    return user


def require_feature(flag_name: str) -> Callable:
    """FastAPI dependency factory for PostHog feature-level gating.

    Usage::

        @router.get("/coaching", dependencies=[Depends(require_feature("coaching"))])
        async def coaching_endpoint(...): ...

    Fails open if PostHog is unreachable — features are free at launch.
    """

    async def _check(user: User = Depends(get_current_user)) -> User:
        enabled = is_feature_enabled(flag_name, str(user.id))
        if not enabled:
            raise PremiumRequiredError(f"Feature '{flag_name}' is not available")
        return user

    return Depends(_check)
