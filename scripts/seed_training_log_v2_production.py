"""Production seed script for the training_log_v2 feature flag.

Creates the flag with is_enabled=False and conditions targeting team member
user IDs for internal dogfood.  Safe to run multiple times — skips creation
if the flag already exists.

Usage (deployment pipeline):
    python scripts/seed_training_log_v2_production.py

Exit codes:
    0 — flag created or already exists
    1 — unexpected error
"""

import asyncio
import sys
import os

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from src.config.database import async_session_factory
from src.modules.feature_flags.models import FeatureFlag
from src.modules.feature_flags.service import FeatureFlagService

# ---------------------------------------------------------------------------
# Team member user IDs for internal dogfood phase.
# Replace these placeholder UUIDs with real team member IDs before deploying.
# ---------------------------------------------------------------------------
TEAM_MEMBER_USER_IDS: list[str] = [
    # "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",  # <team-member-1>
    # "aaaaaaaa-bbbb-cccc-dddd-ffffffffffff",  # <team-member-2>
]

FLAG_NAME = "training_log_v2"
FLAG_DESCRIPTION = "Gates training log v2 redesign — Active Workout Screen"


async def main() -> int:
    async with async_session_factory() as session:
        # --- Idempotency check: skip if flag already exists ----------------
        stmt = select(FeatureFlag).where(FeatureFlag.flag_name == FLAG_NAME)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            print(f"⏭  Flag '{FLAG_NAME}' already exists (enabled={existing.is_enabled}). Skipping.")
            return 0

        # --- Create the flag -----------------------------------------------
        conditions = None
        if TEAM_MEMBER_USER_IDS:
            conditions = {"user_ids": TEAM_MEMBER_USER_IDS}

        svc = FeatureFlagService(session)
        flag = await svc.set_flag(
            FLAG_NAME,
            is_enabled=False,
            conditions=conditions,
            description=FLAG_DESCRIPTION,
        )
        await session.commit()

        print(f"✓ Feature flag created: {flag.flag_name}")
        print(f"  enabled:     {flag.is_enabled}")
        print(f"  conditions:  {flag.conditions}")
        print(f"  description: {flag.description}")
    return 0


if __name__ == "__main__":
    try:
        code = asyncio.run(main())
    except Exception as exc:
        print(f"✗ Failed to seed feature flag: {exc}", file=sys.stderr)
        sys.exit(1)
    sys.exit(code)
