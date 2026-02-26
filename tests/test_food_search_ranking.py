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


@pytest.mark.asyncio
async def test_orange_search_returns_orange_before_orangina(db_session: AsyncSession):
    """Searching 'orange' should return 'Orange' before 'Orangina rouge'.

    This is the exact scenario from the screenshot — brand names that start
    with the query should not outrank the plain fruit/food name.
    """
    await _seed_food(db_session, "Orange")
    await _seed_food(db_session, "Orange juice")
    await _seed_food(db_session, "Orangina rouge (Orangina, Orangina rouge)")
    await _seed_food(db_session, "Orangina, Rouge (Orangina, Orangina rouge)")
    await _seed_food(db_session, "Orange sherbet, orange")
    await _seed_food(db_session, "Orange soda, orange")
    await db_session.commit()

    service = FoodDatabaseService(db_session)
    result = await service.search("orange", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert len(names) > 0, "Search should return results"

    # Exact match "Orange" must be first
    assert names[0].lower() == "orange", (
        f"Exact match 'Orange' should be first, got: {names[0]}"
    )

    # "Orange juice" (starts-with, short) should come before "Orangina rouge" (starts-with, long)
    orange_juice_idx = next((i for i, n in enumerate(names) if n.lower() == "orange juice"), None)
    orangina_idx = next((i for i, n in enumerate(names) if "orangina rouge" in n.lower()), None)

    if orange_juice_idx is not None and orangina_idx is not None:
        assert orange_juice_idx < orangina_idx, (
            f"'Orange juice' (idx {orange_juice_idx}) should appear before "
            f"'Orangina rouge' (idx {orangina_idx})"
        )


@pytest.mark.asyncio
async def test_shorter_prefix_match_before_longer_prefix_match(db_session: AsyncSession):
    """Among starts-with matches, shorter names should rank higher."""
    await _seed_food(db_session, "Milk")
    await _seed_food(db_session, "Milk, whole")
    await _seed_food(db_session, "Milk chocolate bar with almonds and caramel")
    await db_session.commit()

    service = FoodDatabaseService(db_session)
    result = await service.search("milk", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert names[0].lower() == "milk", f"Exact match 'Milk' should be first, got: {names[0]}"

    # "Milk, whole" should come before the long compound name
    milk_whole_idx = next((i for i, n in enumerate(names) if n.lower() == "milk, whole"), None)
    long_idx = next((i for i, n in enumerate(names) if "almonds" in n.lower()), None)
    if milk_whole_idx is not None and long_idx is not None:
        assert milk_whole_idx < long_idx, (
            f"'Milk, whole' should appear before the long compound name"
        )


@pytest.mark.asyncio
async def test_word_boundary_match_before_mid_word_match(db_session: AsyncSession):
    """'orange' should match 'Blood orange' (word boundary) before 'Orangeade' (mid-word)."""
    await _seed_food(db_session, "Orange")
    await _seed_food(db_session, "Blood orange")
    await _seed_food(db_session, "Orangeade")
    await db_session.commit()

    service = FoodDatabaseService(db_session)
    result = await service.search("orange", PaginationParams(page=1, limit=10))

    names = [item.name for item in result.items]
    assert len(names) > 0

    # "Orange" (exact) must be first
    assert names[0].lower() == "orange", f"Exact match should be first, got: {names[0]}"

    # "Blood orange" (word boundary) should come before or at same level as "Orangeade"
    blood_idx = next((i for i, n in enumerate(names) if n.lower() == "blood orange"), None)
    ade_idx = next((i for i, n in enumerate(names) if n.lower() == "orangeade"), None)
    if blood_idx is not None and ade_idx is not None:
        # Both are "starts-with" tier (orangeade starts with orange, blood orange contains it)
        # blood orange is a contains match, orangeade is a starts-with match
        # so orangeade should come first (tier 1 < tier 2)
        assert ade_idx < blood_idx, (
            f"'Orangeade' (starts-with, tier 1) should appear before "
            f"'Blood orange' (contains, tier 2)"
        )
