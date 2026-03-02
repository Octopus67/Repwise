"""Feature flag routes — check flag status for the current user.

Exposes a single endpoint for the frontend to query whether a feature
flag is enabled for the authenticated user.  All evaluation logic lives
in ``FeatureFlagService`` (per project rule: routing only in router).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.feature_flags.service import FeatureFlagService

router = APIRouter()


@router.get("/check/{flag_name}")
async def check_feature_flag(
    flag_name: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check whether a feature flag is enabled for the current user."""
    service = FeatureFlagService(db)
    enabled = await service.is_feature_enabled(flag_name, user)
    return {"enabled": enabled}
