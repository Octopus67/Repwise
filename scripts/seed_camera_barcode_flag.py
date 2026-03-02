"""Seed script to create the camera_barcode_scanner feature flag.

Usage:
    python scripts/seed_camera_barcode_flag.py

Creates the flag with is_enabled=False so it can be toggled on
during staged rollout.
"""

import asyncio
import sys
import os

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.database import async_session_factory
from src.modules.feature_flags.service import FeatureFlagService


async def main() -> None:
    async with async_session_factory() as session:
        svc = FeatureFlagService(session)
        flag = await svc.set_flag(
            "camera_barcode_scanner",
            is_enabled=False,
            description="Gates camera-based barcode scanner in nutrition logger",
        )
        await session.commit()
        print(f"✓ Feature flag created: {flag.flag_name} (enabled={flag.is_enabled})")
        print(f"  Description: {flag.description}")


if __name__ == "__main__":
    asyncio.run(main())
