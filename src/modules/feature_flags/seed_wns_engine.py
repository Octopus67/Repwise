"""Seed script to insert the wns_engine feature flag.

Usage:
    DATABASE_URL=sqlite+aiosqlite:///./dev.db \
        .venv/bin/python -m src.modules.feature_flags.seed_wns_engine
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

from sqlalchemy import select

from src.config.database import async_session_factory
from src.modules.feature_flags.models import FeatureFlag

FLAG_NAME = "wns_engine"
FLAG_DESCRIPTION = "Enable WNS hypertrophy unit calculations for volume analytics"


async def seed() -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(FeatureFlag).where(FeatureFlag.flag_name == FLAG_NAME)
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            if not existing.is_enabled:
                existing.is_enabled = True
                await session.commit()
                logger.info(f"Flag '{FLAG_NAME}' enabled.")
            else:
                logger.info(f"Flag '{FLAG_NAME}' already enabled. Skipping.")
            return

        flag = FeatureFlag(
            flag_name=FLAG_NAME,
            is_enabled=True,
            description=FLAG_DESCRIPTION,
        )
        session.add(flag)
        await session.commit()
        logger.info(f"Inserted flag '{FLAG_NAME}' (is_enabled=True).")


if __name__ == "__main__":
    asyncio.run(seed())
