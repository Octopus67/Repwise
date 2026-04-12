"""Tests for nutrition bug fixes."""

import pytest
from datetime import date
from src.shared.pagination import PaginationParams
from src.modules.nutrition.schemas import NutritionEntryCreate, NutritionEntryUpdate


def test_pagination_limit_100_accepted():
    """Test that PaginationParams accepts limit=100."""
    params = PaginationParams(page=1, limit=100)
    assert params.limit == 100


def test_pagination_limit_101_rejected():
    """Test that PaginationParams rejects limit=101."""
    with pytest.raises(ValueError):
        PaginationParams(page=1, limit=101)


def test_create_entry_macro_mismatch_logs_warning(caplog):
    """Test that NutritionEntryCreate with mismatched macros logs warning but is accepted."""
    # Create entry with severely mismatched macros (declared 100 kcal, computed 400 kcal)
    entry = NutritionEntryCreate(
        meal_name="Test meal",
        calories=100,  # declared
        protein_g=25,  # 25*4 = 100 kcal
        carbs_g=25,  # 25*4 = 100 kcal
        fat_g=22,  # 22*9 = 198 kcal
        entry_date=date.today(),
        # Total computed: 100+100+198 = 398 kcal vs declared 100 kcal (ratio = 3.98)
    )

    # Entry should be created successfully (not rejected)
    assert entry.calories == 100
    assert entry.protein_g == 25

    # Warning should be logged
    assert "Macro-calorie mismatch" in caplog.text


def test_update_entry_rejects_negative_micro():
    """Test that NutritionEntryUpdate with negative micro_nutrients raises ValueError."""
    with pytest.raises(ValueError, match="micro_nutrient value must be >= 0"):
        NutritionEntryUpdate(micro_nutrients={"vitamin_c_mg": -10})


@pytest.mark.asyncio
async def test_copy_preserves_source_meal_id(db_session):
    """Test that copy_entries_from_date preserves source_meal_id."""
    from src.modules.nutrition.service import NutritionService
    from src.modules.auth.models import User
    import uuid

    # Create test user
    test_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        hashed_password="x",
        auth_provider="email",
        role="user",
    )
    db_session.add(test_user)
    await db_session.flush()

    service = NutritionService(db_session)
    source_meal_id = uuid.uuid4()

    # Create original entry with source_meal_id
    original_data = NutritionEntryCreate(
        meal_name="Original meal",
        calories=500,
        protein_g=25,
        carbs_g=50,
        fat_g=20,
        entry_date=date(2024, 1, 1),
        source_meal_id=source_meal_id,
    )

    original_entry = await service.create_entry(test_user.id, original_data)
    await db_session.flush()

    # Copy entries to new date
    copied_entries = await service.copy_entries_from_date(
        user_id=test_user.id, source_date=date(2024, 1, 1), target_date=date(2024, 1, 2)
    )

    # Verify source_meal_id was preserved
    assert len(copied_entries) == 1
    assert copied_entries[0].source_meal_id == source_meal_id


@pytest.mark.asyncio
async def test_start_date_only_returns_entries_through_today(db_session):
    """Test that start_date only returns entries from start_date through today."""
    from src.modules.nutrition.service import NutritionService
    from src.modules.nutrition.schemas import DateRangeFilter
    from src.modules.auth.models import User
    from datetime import timedelta
    import uuid

    # Create test user
    test_user = User(
        id=uuid.uuid4(),
        email="test2@example.com",
        hashed_password="x",
        auth_provider="email",
        role="user",
    )
    db_session.add(test_user)
    await db_session.flush()

    service = NutritionService(db_session)
    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    # Create entries on different dates
    for test_date in [yesterday, today, tomorrow]:
        entry_data = NutritionEntryCreate(
            meal_name=f"Meal {test_date}",
            calories=100,
            protein_g=10,
            carbs_g=10,
            fat_g=5,
            entry_date=test_date,
        )
        await service.create_entry(test_user.id, entry_data)

    await db_session.flush()

    # Query with start_date only (should include yesterday through today, not tomorrow)
    filters = DateRangeFilter(start_date=yesterday, end_date=today)
    result = await service.get_entries(
        user_id=test_user.id, filters=filters, pagination=PaginationParams(page=1, limit=10)
    )

    # Should return 2 entries (yesterday and today, not tomorrow)
    assert len(result.items) == 2
    entry_dates = {entry.entry_date for entry in result.items}
    assert yesterday in entry_dates
    assert today in entry_dates
    assert tomorrow not in entry_dates
