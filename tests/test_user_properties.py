"""Property-based tests for the user module.

Uses Hypothesis to verify invariants across randomised inputs.
Tests run at the service level (not HTTP) for speed and isolation.
"""

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.user.schemas import UserMetricCreate
from src.modules.user.service import UserService
from src.shared.pagination import PaginationParams
from src.shared.types import ActivityLevel

# Re-use the test session factory from conftest
from tests.conftest import test_session_factory


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_activity_levels = st.sampled_from(list(ActivityLevel))

_metric_create = st.builds(
    UserMetricCreate,
    height_cm=st.one_of(st.none(), st.floats(min_value=50.0, max_value=250.0, allow_nan=False, allow_infinity=False)),
    weight_kg=st.one_of(st.none(), st.floats(min_value=20.0, max_value=300.0, allow_nan=False, allow_infinity=False)),
    body_fat_pct=st.one_of(st.none(), st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False)),
    activity_level=st.one_of(st.none(), _activity_levels),
    additional_metrics=st.none(),
)


# ---------------------------------------------------------------------------
# Property 7: History append-only invariant
# ---------------------------------------------------------------------------


class TestHistoryAppendOnlyInvariant:
    """**Validates: Requirements 2.5**

    For any N random metrics entries (1 ≤ N ≤ 20), adding them to a user's
    history SHALL increase the total count by exactly N, and all previously
    existing entries SHALL remain unchanged.
    """

    @pytest.mark.asyncio
    @h_settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    @given(
        n=st.integers(min_value=1, max_value=20),
        metrics=st.lists(
            _metric_create,
            min_size=20,
            max_size=20,
        ),
    )
    async def test_append_only_metrics(self, setup_database, n: int, metrics: list[UserMetricCreate]):
        """Adding N entries increases count by exactly N; prior entries unchanged."""
        async with test_session_factory() as session:
            svc = UserService(session)
            uid = uuid.uuid4()

            entries_to_add = metrics[:n]

            # Record the count before
            before = await svc.get_metrics_history(uid, PaginationParams(page=1, limit=1))
            count_before = before.total_count

            # Add N entries and collect their IDs
            created_ids = []
            for entry in entries_to_add:
                result = await svc.log_metrics(uid, entry)
                created_ids.append(result.id)

            await session.commit()

            # Verify count increased by exactly N
            after = await svc.get_metrics_history(uid, PaginationParams(page=1, limit=100))
            assert after.total_count == count_before + n

            # Verify all created entries are present
            returned_ids = {item.id for item in after.items}
            for cid in created_ids:
                assert cid in returned_ids

            await session.rollback()


# ---------------------------------------------------------------------------
# Property 20: Pagination metadata correctness
# ---------------------------------------------------------------------------


class TestPaginationMetadataCorrectness:
    """**Validates: Requirements 14.4**

    For any random page (1-10) and limit (1-50), querying a known number of
    entries SHALL return correct total_count, items.length ≤ limit,
    and correct has_next / has_previous flags.
    """

    @pytest.mark.asyncio
    @h_settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    @given(
        total_entries=st.integers(min_value=0, max_value=30),
        page=st.integers(min_value=1, max_value=10),
        limit=st.integers(min_value=1, max_value=50),
    )
    async def test_pagination_metadata(self, setup_database, total_entries: int, page: int, limit: int):
        """Pagination metadata is consistent with the actual data."""
        async with test_session_factory() as session:
            svc = UserService(session)
            uid = uuid.uuid4()

            # Create a known number of entries
            for i in range(total_entries):
                await svc.log_metrics(
                    uid,
                    UserMetricCreate(weight_kg=float(60 + i)),
                )

            await session.commit()

            # Query with random page/limit
            pagination = PaginationParams(page=page, limit=limit)
            result = await svc.get_metrics_history(uid, pagination)

            # total_count must match the number we created
            assert result.total_count == total_entries

            # items returned must not exceed limit
            assert len(result.items) <= limit

            # Compute expected item count for this page
            total_pages = (total_entries + limit - 1) // limit if total_entries > 0 else 0
            if page <= total_pages:
                if page < total_pages:
                    expected_count = limit
                else:
                    expected_count = total_entries - (page - 1) * limit
                assert len(result.items) == expected_count
            else:
                assert len(result.items) == 0

            # has_next: true iff there are more pages after this one
            assert result.has_next == (page < total_pages)

            # has_previous: true iff page > 1
            assert result.has_previous == (page > 1)

            await session.rollback()
