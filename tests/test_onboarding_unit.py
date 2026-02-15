"""Unit tests for the onboarding module — task 1.5.

Validates: Requirements 9.1, 9.2, 9.5, 9.6
"""

import pytest


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

VALID_ONBOARDING_PAYLOAD = {
    "goal_type": "cutting",
    "height_cm": 175.0,
    "weight_kg": 80.0,
    "body_fat_pct": 18.0,
    "age_years": 28,
    "sex": "male",
    "activity_level": "moderate",
    "goal_rate_per_week": -0.5,
    "display_name": "Test User",
}


async def _register_and_get_headers(client) -> dict[str, str]:
    """Register a new user and return auth headers."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "onboard@example.com", "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------
# 1. Happy path — valid onboarding input → 201
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_happy_path(client, override_get_db):
    """POST /onboarding/complete with valid data → 201, returns profile + goals + snapshot."""
    headers = await _register_and_get_headers(client)

    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=VALID_ONBOARDING_PAYLOAD,
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()

    # Response shape
    assert "profile" in body
    assert "goals" in body
    assert "snapshot" in body

    # Profile reflects display_name
    assert body["profile"]["display_name"] == "Test User"

    # Goals reflect submitted goal_type
    assert body["goals"]["goal_type"] == "cutting"
    assert body["goals"]["goal_rate_per_week"] == -0.5

    # Snapshot has caloric targets
    assert body["snapshot"]["target_calories"] > 0
    assert body["snapshot"]["target_protein_g"] > 0
    assert body["snapshot"]["target_carbs_g"] >= 0
    assert body["snapshot"]["target_fat_g"] > 0


# ------------------------------------------------------------------
# 2. Conflict — onboarding twice for same user → 409
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_conflict_on_second_call(client, override_get_db):
    """Calling onboarding twice for the same user → second returns 409."""
    headers = await _register_and_get_headers(client)

    first = await client.post(
        "/api/v1/onboarding/complete",
        json=VALID_ONBOARDING_PAYLOAD,
        headers=headers,
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/v1/onboarding/complete",
        json=VALID_ONBOARDING_PAYLOAD,
        headers=headers,
    )
    assert second.status_code == 409


# ------------------------------------------------------------------
# 3. Optional body_fat_pct — null value accepted
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_null_body_fat(client, override_get_db):
    """Onboarding with body_fat_pct=null succeeds."""
    headers = await _register_and_get_headers(client)

    payload = {**VALID_ONBOARDING_PAYLOAD, "body_fat_pct": None}
    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["snapshot"]["target_calories"] > 0


# ------------------------------------------------------------------
# 4. Invalid inputs — out-of-range values → 400 (custom validation handler)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_invalid_height(client, override_get_db):
    """Height of 50 (below min 100) → 400 validation error."""
    headers = await _register_and_get_headers(client)

    payload = {**VALID_ONBOARDING_PAYLOAD, "height_cm": 50}
    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_onboarding_invalid_weight(client, override_get_db):
    """Weight of 500 (above max 300) → 400 validation error."""
    headers = await _register_and_get_headers(client)

    payload = {**VALID_ONBOARDING_PAYLOAD, "weight_kg": 500}
    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_onboarding_invalid_age(client, override_get_db):
    """Age of 5 (below min 13) → 400 validation error."""
    headers = await _register_and_get_headers(client)

    payload = {**VALID_ONBOARDING_PAYLOAD, "age_years": 5}
    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 400


# ------------------------------------------------------------------
# 20.4 POST with full v2 payload → 201, all Food DNA fields stored
# ------------------------------------------------------------------

FOOD_DNA_FIELDS = {
    "dietary_restrictions": ["vegetarian", "dairy_free"],
    "allergies": ["nuts", "shellfish"],
    "cuisine_preferences": ["indian", "mediterranean"],
    "meal_frequency": 4,
    "diet_style": "high_protein",
    "protein_per_kg": 2.2,
    "exercise_types": ["strength", "cardio"],
    "exercise_sessions_per_week": 5,
}

V2_ONBOARDING_PAYLOAD = {**VALID_ONBOARDING_PAYLOAD, **FOOD_DNA_FIELDS}


async def _register_unique_user(client, email: str) -> dict[str, str]:
    """Register a user with a unique email and return auth headers."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_onboarding_v2_full_payload_stores_food_dna(client, override_get_db):
    """POST /onboarding/complete with ALL Food DNA fields → 201, fields stored in preferences."""
    headers = await _register_unique_user(client, "v2full@example.com")

    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=V2_ONBOARDING_PAYLOAD,
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()

    # Response shape
    assert "profile" in body
    assert "goals" in body
    assert "snapshot" in body

    # Profile preferences should contain all Food DNA fields
    prefs = body["profile"].get("preferences") or {}
    assert prefs.get("dietary_restrictions") == ["vegetarian", "dairy_free"]
    assert prefs.get("allergies") == ["nuts", "shellfish"]
    assert prefs.get("cuisine_preferences") == ["indian", "mediterranean"]
    assert prefs.get("meal_frequency") == 4
    assert prefs.get("diet_style") == "high_protein"
    assert prefs.get("protein_per_kg") == 2.2
    assert prefs.get("exercise_types") == ["strength", "cardio"]
    assert prefs.get("exercise_sessions_per_week") == 5

    # The onboarding response already proves preferences were stored and serialized.
    # (Round-trip GET /users/profile skipped: SQLite in-memory test sessions
    #  don't share uncommitted state across connections.)


# ------------------------------------------------------------------
# 20.5 POST with old v1 payload → 201, backward compat
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_v1_backward_compat(client, override_get_db):
    """POST /onboarding/complete with ONLY v1 fields → 201, no Food DNA in preferences."""
    headers = await _register_unique_user(client, "v1compat@example.com")

    resp = await client.post(
        "/api/v1/onboarding/complete",
        json=VALID_ONBOARDING_PAYLOAD,
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()

    assert "profile" in body
    assert "goals" in body
    assert "snapshot" in body

    # Goals should match v1 payload
    assert body["goals"]["goal_type"] == "cutting"
    assert body["goals"]["goal_rate_per_week"] == -0.5

    # Preferences should NOT contain any Food DNA keys
    prefs = body["profile"].get("preferences") or {}
    for key in FOOD_DNA_FIELDS:
        assert key not in prefs, f"v1 payload should not set Food DNA key '{key}'"


# ------------------------------------------------------------------
# 20.6 Food search personalization — _personalize_results unit tests
# ------------------------------------------------------------------

from types import SimpleNamespace
from src.modules.food_database.service import FoodDatabaseService


def _make_food(name: str, category: str = "grain", region: str = "global", source: str = "community"):
    """Create a mock food item with the attributes _personalize_results reads."""
    return SimpleNamespace(name=name, category=category, region=region, source=source)


class TestPersonalizeResults:
    """Unit tests for FoodDatabaseService._personalize_results."""

    def test_cuisine_preference_boosts_matching_region(self):
        """Items with region matching cuisine_preferences rank higher."""
        items = [
            _make_food("Pasta", region="italian"),
            _make_food("Paneer Tikka", region="indian"),
            _make_food("Sushi", region="japanese"),
        ]
        prefs = {"cuisine_preferences": ["indian"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        # Indian item should be first due to 1.5x boost
        assert result[0].name == "Paneer Tikka"

    def test_no_preferences_returns_unchanged(self):
        """Empty user_prefs → items returned in original order."""
        items = [
            _make_food("Apple"),
            _make_food("Banana"),
            _make_food("Cherry"),
        ]
        result = FoodDatabaseService._personalize_results(items, {})
        assert [i.name for i in result] == ["Apple", "Banana", "Cherry"]

    def test_none_preferences_returns_unchanged(self):
        """None user_prefs → items returned in original order."""
        items = [_make_food("Apple"), _make_food("Banana")]
        result = FoodDatabaseService._personalize_results(items, None)
        assert [i.name for i in result] == ["Apple", "Banana"]

    def test_allergy_demotes_matching_items(self):
        """Items with allergen keyword in name are demoted (0.2x score)."""
        items = [
            _make_food("Almond Butter"),
            _make_food("Rice"),
            _make_food("Peanut Bar"),
        ]
        prefs = {"allergies": ["almond", "peanut"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        # Non-allergen item should be first
        assert result[0].name == "Rice"
        # Allergen items should be at the end
        allergen_names = {r.name for r in result[1:]}
        assert "Almond Butter" in allergen_names
        assert "Peanut Bar" in allergen_names

    def test_vegetarian_restriction_demotes_meat(self):
        """Items with meat category are demoted for vegetarian users."""
        items = [
            _make_food("Chicken Breast", category="meat"),
            _make_food("Tofu Stir Fry", category="grain"),
            _make_food("Salmon Fillet", category="seafood"),
        ]
        prefs = {"dietary_restrictions": ["vegetarian"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        # Non-meat item should rank first
        assert result[0].name == "Tofu Stir Fry"
        # Meat/seafood items should be demoted
        demoted_names = [r.name for r in result[1:]]
        assert "Chicken Breast" in demoted_names
        assert "Salmon Fillet" in demoted_names

    def test_empty_items_returns_empty(self):
        """Empty items list → returns empty list."""
        result = FoodDatabaseService._personalize_results([], {"cuisine_preferences": ["indian"]})
        assert result == []

    def test_empty_prefs_dict_returns_items_unchanged(self):
        """Empty prefs dict with no relevant keys → items unchanged."""
        items = [_make_food("A"), _make_food("B"), _make_food("C")]
        result = FoodDatabaseService._personalize_results(items, {"some_other_key": "value"})
        assert [i.name for i in result] == ["A", "B", "C"]

    def test_verified_source_boosted(self):
        """Verified source items get a 1.3x boost."""
        items = [
            _make_food("Rice A", source="community"),
            _make_food("Rice B", source="verified"),
        ]
        # Need at least one preference key to trigger scoring
        prefs = {"cuisine_preferences": ["nonexistent"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        assert result[0].name == "Rice B"

    def test_combined_cuisine_and_allergy(self):
        """Cuisine boost + allergy demotion work together."""
        items = [
            _make_food("Cashew Curry", region="indian"),  # indian boost but "cashew" allergen
            _make_food("Dal Tadka", region="indian"),      # indian boost, no allergen
            _make_food("Plain Rice", region="global"),     # no boost, no allergen
        ]
        prefs = {
            "cuisine_preferences": ["indian"],
            "allergies": ["cashew"],
        }
        result = FoodDatabaseService._personalize_results(items, prefs)
        # Dal Tadka: 1.5x (indian) = 1.5
        # Plain Rice: 1.0
        # Cashew Curry: 1.5 * 0.2 (allergen) = 0.3
        assert result[0].name == "Dal Tadka"
        assert result[-1].name == "Cashew Curry"

    def test_vegan_restriction_demotes_meat_and_dairy(self):
        """Vegan restriction demotes meat, seafood, AND dairy."""
        items = [
            _make_food("Cheese", category="dairy"),
            _make_food("Lentils", category="grain"),
            _make_food("Chicken", category="meat"),
        ]
        prefs = {"dietary_restrictions": ["vegan"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        assert result[0].name == "Lentils"

    def test_multiple_cuisine_preferences_boost_multiple_regions(self):
        """Multiple cuisine preferences boost items from any matching region."""
        items = [
            _make_food("Pasta", region="italian"),
            _make_food("Sushi", region="japanese"),
            _make_food("Plain Rice", region="global"),
        ]
        prefs = {"cuisine_preferences": ["italian", "japanese"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        # Both Italian and Japanese should rank above global
        boosted_names = [r.name for r in result[:2]]
        assert "Pasta" in boosted_names
        assert "Sushi" in boosted_names
        assert result[-1].name == "Plain Rice"

    def test_case_insensitive_cuisine_matching(self):
        """Cuisine matching is case-insensitive."""
        items = [
            _make_food("Paneer", region="Indian"),
            _make_food("Rice", region="global"),
        ]
        prefs = {"cuisine_preferences": ["indian"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        assert result[0].name == "Paneer"

    def test_case_insensitive_allergy_matching(self):
        """Allergy matching is case-insensitive."""
        items = [
            _make_food("PEANUT Butter"),
            _make_food("Rice"),
        ]
        prefs = {"allergies": ["peanut"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        assert result[0].name == "Rice"

    def test_usda_source_boosted_over_community(self):
        """USDA source items get a 1.2x boost over community."""
        items = [
            _make_food("Rice A", source="community"),
            _make_food("Rice B", source="usda"),
        ]
        prefs = {"cuisine_preferences": ["nonexistent"]}
        result = FoodDatabaseService._personalize_results(items, prefs)
        assert result[0].name == "Rice B"


# ------------------------------------------------------------------
# Schema boundary validation — Food DNA fields
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_meal_frequency_min_boundary(client, override_get_db):
    """meal_frequency=2 (min boundary) → 201."""
    headers = await _register_unique_user(client, "mf_min@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "meal_frequency": 2}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201

@pytest.mark.asyncio
async def test_onboarding_meal_frequency_max_boundary(client, override_get_db):
    """meal_frequency=6 (max boundary) → 201."""
    headers = await _register_unique_user(client, "mf_max@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "meal_frequency": 6}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201

@pytest.mark.asyncio
async def test_onboarding_meal_frequency_below_min(client, override_get_db):
    """meal_frequency=1 (below min 2) → 400."""
    headers = await _register_unique_user(client, "mf_low@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "meal_frequency": 1}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_onboarding_meal_frequency_above_max(client, override_get_db):
    """meal_frequency=7 (above max 6) → 400."""
    headers = await _register_unique_user(client, "mf_high@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "meal_frequency": 7}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_onboarding_protein_per_kg_min_boundary(client, override_get_db):
    """protein_per_kg=1.0 (min boundary) → 201."""
    headers = await _register_unique_user(client, "ppk_min@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "protein_per_kg": 1.0}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201

@pytest.mark.asyncio
async def test_onboarding_protein_per_kg_max_boundary(client, override_get_db):
    """protein_per_kg=3.0 (max boundary) → 201."""
    headers = await _register_unique_user(client, "ppk_max@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "protein_per_kg": 3.0}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201

@pytest.mark.asyncio
async def test_onboarding_protein_per_kg_below_min(client, override_get_db):
    """protein_per_kg=0.9 (below min 1.0) → 400."""
    headers = await _register_unique_user(client, "ppk_low@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "protein_per_kg": 0.9}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_onboarding_protein_per_kg_above_max(client, override_get_db):
    """protein_per_kg=3.1 (above max 3.0) → 400."""
    headers = await _register_unique_user(client, "ppk_high@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "protein_per_kg": 3.1}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_onboarding_exercise_sessions_min_boundary(client, override_get_db):
    """exercise_sessions_per_week=0 (min boundary) → 201."""
    headers = await _register_unique_user(client, "es_min@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "exercise_sessions_per_week": 0}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201

@pytest.mark.asyncio
async def test_onboarding_exercise_sessions_max_boundary(client, override_get_db):
    """exercise_sessions_per_week=14 (max boundary) → 201."""
    headers = await _register_unique_user(client, "es_max@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "exercise_sessions_per_week": 14}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201

@pytest.mark.asyncio
async def test_onboarding_exercise_sessions_above_max(client, override_get_db):
    """exercise_sessions_per_week=15 (above max 14) → 400."""
    headers = await _register_unique_user(client, "es_high@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "exercise_sessions_per_week": 15}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_onboarding_partial_food_dna_only_restrictions(client, override_get_db):
    """Only dietary_restrictions set → only that field in preferences."""
    headers = await _register_unique_user(client, "partial_dr@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "dietary_restrictions": ["vegetarian"]}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201
    prefs = resp.json()["profile"].get("preferences") or {}
    assert prefs.get("dietary_restrictions") == ["vegetarian"]
    assert "allergies" not in prefs
    assert "cuisine_preferences" not in prefs


# ------------------------------------------------------------------
# Backend edge-case tests
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_onboarding_unauthenticated_returns_401(client, override_get_db):
    """POST /onboarding/complete without auth → 401."""
    resp = await client.post("/api/v1/onboarding/complete", json=VALID_ONBOARDING_PAYLOAD)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_onboarding_empty_body_returns_error(client, override_get_db):
    """POST /onboarding/complete with empty body → 400."""
    headers = await _register_unique_user(client, "empty_body@example.com")
    resp = await client.post("/api/v1/onboarding/complete", json={}, headers=headers)
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_onboarding_missing_goal_type_returns_400(client, override_get_db):
    """POST without goal_type → 400."""
    headers = await _register_unique_user(client, "no_goal@example.com")
    payload = {k: v for k, v in VALID_ONBOARDING_PAYLOAD.items() if k != "goal_type"}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_onboarding_invalid_sex_returns_400(client, override_get_db):
    """POST with sex='other' (not in Literal['male','female']) → 400."""
    headers = await _register_unique_user(client, "bad_sex@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "sex": "other"}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_onboarding_height_min_boundary(client, override_get_db):
    """height_cm=100 (min) → 201."""
    headers = await _register_unique_user(client, "h_min@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "height_cm": 100}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_onboarding_height_max_boundary(client, override_get_db):
    """height_cm=250 (max) → 201."""
    headers = await _register_unique_user(client, "h_max@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "height_cm": 250}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_onboarding_age_min_boundary(client, override_get_db):
    """age_years=13 (min) → 201."""
    headers = await _register_unique_user(client, "age_min@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "age_years": 13}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_onboarding_age_max_boundary(client, override_get_db):
    """age_years=120 (max) → 201."""
    headers = await _register_unique_user(client, "age_max@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "age_years": 120}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_onboarding_goal_rate_min_boundary(client, override_get_db):
    """goal_rate_per_week=-2.0 (min) → 201."""
    headers = await _register_unique_user(client, "rate_min@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "goal_rate_per_week": -2.0}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_onboarding_goal_rate_max_boundary(client, override_get_db):
    """goal_rate_per_week=2.0 (max) → 201."""
    headers = await _register_unique_user(client, "rate_max@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "goal_rate_per_week": 2.0}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_onboarding_goal_rate_over_max(client, override_get_db):
    """goal_rate_per_week=2.1 → 400."""
    headers = await _register_unique_user(client, "rate_over@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "goal_rate_per_week": 2.1}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code == 400
