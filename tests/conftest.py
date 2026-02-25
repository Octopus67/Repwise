"""Test fixtures using async SQLite for testing."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import JSON, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.config.database import get_db
from src.main import app

# Import all model modules so Base.metadata knows about every table
from src.shared.base_model import Base  # noqa: F401
import src.modules.auth.models  # noqa: F401
import src.modules.user.models  # noqa: F401
import src.modules.adaptive.models  # noqa: F401
import src.modules.nutrition.models  # noqa: F401
import src.modules.meals.models  # noqa: F401
import src.modules.training.models  # noqa: F401
import src.modules.payments.models  # noqa: F401
import src.modules.content.models  # noqa: F401
import src.modules.coaching.models  # noqa: F401
import src.modules.food_database.models  # noqa: F401
import src.modules.feature_flags.models  # noqa: F401
import src.modules.health_reports.models  # noqa: F401
import src.modules.founder.models  # noqa: F401
import src.modules.progress_photos.models  # noqa: F401
import src.modules.achievements.models  # noqa: F401
import src.modules.recomp.models  # noqa: F401
import src.modules.meal_plans.models  # noqa: F401
import src.modules.periodization.models  # noqa: F401
import src.modules.notifications.models  # noqa: F401

# Use SQLite for tests — async via aiosqlite
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# Patch JSONB columns → plain JSON so SQLite can handle them
# Also patch PostgreSQL-specific server defaults that break SQLite
for table in Base.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, JSONB):
            column.type = JSON()
        # Remove PostgreSQL-specific casts like '{}'::jsonb from server_default
        if column.server_default is not None:
            default_text = str(column.server_default.arg) if hasattr(column.server_default, "arg") else ""
            if "::jsonb" in default_text:
                column.server_default = None


class TestBase(DeclarativeBase):
    """Base class available for test-only models if needed."""

    pass


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a test database session with automatic rollback."""
    async with test_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def override_get_db(db_session: AsyncSession):
    """Override the get_db dependency to use the test session."""

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Provide an HTTPX async test client for the FastAPI app."""
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")
