"""Property-based tests for the nutrition module.

Tests Properties 1, 2, and 3 from the design document using Hypothesis.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy import select

from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.schemas import (
    DateRangeFilter,
    NutritionEntryCreate,
)
from src.modules.nutrition.service import NutritionService
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_reasonable_float = st.floats(min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False)

_meal_names = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), min_codepoint=32, max_codepoint=127),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_entry_dates = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))

_nutrition_entry_create = st.builds(
    NutritionEntryCreate,
    meal_name=_meal_names,
    calories=_reasonable_float,
    protein_g=_reasonable_float,
    carbs_g=_reasonable_float,
    fat_g=_reasonable_float,
    micro_nutrients=st.none(),
    entry_date=_entry_dates,
    source_meal_id=st.none(),
)


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 1: Entity creation round-trip
# ---------------------------------------------------------------------------


class TestProperty1CreationRoundTrip:
    """Property 1: Entity creation round-trip.

    For any valid nutrition entry input, creating the entry and then
    retrieving it SHALL produce an object with equivalent field values.

    **Validates: Requirements 3.1**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=_nutrition_entry_create)
    async def test_create_and_retrieve_round_trip(
        self, data: NutritionEntryCreate, db_session
    ):
        """Created entries must be retrievable with equivalent field values.

        **Validates: Requirements 3.1**
        """
        user_id = uuid.uuid4()
        service = NutritionService(db_session)

        created = await service.create_entry(user_id=user_id, data=data)
        await db_session.commit()

        # Retrieve via get_entries
        result = await service.get_entries(
            user_id=user_id,
            pagination=PaginationParams(page=1, limit=10),
        )

        assert result.total_count >= 1
        retrieved = next(e for e in result.items if e.id == created.id)

        assert retrieved.meal_name == data.meal_name
        assert retrieved.calories == pytest.approx(data.calories)
        assert retrieved.protein_g == pytest.approx(data.protein_g)
        assert retrieved.carbs_g == pytest.approx(data.carbs_g)
        assert retrieved.fat_g == pytest.approx(data.fat_g)
        assert retrieved.entry_date == data.entry_date
        assert retrieved.user_id == user_id


# ---------------------------------------------------------------------------
# Property 2: Date range filtering correctness
# ---------------------------------------------------------------------------


class TestProperty2DateRangeFiltering:
    """Property 2: Date range filtering correctness.

    For any date range query, all returned records SHALL have their date
    within the specified range, and no records outside the range SHALL
    be returned.

    **Validates: Requirements 3.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        dates=st.lists(
            _entry_dates,
            min_size=3,
            max_size=10,
        ),
        range_dates=st.tuples(_entry_dates, _entry_dates).map(
            lambda t: (min(t), max(t))
        ),
    )
    async def test_date_range_returns_only_matching_entries(
        self,
        dates: list[date],
        range_dates: tuple[date, date],
        db_session,
    ):
        """Entries outside the queried date range must not appear in results.

        **Validates: Requirements 3.2**
        """
        user_id = uuid.uuid4()
        service = NutritionService(db_session)
        start_date, end_date = range_dates

        # Create entries across various dates
        for d in dates:
            entry_data = NutritionEntryCreate(
                meal_name="Test Meal",
                calories=200.0,
                protein_g=20.0,
                carbs_g=30.0,
                fat_g=10.0,
                entry_date=d,
            )
            await service.create_entry(user_id=user_id, data=entry_data)

        await db_session.commit()

        # Query with date range filter
        filters = DateRangeFilter(start_date=start_date, end_date=end_date)
        result = await service.get_entries(
            user_id=user_id,
            filters=filters,
            pagination=PaginationParams(page=1, limit=100),
        )

        # All returned entries must be within range
        for entry in result.items:
            assert start_date <= entry.entry_date <= end_date, (
                f"Entry date {entry.entry_date} outside range "
                f"[{start_date}, {end_date}]"
            )

        # Count expected entries
        expected_count = sum(1 for d in dates if start_date <= d <= end_date)
        assert result.total_count == expected_count, (
            f"Expected {expected_count} entries in range, got {result.total_count}"
        )


# ---------------------------------------------------------------------------
# Property 3: Soft deletion preserves records
# ---------------------------------------------------------------------------


class TestProperty3SoftDeletion:
    """Property 3: Soft deletion preserves records.

    For any soft-deleted entry, the record SHALL still exist in the
    database with a non-null deleted_at timestamp, and SHALL NOT appear
    in standard list queries.

    **Validates: Requirements 3.4**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        entries_data=st.lists(
            _nutrition_entry_create,
            min_size=2,
            max_size=6,
        ),
        data=st.data(),
    )
    async def test_soft_deleted_entries_hidden_but_preserved(
        self,
        entries_data: list[NutritionEntryCreate],
        data,
        db_session,
    ):
        """Soft-deleted entries must not appear in list queries but remain in DB.

        **Validates: Requirements 3.4**
        """
        user_id = uuid.uuid4()
        service = NutritionService(db_session)

        # Create all entries
        created_ids = []
        for entry_data in entries_data:
            entry = await service.create_entry(user_id=user_id, data=entry_data)
            created_ids.append(entry.id)

        await db_session.commit()

        # Pick a random subset to delete (at least 1)
        num_to_delete = data.draw(
            st.integers(min_value=1, max_value=len(created_ids))
        )
        ids_to_delete = data.draw(
            st.sampled_from(
                [
                    combo
                    for combo in _combinations(created_ids, num_to_delete)
                ]
            )
        )

        for entry_id in ids_to_delete:
            await service.soft_delete_entry(user_id=user_id, entry_id=entry_id)

        await db_session.commit()

        # Verify deleted entries don't appear in list queries
        result = await service.get_entries(
            user_id=user_id,
            pagination=PaginationParams(page=1, limit=100),
        )
        returned_ids = {e.id for e in result.items}
        for deleted_id in ids_to_delete:
            assert deleted_id not in returned_ids, (
                f"Soft-deleted entry {deleted_id} should not appear in list"
            )

        # Verify deleted entries still exist in DB with deleted_at set
        for deleted_id in ids_to_delete:
            stmt = select(NutritionEntry).where(NutritionEntry.id == deleted_id)
            row = (await db_session.execute(stmt)).scalar_one_or_none()
            assert row is not None, f"Entry {deleted_id} should still exist in DB"
            assert row.deleted_at is not None, (
                f"Entry {deleted_id} should have deleted_at set"
            )

        # Verify non-deleted entries still appear
        expected_visible = len(created_ids) - len(ids_to_delete)
        assert result.total_count == expected_visible


def _combinations(items: list, r: int) -> list[list]:
    """Generate all combinations of r items from the list."""
    from itertools import combinations
    return [list(c) for c in combinations(items, r)]
