"""Property-based tests for the founder module.

Tests Property 26 from the design document using Hypothesis.
Operates at the service level.
"""

from __future__ import annotations

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.auth.models import User
from src.modules.founder.models import FounderContent
from src.modules.founder.schemas import FounderContentUpdate
from src.modules.founder.service import FounderService
from src.shared.types import UserRole

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_section_keys = st.sampled_from(["story", "gallery", "philosophy", "timeline", "metrics"])

_locales = st.sampled_from(["en", "hi", "es"])

# Generate random JSONB-compatible content dicts
_content_values = st.dictionaries(
    keys=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N"), min_codepoint=65, max_codepoint=122),
        min_size=1,
        max_size=20,
    ),
    values=st.one_of(
        st.text(min_size=0, max_size=200),
        st.integers(min_value=-1000, max_value=1000),
        st.booleans(),
        st.lists(st.text(min_size=1, max_size=50), max_size=5),
    ),
    min_size=1,
    max_size=10,
)

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_admin(session) -> User:
    """Create an admin user for testing."""
    admin = User(
        email=f"admin-{uuid.uuid4().hex[:8]}@test.com",
        hashed_password="hashed",
        auth_provider="email",
        role=UserRole.ADMIN,
    )
    session.add(admin)
    await session.flush()
    return admin


# ---------------------------------------------------------------------------
# Property 26: Founder content update round-trip
# ---------------------------------------------------------------------------


class TestProperty26FounderContentUpdateRoundTrip:
    """Property 26: Founder content update round-trip.

    For any update to founder_content by an Admin, the next read of that
    section_key and locale SHALL return the updated content.

    **Validates: Requirements 13.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        section_key=_section_keys,
        locale=_locales,
        content=_content_values,
    )
    async def test_update_then_read_returns_updated_content(
        self,
        section_key: str,
        locale: str,
        content: dict,
        db_session,
    ):
        """Updating founder content and reading it back must return the updated values.

        **Validates: Requirements 13.2**
        """
        service = FounderService(db_session)
        admin = await _create_admin(db_session)
        await db_session.commit()

        # Act: update content
        update_data = FounderContentUpdate(
            section_key=section_key,
            locale=locale,
            content=content,
        )
        updated_entry = await service.update_content(
            data=update_data, admin_user_id=admin.id
        )
        await db_session.commit()

        # Assert: read back returns the updated content
        items = await service.get_content(section_key=section_key, locale=locale)
        assert len(items) >= 1, "Expected at least one content entry"

        found = items[0]
        assert found.content == content, (
            f"Expected content {content}, got {found.content}"
        )
        assert found.section_key == section_key
        assert found.locale == locale

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        section_key=_section_keys,
        content_v1=_content_values,
        content_v2=_content_values,
    )
    async def test_sequential_updates_return_latest(
        self,
        section_key: str,
        content_v1: dict,
        content_v2: dict,
        db_session,
    ):
        """Multiple updates to the same section must always return the latest content.

        **Validates: Requirements 13.2**
        """
        service = FounderService(db_session)
        admin = await _create_admin(db_session)
        await db_session.commit()

        # First update
        await service.update_content(
            data=FounderContentUpdate(
                section_key=section_key, locale="en", content=content_v1
            ),
            admin_user_id=admin.id,
        )
        await db_session.commit()

        # Second update
        await service.update_content(
            data=FounderContentUpdate(
                section_key=section_key, locale="en", content=content_v2
            ),
            admin_user_id=admin.id,
        )
        await db_session.commit()

        # Read back — should be v2
        items = await service.get_content(section_key=section_key, locale="en")
        assert len(items) >= 1
        assert items[0].content == content_v2, (
            f"Expected latest content {content_v2}, got {items[0].content}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        section_key=_section_keys,
        content=_content_values,
    )
    async def test_version_increments_on_update(
        self,
        section_key: str,
        content: dict,
        db_session,
    ):
        """Each update to the same section must increment the version by 1.

        **Validates: Requirements 13.2**
        """
        service = FounderService(db_session)
        admin = await _create_admin(db_session)
        await db_session.commit()

        # Create initial content
        entry = await service.update_content(
            data=FounderContentUpdate(
                section_key=section_key, locale="en", content={"initial": True}
            ),
            admin_user_id=admin.id,
        )
        await db_session.commit()
        initial_version = entry.version

        # Update
        updated = await service.update_content(
            data=FounderContentUpdate(
                section_key=section_key, locale="en", content=content
            ),
            admin_user_id=admin.id,
        )
        await db_session.commit()

        assert updated.version == initial_version + 1, (
            f"Expected version {initial_version + 1}, got {updated.version}"
        )
