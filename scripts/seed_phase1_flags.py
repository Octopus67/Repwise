"""Seed script to insert Phase 1 feature flags.

Flags: food_search_ranking, combined_readiness, predictive_warmup

NOTE: Flags are seeded as is_enabled=False by default. To enable a flag
after seeding, update the row in the feature_flags table:
    UPDATE feature_flags SET is_enabled = true WHERE flag_name = '<name>';
Or use the admin API endpoint to toggle flags at runtime.

Usage:
    DATABASE_URL=sqlite+aiosqlite:///./test.db \
        .venv/bin/python -m scripts.seed_phase1_flags
"""

from __future__ import annotations

import asyncio

from sqlalchemy import JSON, select
from sqlalchemy.dialects.postgresql import JSONB

from src.config.database import async_session_factory, engine
from src.modules.feature_flags.models import FeatureFlag
from src.shared.base_model import Base

FLAGS = [
    {
        "flag_name": "food_search_ranking",
        "description": "Enables frequency-based personalized food search ranking. "
                       "When enabled, user's frequently logged foods appear higher in search results.",
    },
    {
        "flag_name": "combined_readiness",
        "description": "Enables the combined fatigue + readiness recovery score endpoint. "
                       "Produces a volume_multiplier (0.5-1.2) for training suggestions.",
    },
    {
        "flag_name": "predictive_warmup",
        "description": "Enables warm-up set generation from previous performance history "
                       "without requiring the user to enter a working weight first.",
    },
]


def _patch_jsonb_for_sqlite() -> None:
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, JSONB):
                column.type = JSON()
            if column.server_default is not None:
                default_text = (
                    str(column.server_default.arg)
                    if hasattr(column.server_default, "arg")
                    else ""
                )
                if "::jsonb" in default_text:
                    column.server_default = None


async def seed() -> None:
    from src.config.settings import settings

    if "sqlite" in settings.DATABASE_URL:
        _patch_jsonb_for_sqlite()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        for flag_def in FLAGS:
            result = await session.execute(
                select(FeatureFlag).where(
                    FeatureFlag.flag_name == flag_def["flag_name"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing is not None:
                print(
                    f"Flag '{flag_def['flag_name']}' already exists "
                    f"(is_enabled={existing.is_enabled}). Skipping."
                )
                continue

            flag = FeatureFlag(
                flag_name=flag_def["flag_name"],
                is_enabled=False,
                description=flag_def["description"],
            )
            session.add(flag)
            print(f"Inserted flag '{flag_def['flag_name']}' (is_enabled=False).")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
