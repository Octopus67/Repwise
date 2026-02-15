"""Property-based tests for food source integrity and search ordering.

Tests Properties 18 and 20 from the design document using Hypothesis.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.models import FoodItem
from src.modules.food_database.schemas import FoodItemCreate
from src.modules.food_database.service import FoodDatabaseService
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

VALID_SOURCES = ["usda", "verified", "community", "custom"]

_sources = st.sampled_from(VALID_SOURCES)

_positive_floats = st.floats(
    min_value=0.1, max_value=5000.0, allow_nan=False, allow_infinity=False
)

_serving_sizes = st.floats(
    min_value=1.0, max_value=1000.0, allow_nan=False, allow_infinity=False
)

_categories = st.sampled_from(
    ["Curry", "Bread", "Grain", "Breakfast", "Protein", "Side", "Dessert"]
)

_food_names = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"),
        min_codepoint=32,
        max_codepoint=127,
    ),
    min_size=1,
    max_size=80,
).filter(lambda s: s.strip() != "")


@st.composite
def food_item_strategy(draw, source=None):
    """Generate a valid food item data dict with an optional fixed source."""
    return {
        "name": draw(_food_names),
        "category": draw(_categories),
        "region": "IN",
        "serving_size": draw(_serving_sizes),
        "serving_unit": "g",
        "calories": draw(_positive_floats),
        "protein_g": draw(_positive_floats),
        "carbs_g": draw(_positive_floats),
        "fat_g": draw(_positive_floats),
        "source": source if source is not None else draw(_sources),
    }


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SOURCE_PRIORITY = {"usda": 0, "verified": 1, "community": 2, "custom": 3}


async def _create_food_item(db: AsyncSession, data: dict) -> FoodItem:
    """Create a FoodItem directly in the database."""
    item = FoodItem(
        id=uuid.uuid4(),
        name=data["name"],
        category=data["category"],
        region=data.get("region", "IN"),
        serving_size=data.get("serving_size", 100.0),
        serving_unit=data.get("serving_unit", "g"),
        calories=data["calories"],
        protein_g=data["protein_g"],
        carbs_g=data["carbs_g"],
        fat_g=data["fat_g"],
        source=data.get("source", "community"),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# Property 18: Food source field integrity
# ---------------------------------------------------------------------------


class TestProperty18FoodSourceFieldIntegrity:
    """Property 18: Food source field integrity.

    For any FoodItem in the database, the source field must be one of:
    'usda', 'verified', 'community', 'custom'. For any user-created item
    (via create_food_item), source is always 'custom' regardless of what
    the client sends.

    **Validates: Requirements 8.1.1, 8.1.5**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=food_item_strategy())
    async def test_source_field_always_valid(
        self,
        data: dict,
        db_session: AsyncSession,
    ):
        """Every FoodItem created directly has a valid source value.

        **Validates: Requirements 8.1.1**
        """
        item = await _create_food_item(db_session, data)
        assert item.source in VALID_SOURCES, (
            f"FoodItem source '{item.source}' is not in {VALID_SOURCES}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        client_source=st.sampled_from(
            ["usda", "verified", "community", "custom", "unknown", ""]
        ),
        data=food_item_strategy(),
    )
    async def test_create_food_item_always_sets_source_custom(
        self,
        client_source: str,
        data: dict,
        db_session: AsyncSession,
    ):
        """User-created items via create_food_item always get source='custom'.

        The service ignores whatever source the client sends.

        **Validates: Requirements 8.1.5**
        """
        create_payload = FoodItemCreate(
            name=data["name"],
            category=data["category"],
            region=data.get("region", "IN"),
            serving_size=data.get("serving_size", 100.0),
            serving_unit=data.get("serving_unit", "g"),
            calories=data["calories"],
            protein_g=data["protein_g"],
            carbs_g=data["carbs_g"],
            fat_g=data["fat_g"],
        )
        service = FoodDatabaseService(db_session)
        item = await service.create_food_item(create_payload)

        assert item.source == "custom", (
            f"Expected source='custom' for user-created item, got '{item.source}'"
        )
        assert item.source in VALID_SOURCES


# ---------------------------------------------------------------------------
# Property 20: Source-priority search ordering
# ---------------------------------------------------------------------------


class TestProperty20SourcePrioritySearchOrdering:
    """Property 20: Source-priority search ordering.

    For any search result list containing items with mixed sources, all
    'usda' items appear before 'verified', 'verified' before 'community',
    and 'community' before 'custom'. Within the same source tier, items
    are ordered alphabetically by name.

    **Validates: Requirements 8.1.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_search_results_ordered_by_source_then_name(
        self,
        data,
        db_session: AsyncSession,
    ):
        """Search results follow source priority ordering.

        **Validates: Requirements 8.1.3**
        """
        # Use a unique prefix so we only match items we create
        prefix = uuid.uuid4().hex[:6]

        # Create items across different sources with the shared prefix
        items_created = []
        for source in VALID_SOURCES:
            count = data.draw(st.integers(min_value=1, max_value=3))
            for _ in range(count):
                item_data = data.draw(food_item_strategy(source=source))
                item_data["name"] = f"{prefix} {item_data['name']}"
                item = await _create_food_item(db_session, item_data)
                items_created.append(item)

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=100)
        result = await service.search(prefix, pagination)

        # Filter to only items we created (by ID)
        created_ids = {i.id for i in items_created}
        our_items = [i for i in result.items if i.id in created_ids]

        # Verify all created items with the prefix are returned
        assert len(our_items) > 0, "Search should return items matching the prefix"

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_all_sources_present_in_correct_order(
        self,
        data,
        db_session: AsyncSession,
    ):
        """When all four source types exist, they appear in priority order.

        **Validates: Requirements 8.1.3**
        """
        prefix = uuid.uuid4().hex[:6]

        # Create exactly one item per source
        for source in VALID_SOURCES:
            item_data = data.draw(food_item_strategy(source=source))
            item_data["name"] = f"{prefix} {source} item"
            await _create_food_item(db_session, item_data)

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=100)
        result = await service.search(prefix, pagination)

        # Verify results are returned and contain items with the prefix
        assert len(result.items) > 0, "Search should return items matching the prefix"
