"""Phase 2.3–2.4: Duplicate prevention, copy idempotency, meal plan variety (5 tests).

Validates: duplicate exercise notes, duplicate favorite prevention,
copy entries idempotency, day variety, and intra-day variety.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.meals.schemas import MealFavoriteCreate
from src.modules.meals.service import MealService
from src.modules.meal_plans.generator import (
    FoodCandidate,
    MacroSummary,
    generate_plan,
)
from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.schemas import NutritionEntryCreate
from src.modules.nutrition.service import NutritionService
from src.modules.training.schemas import ExerciseEntry, SetEntry, TrainingSessionCreate
from src.modules.training.service import TrainingService
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"di-{uuid.uuid4().hex[:8]}@test.com",
        auth_provider="email",
        auth_provider_id="",
        role="user",
        hashed_password="fakehash",
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# 2.3 Duplicate Data Tests
# ---------------------------------------------------------------------------


class TestDuplicateDataIntegrity:

    @pytest.mark.asyncio
    async def test_duplicate_exercise_notes_preserved(self, db_session: AsyncSession):
        """Workout with 2× Squat, each with different notes, preserves both."""
        user = await _create_user(db_session)
        svc = TrainingService(db_session)

        resp = await svc.create_session(
            user.id,
            TrainingSessionCreate(
                session_date=date.today(),
                exercises=[
                    ExerciseEntry(exercise_name="Squat", sets=[
                        SetEntry(reps=5, weight_kg=100.0),
                    ]),
                    ExerciseEntry(exercise_name="Squat", sets=[
                        SetEntry(reps=8, weight_kg=80.0),
                    ]),
                ],
                metadata={"exercise_notes": {"Squat_0": "Felt strong", "Squat_1": "Back-off set"}},
            ),
        )
        await db_session.commit()

        assert resp.metadata is not None
        notes = resp.metadata.get("exercise_notes", {})
        assert notes.get("Squat_0") == "Felt strong"
        assert notes.get("Squat_1") == "Back-off set"

    @pytest.mark.asyncio
    async def test_duplicate_meal_favorites_prevented(self, db_session: AsyncSession):
        """Adding the same food_item_id as favorite twice creates only one record."""
        user = await _create_user(db_session)
        svc = MealService(db_session)
        food_id = uuid.uuid4()

        fav_data = MealFavoriteCreate(
            food_item_id=food_id,
            name="Chicken Breast",
            calories=165.0,
            protein_g=31.0,
            carbs_g=0.0,
            fat_g=3.6,
        )

        fav1 = await svc.add_favorite(user.id, fav_data)
        fav2 = await svc.add_favorite(user.id, fav_data)
        await db_session.commit()

        # Should return the same record
        assert fav1.id == fav2.id

        # Verify only one exists
        result = await svc.get_favorites(user.id, PaginationParams(page=1, limit=100))
        matching = [f for f in result.items if f.food_item_id == food_id]
        assert len(matching) == 1

    @pytest.mark.asyncio
    async def test_copy_entries_idempotency(self, db_session: AsyncSession):
        """Copying meals from date A to B twice doesn't duplicate entries."""
        user = await _create_user(db_session)
        svc = NutritionService(db_session)
        source = date(2024, 3, 1)
        target = date(2024, 3, 2)

        # Create source entries
        for name in ("Breakfast", "Lunch"):
            entry = NutritionEntry(
                user_id=user.id,
                meal_name=name,
                calories=400.0,
                protein_g=30.0,
                carbs_g=40.0,
                fat_g=15.0,
                entry_date=source,
            )
            db_session.add(entry)
        await db_session.flush()

        # Copy once
        first_copy = await svc.copy_entries_from_date(user.id, source, target)
        await db_session.commit()
        assert len(first_copy) == 2

        # Copy again — should be idempotent (no new entries)
        second_copy = await svc.copy_entries_from_date(user.id, source, target)
        await db_session.commit()
        assert len(second_copy) == 0

        # Verify total on target date is still 2
        from src.modules.nutrition.schemas import DateRangeFilter
        result = await svc.get_entries(
            user.id,
            filters=DateRangeFilter(start_date=target, end_date=target),
            pagination=PaginationParams(page=1, limit=100),
        )
        assert result.total_count == 2


# ---------------------------------------------------------------------------
# 2.4 Meal Plan Variety Tests
# ---------------------------------------------------------------------------


def _make_candidates(n: int = 8) -> list[FoodCandidate]:
    """Create distinct food candidates for plan generation."""
    foods = [
        ("Oatmeal", 300, 10, 50, 5),
        ("Chicken Rice", 500, 40, 55, 10),
        ("Salmon Bowl", 550, 35, 45, 20),
        ("Protein Shake", 250, 40, 15, 5),
        ("Pasta Bolognese", 600, 30, 70, 15),
        ("Greek Yogurt", 200, 20, 10, 8),
        ("Steak Dinner", 650, 50, 30, 25),
        ("Veggie Wrap", 350, 15, 45, 12),
    ]
    return [
        FoodCandidate(
            food_item_id=uuid.uuid4(),
            name=name,
            calories=cal,
            protein_g=p,
            carbs_g=c,
            fat_g=f,
            is_recipe=False,
            source_priority=2,
        )
        for name, cal, p, c, f in foods[:n]
    ]


class TestMealPlanVariety:

    def test_meal_plan_day_variety(self):
        """5-day plan has different food assignments across consecutive days."""
        targets = MacroSummary(calories=2000, protein_g=150, carbs_g=200, fat_g=70)
        candidates = _make_candidates(8)

        plan = generate_plan(targets, candidates, num_days=5)

        assert len(plan.days) == 5

        # Compare food_item_ids across consecutive days
        day_food_sets = []
        for day in plan.days:
            ids = frozenset(a.food_item_id for a in day.assignments)
            day_food_sets.append(ids)

        # At least some consecutive days should differ (rotation logic)
        differences = sum(
            1 for i in range(len(day_food_sets) - 1)
            if day_food_sets[i] != day_food_sets[i + 1]
        )
        assert differences >= 1, "Consecutive days should have some variety"

    def test_meal_plan_intra_day_variety(self):
        """Single day with 4 slots assigns different foods to each slot."""
        targets = MacroSummary(calories=2000, protein_g=150, carbs_g=200, fat_g=70)
        candidates = _make_candidates(8)

        plan = generate_plan(targets, candidates, num_days=1)

        assert len(plan.days) == 1
        day = plan.days[0]

        # Each slot should get a different food
        assigned_ids = [a.food_item_id for a in day.assignments]
        assert len(assigned_ids) == len(set(assigned_ids)), (
            "Each meal slot should have a unique food item"
        )

        # Verify slots are distinct (breakfast ≠ lunch ≠ dinner ≠ snack)
        slot_names = [a.slot for a in day.assignments]
        assert len(set(slot_names)) == len(slot_names)
