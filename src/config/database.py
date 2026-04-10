"""Async SQLAlchemy engine and session factory."""

import logging
import os
import time
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config.settings import settings

pool_kwargs = {} if "sqlite" in settings.DATABASE_URL else {
    "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),  # Audit fix 8.8
    "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),  # Audit fix 8.8
    "pool_timeout": 30,
    "pool_recycle": 3600,
    "pool_pre_ping": True,
}

connect_args = {} if "sqlite" in settings.DATABASE_URL else {"timeout": 10}
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, connect_args=connect_args, **pool_kwargs)

# --- Slow query logging (attached to sync engine underneath async engine) ---
_slow_query_logger = logging.getLogger("slow_queries")


@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info["query_start_time"] = time.time()


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info.get("query_start_time", time.time())
    if total > 0.5:
        _slow_query_logger.error("Very slow query (%.2fs): %s", total, statement[:200])
    elif total > 0.1:
        _slow_query_logger.warning("Slow query (%.2fs): %s", total, statement[:200])


async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except BaseException:  # Session guard: must rollback on ANY error
            await session.rollback()
            raise
