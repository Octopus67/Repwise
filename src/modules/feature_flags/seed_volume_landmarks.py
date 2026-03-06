"""Seed script to insert the volume_landmarks feature flag.

Usage:
    DATABASE_URL=sqlite+aiosqlite:///./test.db \
        .venv/bin/python -m src.modules.feature_flags.seed_volume_landmarks
"""

from __future__ import annotations

import asyncio

from sqlalchemy import JSON, select
from sqlalchemy.dialects.postgresql import JSONB

from src.config.database import async_session_factory, engine
from src.modules.feature_flags.models import FeatureFlag
from src.shared.base_model import Base

FLAG_NAME = "volume_landmarks"
FLAG_DESCRIPTION = (
    "Show volume landmarks visualization on Analytics screen"
)


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
        result = await session.execute(
            select(FeatureFlag).where(FeatureFlag.flag_name == FLAG_NAME)
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            print(f"Flag '{FLAG_NAME}' already exists (is_enabled={existing.is_enabled}). Skipping.")
            return

        flag = FeatureFlag(
            flag_name=FLAG_NAME,
            is_enabled=False,
            description=FLAG_DESCRIPTION,
        )
        session.add(flag)
        await session.commit()
        print(f"Inserted flag '{FLAG_NAME}' (is_enabled=False).")


if __name__ == "__main__":
    asyncio.run(seed())
