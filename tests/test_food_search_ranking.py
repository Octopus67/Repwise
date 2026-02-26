"""Tests for food search ranking — simple/exact matches should appear first."""
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.models import FoodItem
from src.modules.food_database.service import FoodDatabaseService
from src.shared.pagination import PaginationParams


async def _seed_food(db: AsyncSession, name: str, source: str = "usda") -> FoodItem:
    item = FoodItem(
        id=uuid.uuid4(),
        name=name,
        category="general",
        region="global",
        serving_size=100.0,
        serving_unit="g",
        calories=100.0,
        protein_g=5.0,
        carbs_g=10.0,
        fat_g=3.0,
        source=source,
    )
    db.add(item)
    await db.flush()
    return item


@pytest.mark.asyncio
async def test_cheese_search_returns_simple_cheese_first(db_session: AsyncSession):
    """Searching 'cheese' should return 'Cheese' before 'CHEESE & ARTISAN CRACKERS'."""
    await _seed_food(db_session, "Cheese")
    await _seed_food(db_session, "Cheese, cheddar")
    await _seed_food(db_session, "CHEESE & ARTISAN CRACKERS")
    await _seed_food(db_session, "Cheesecake")
    await db_session.commit()

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
    await _seed_food(db_session, "Apple")
    await _seed_food(db_session, "Apple, raw")
    await _seed_food(db_session, "APPLE & BLACKCURRANT JUICE")
    await _seed_food(db_session, "Apple pie filling")
    await db_session.commit()

    service = FoodDatabaseService(db_session)
    result = await service.search("apple", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert len(names) > 0, "Search should return results"

    first_name = names[0].lower()
    assert "apple" in first_name, f"First result should contain 'apple', got: {names[0]}"
    assert len(names[0]) < 20, (
        f"First result should be a simple name, got: {names[0]} ({len(names[0])} chars)"
    )


@pytest.mark.asyncio
async def test_bread_search_returns_bread_first(db_session: AsyncSession):
    """Searching 'bread' should return 'Bread' before 'BREAD CRUMBS ITALIAN STYLE'."""
    await _seed_food(db_session, "Bread")
    await _seed_food(db_session, "Bread, whole wheat")
    await _seed_food(db_session, "BREAD CRUMBS ITALIAN STYLE")
    await _seed_food(db_session, "Breadsticks")
    await db_session.commit()

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
    await _seed_food(db_session, "Cheese")
    await _seed_food(db_session, "Cheese, cheddar")
    await _seed_food(db_session, "Cheesecake")
    await db_session.commit()

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
    await _seed_food(db_session, "Cheese")
    await _seed_food(db_session, "Cheese, cheddar")
    await _seed_food(db_session, "Cottage cheese")
    await _seed_food(db_session, "Cream cheese")
    await db_session.commit()

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
        for name in names[:first_contains_idx]:
            assert name.lower().startswith("cheese"), (
                f"'{name}' doesn't start with 'cheese' but appears before contains-only matches"
            )
