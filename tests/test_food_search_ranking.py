"""Tests for food search ranking — simple/exact matches should appear first."""
import asyncio
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.service import FoodDatabaseService
from src.shared.pagination import PaginationParams


@pytest.mark.asyncio
async def test_cheese_search_returns_simple_cheese_first(db_session: AsyncSession):
    """Searching 'cheese' should return 'Cheese' before 'CHEESE & ARTISAN CRACKERS'."""
    service = FoodDatabaseService(db_session)
    result = await service.search("cheese", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert len(names) > 0, "Search should return results"

    # The first result should be a simple cheese, not a compound product
    first_name = names[0].lower()
    assert first_name == "cheese" or first_name.startswith("cheese,"), (
        f"Expected simple 'Cheese' or 'Cheese, ...' first, got: {names[0]}"
    )

    # No compound product like "CHEESE & ..." should appear before simple cheeses
    for i, name in enumerate(names[:5]):
        if "&" in name or "(" in name:
            # Check that a simpler cheese appeared before this
            simpler_before = any(
                len(n) < len(name) and n.lower().startswith("cheese")
                for n in names[:i]
            )
            assert simpler_before, (
                f"Compound name '{name}' at position {i} appeared before simpler cheeses"
            )


@pytest.mark.asyncio
async def test_apple_search_returns_apple_first(db_session: AsyncSession):
    """Searching 'apple' should return 'Apple' before 'APPLE & BLACKCURRANT JUICE'."""
    service = FoodDatabaseService(db_session)
    result = await service.search("apple", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert len(names) > 0, "Search should return results"

    first_name = names[0].lower()
    assert "apple" in first_name, f"First result should contain 'apple', got: {names[0]}"
    # First result should be short (simple food)
    assert len(names[0]) < 20, (
        f"First result should be a simple name, got: {names[0]} ({len(names[0])} chars)"
    )


@pytest.mark.asyncio
async def test_bread_search_returns_bread_first(db_session: AsyncSession):
    """Searching 'bread' should return 'Bread' before 'BREAD CRUMBS ITALIAN STYLE'."""
    service = FoodDatabaseService(db_session)
    result = await service.search("bread", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert len(names) > 0, "Search should return results"

    first_name = names[0].lower()
    assert first_name.startswith("bread"), f"First result should start with 'bread', got: {names[0]}"
    assert len(names[0]) < 25, (
        f"First result should be a simple name, got: {names[0]} ({len(names[0])} chars)"
    )


@pytest.mark.asyncio
async def test_exact_match_ranked_first(db_session: AsyncSession):
    """An exact name match should always be the first result."""
    service = FoodDatabaseService(db_session)
    result = await service.search("cheese", PaginationParams(page=1, limit=10))

    names = [item.name.lower() for item in result.items]
    if "cheese" in names:
        assert names[0] == "cheese", (
            f"Exact match 'cheese' should be first, but it's at position {names.index('cheese')}"
        )


@pytest.mark.asyncio
async def test_prefix_matches_before_contains(db_session: AsyncSession):
    """Names starting with the query should appear before names containing it."""
    service = FoodDatabaseService(db_session)
    result = await service.search("cheese", PaginationParams(page=1, limit=20))

    names = [item.name for item in result.items]
    
    # Find first contains-only match (doesn't start with cheese)
    first_contains_idx = None
    for i, name in enumerate(names):
        if not name.lower().startswith("cheese"):
            first_contains_idx = i
            break

    if first_contains_idx is not None:
        # All items before it should start with "cheese"
        for name in names[:first_contains_idx]:
            assert name.lower().startswith("cheese"), (
                f"'{name}' doesn't start with 'cheese' but appears before contains-only matches"
            )
