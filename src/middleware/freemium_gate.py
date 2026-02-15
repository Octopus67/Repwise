"""Freemium gating middleware — require_premium dependency.

FastAPI dependency that checks whether the authenticated user has an
active premium subscription. Used to gate premium-only endpoints.

Requirement 10.9: Enforce freemium gating on premium features.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.payments.models import Subscription
from src.shared.errors import PremiumRequiredError
from src.shared.types import SubscriptionStatus


async def require_premium(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that enforces premium subscription access.

    Checks the user's most recent subscription record. Access is granted
    if the subscription status is ``active`` or ``past_due`` (grace period).

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

    return user
