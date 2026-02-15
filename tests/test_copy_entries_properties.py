"""
Property tests for the copy entries endpoint.

Feature: macrofactor-parity, Property 12
Validates: Requirements 6.1, 6.3
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.service import NutritionService
from src.modules.nutrition.schemas import DateRangeFilter
from src.shared.pagination import PaginationParams


@pytest.fixture
def nutrition_service(db_session: AsyncSession) -> NutritionService:
    return NutritionService(db_session)


async def _create_entry(
    session: AsyncSession,
    user_id: uuid.UUID,
    entry_date: date,
    meal_name: str = "Test meal",
    calories: float = 500.0,
    protein_g: float = 30.0,
    carbs_g: float = 50.0,
    fat_g: float = 20.0,
    micro_nutrients: dict | None = None,
) -> NutritionEntry:
    entry = NutritionEntry(
        user_id=user_id,
        meal_name=meal_name,
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        micro_nutrients=micro_nutrients,
        entry_date=entry_date,
    )
    session.add(entry)
    await session.flush()
    return entry


class TestProperty12CopiedEntriesPreserveData:
    """
    Property 12: Copied entries preserve nutritional data with new identity.

    **Validates: Requirements 6.1, 6.3**
    """

    @pytest.mark.asyncio
    async def test_copied_entries_have_new_ids(
        self, db_session: AsyncSession, nutrition_service: NutritionService
    ):
        """Each copied entry has a unique ID different from the source."""
        user_id = uuid.uuid4()
        source_date = date(2024, 1, 15)
        target_date = date(2024, 1, 16)

        source = await _create_entry(db_session, user_id, source_date, "Breakfast bowl")
        copied = await nutrition_service.copy_entries_from_date(
            user_id, source_date, target_date
        )

        assert len(copied) == 1
        assert copied[0].id != source.id

    @pytest.mark.asyncio
    async def test_copied_entries_have_target_date(
        self, db_session: AsyncSession, nutrition_service: NutritionService
    ):
        """Each copied entry has entry_date equal to the target date."""
        user_id = uuid.uuid4()
        source_date = date(2024, 1, 15)
        target_date = date(2024, 1, 20)

        await _create_entry(db_session, user_id, source_date)
        await _create_entry(db_session, user_id, source_date, "Lunch")

        copied = await nutrition_service.copy_entries_from_date(
            user_id, source_date, target_date
        )

        assert len(copied) == 2
        for entry in copied:
            assert entry.entry_date == target_date

    @pytest.mark.asyncio
    async def test_copied_entries_preserve_nutritional_data(
        self, db_session: AsyncSession, nutrition_service: NutritionService
    ):
        """Copied entries have identical macros and micro_nutrients to source."""
        user_id = uuid.uuid4()
        source_date = date(2024, 1, 15)
        target_date = date(2024, 1, 16)

        micro = {"water_ml": 500.0, "fibre_g": 12.0}
        source = await _create_entry(
            db_session,
            user_id,
            source_date,
            meal_name="Dinner plate",
            calories=750.0,
            protein_g=45.0,
            carbs_g=80.0,
            fat_g=25.0,
            micro_nutrients=micro,
        )

        copied = await nutrition_service.copy_entries_from_date(
            user_id, source_date, target_date
        )

        assert len(copied) == 1
        c = copied[0]
        assert c.meal_name == source.meal_name
        assert c.calories == source.calories
        assert c.protein_g == source.protein_g
        assert c.carbs_g == source.carbs_g
        assert c.fat_g == source.fat_g
        assert c.micro_nutrients == source.micro_nutrients

    @pytest.mark.asyncio
    async def test_copied_count_equals_source_count(
        self, db_session: AsyncSession, nutrition_service: NutritionService
    ):
        """Number of copied entries equals number of source entries."""
        user_id = uuid.uuid4()
        source_date = date(2024, 1, 15)
        target_date = date(2024, 1, 16)

        # Create 5 entries
        for i in range(5):
            await _create_entry(
                db_session, user_id, source_date, f"Meal {i}", calories=100.0 * (i + 1)
            )

        copied = await nutrition_service.copy_entries_from_date(
            user_id, source_date, target_date
        )

        assert len(copied) == 5

    @pytest.mark.asyncio
    async def test_copy_from_empty_date_returns_empty(
        self, db_session: AsyncSession, nutrition_service: NutritionService
    ):
        """Copying from a date with no entries returns an empty list."""
        user_id = uuid.uuid4()
        source_date = date(2024, 1, 15)
        target_date = date(2024, 1, 16)

        copied = await nutrition_service.copy_entries_from_date(
            user_id, source_date, target_date
        )

        assert copied == []

    @pytest.mark.asyncio
    async def test_copy_does_not_include_deleted_entries(
        self, db_session: AsyncSession, nutrition_service: NutritionService
    ):
        """Soft-deleted entries are not copied."""
        user_id = uuid.uuid4()
        source_date = date(2024, 1, 15)
        target_date = date(2024, 1, 16)

        await _create_entry(db_session, user_id, source_date, "Active meal")
        deleted = await _create_entry(db_session, user_id, source_date, "Deleted meal")
        await nutrition_service.soft_delete_entry(user_id, deleted.id)

        copied = await nutrition_service.copy_entries_from_date(
            user_id, source_date, target_date
        )

        assert len(copied) == 1
        assert copied[0].meal_name == "Active meal"


class TestCopyEntriesSchemaValidation:
    """Test that same source/target date is rejected."""

    def test_same_date_raises_validation_error(self):
        from pydantic import ValidationError
        from src.modules.nutrition.schemas import CopyEntriesRequest

        with pytest.raises(ValidationError, match="source_date and target_date must be different"):
            CopyEntriesRequest(
                source_date=date(2024, 1, 15),
                target_date=date(2024, 1, 15),
            )

    def test_different_dates_pass_validation(self):
        from src.modules.nutrition.schemas import CopyEntriesRequest

        req = CopyEntriesRequest(
            source_date=date(2024, 1, 15),
            target_date=date(2024, 1, 16),
        )
        assert req.source_date == date(2024, 1, 15)
        assert req.target_date == date(2024, 1, 16)
