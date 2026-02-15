"""Property-based tests for micronutrient persistence round-trip (Property 8).

Feature: app-fixes-and-nutrition-v2
Validates: Requirements 5.8
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.nutrition.schemas import NutritionEntryCreate
from src.modules.nutrition.service import NutritionService


# ---------------------------------------------------------------------------
# Constants — micronutrient keys matching frontend MICRO_FIELDS + fibre + water
# ---------------------------------------------------------------------------

MICRO_KEYS = [
    "vitamin_a_mcg",
    "vitamin_c_mg",
    "vitamin_d_mcg",
    "calcium_mg",
    "iron_mg",
    "zinc_mg",
    "magnesium_mg",
    "potassium_mg",
    "fibre_g",
    "water_ml",
]


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_micro_values = st.floats(
    min_value=0.01, max_value=5000.0, allow_nan=False, allow_infinity=False
)

_micro_nutrients_dict = st.dictionaries(
    keys=st.sampled_from(MICRO_KEYS),
    values=_micro_values,
    min_size=1,
    max_size=len(MICRO_KEYS),
)

_meal_names = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"),
        min_codepoint=32,
        max_codepoint=127,
    ),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_positive_floats = st.floats(
    min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False
)


# ---------------------------------------------------------------------------
# Shared settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_test_user(db: AsyncSession) -> User:
    """Create a minimal user for testing."""
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        auth_provider="email",
        auth_provider_id="",
        role="user",
        hashed_password="fakehash",
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# Property 8: Micronutrient persistence round-trip
# ---------------------------------------------------------------------------


class TestProperty8MicronutrientPersistenceRoundTrip:
    """Property 8: Micronutrient persistence round-trip.

    For any valid micro_nutrients dictionary, creating a nutrition entry
    with that dictionary and then retrieving it returns an equivalent
    dictionary with the same keys and values.

    **Validates: Requirements 5.8**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        micro=_micro_nutrients_dict,
        meal_name=_meal_names,
        cals=_positive_floats,
        protein=_positive_floats,
        carbs=_positive_floats,
        fat=_positive_floats,
    )
    async def test_micro_nutrients_round_trip(
        self,
        micro: dict[str, float],
        meal_name: str,
        cals: float,
        protein: float,
        carbs: float,
        fat: float,
        db_session: AsyncSession,
    ):
        """Creating an entry with micro_nutrients and retrieving it preserves all keys and values.

        **Validates: Requirements 5.8**
        """
        user = await _create_test_user(db_session)
        service = NutritionService(db_session)

        entry_data = NutritionEntryCreate(
            meal_name=meal_name,
            calories=cals,
            protein_g=protein,
            carbs_g=carbs,
            fat_g=fat,
            micro_nutrients=micro,
            entry_date=date.today(),
        )

        created = await service.create_entry(user.id, entry_data)
        await db_session.flush()

        # Refresh from DB to ensure we read persisted data
        await db_session.refresh(created)

        assert created.micro_nutrients is not None, "micro_nutrients should be persisted"
        assert set(created.micro_nutrients.keys()) == set(micro.keys()), (
            f"Keys mismatch: expected {set(micro.keys())}, got {set(created.micro_nutrients.keys())}"
        )

        for key, expected_val in micro.items():
            actual_val = created.micro_nutrients[key]
            assert abs(actual_val - expected_val) < 1e-6, (
                f"Value mismatch for {key}: expected {expected_val}, got {actual_val}"
            )
