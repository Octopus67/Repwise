"""Property-based tests for preference persistence round-trip.

Feature: product-polish-v2, Property 9: Preference persistence round-trip

**Validates: Requirements 5.3, 8.8**

For any valid unit_system or rest_timer preference, persisting via
PUT /user/profile and reading back via GET /user/profile returns
equivalent values.

Uses Hypothesis with minimum 100 iterations.
"""

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.auth.models import User
from src.modules.user.schemas import UserProfileUpdate
from src.modules.user.service import UserService

from tests.conftest import test_session_factory


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_unit_system = st.sampled_from(["metric", "imperial"])

_rest_timer = st.fixed_dictionaries({
    "compound_seconds": st.integers(min_value=10, max_value=600),
    "isolation_seconds": st.integers(min_value=10, max_value=600),
})

# Generate a full preferences dict with both unit_system and rest_timer
_preferences = st.fixed_dictionaries({
    "unit_system": _unit_system,
    "rest_timer": _rest_timer,
})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(session, user_id: uuid.UUID) -> None:
    """Insert a minimal User row so foreign keys are satisfied."""
    user = User(
        id=user_id,
        email=f"{user_id}@test.com",
        hashed_password="hashed",
        auth_provider="email",
        role="user",
    )
    session.add(user)
    await session.flush()


# ---------------------------------------------------------------------------
# Property 9: Preference persistence round-trip
# ---------------------------------------------------------------------------


class TestPreferencePersistenceRoundTrip:
    """**Validates: Requirements 5.3, 8.8**

    For any valid preference object (unit_system or rest_timer settings),
    persisting the preference via update_profile and reading it back via
    get_profile SHALL return an equivalent object.
    """

    @pytest.mark.asyncio
    @h_settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    @given(preferences=_preferences)
    async def test_full_preferences_round_trip(
        self, setup_database, preferences: dict
    ):
        """PUT preferences then GET returns equivalent values."""
        async with test_session_factory() as session:
            svc = UserService(session)
            uid = uuid.uuid4()

            # Create user so FK constraint is satisfied
            await _create_user(session, uid)
            await session.commit()

            # Persist preferences
            update = UserProfileUpdate(preferences=preferences)
            await svc.update_profile(uid, update)
            await session.commit()

            # Read back
            profile = await svc.get_profile(uid)

            assert profile.preferences is not None
            assert profile.preferences["unit_system"] == preferences["unit_system"]
            assert profile.preferences["rest_timer"]["compound_seconds"] == preferences["rest_timer"]["compound_seconds"]
            assert profile.preferences["rest_timer"]["isolation_seconds"] == preferences["rest_timer"]["isolation_seconds"]

            await session.rollback()

    @pytest.mark.asyncio
    @h_settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    @given(unit_system=_unit_system)
    async def test_unit_system_only_round_trip(
        self, setup_database, unit_system: str
    ):
        """Persisting only unit_system preference round-trips correctly."""
        async with test_session_factory() as session:
            svc = UserService(session)
            uid = uuid.uuid4()

            await _create_user(session, uid)
            await session.commit()

            # Persist just unit_system
            update = UserProfileUpdate(preferences={"unit_system": unit_system})
            await svc.update_profile(uid, update)
            await session.commit()

            # Read back
            profile = await svc.get_profile(uid)

            assert profile.preferences is not None
            assert profile.preferences["unit_system"] == unit_system

            await session.rollback()

    @pytest.mark.asyncio
    @h_settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    @given(rest_timer=_rest_timer)
    async def test_rest_timer_only_round_trip(
        self, setup_database, rest_timer: dict
    ):
        """Persisting only rest_timer preference round-trips correctly."""
        async with test_session_factory() as session:
            svc = UserService(session)
            uid = uuid.uuid4()

            await _create_user(session, uid)
            await session.commit()

            # Persist just rest_timer
            update = UserProfileUpdate(preferences={"rest_timer": rest_timer})
            await svc.update_profile(uid, update)
            await session.commit()

            # Read back
            profile = await svc.get_profile(uid)

            assert profile.preferences is not None
            assert profile.preferences["rest_timer"]["compound_seconds"] == rest_timer["compound_seconds"]
            assert profile.preferences["rest_timer"]["isolation_seconds"] == rest_timer["isolation_seconds"]

            await session.rollback()
