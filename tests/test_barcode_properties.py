"""Property-based tests for barcode lookup service.

Tests Properties 1, 2, and 4 from the design document using Hypothesis.
Operates at the service level using the db_session fixture with mocked
external API calls (OFF and USDA).
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.barcode_service import BarcodeService
from src.modules.food_database.schemas import BarcodeResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _unique_barcode() -> str:
    """Generate a unique 14-digit barcode to avoid cache collisions across examples."""
    return uuid.uuid4().int.__str__()[:14].zfill(14)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_barcode_strategy = st.text(
    alphabet="0123456789",
    min_size=8,
    max_size=14,
)

_positive_floats = st.floats(
    min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False
)

_serving_sizes = st.floats(
    min_value=1.0, max_value=1000.0, allow_nan=False, allow_infinity=False
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
def off_result_strategy(draw):
    """Generate a valid OFF API result dict."""
    barcode = draw(_barcode_strategy)
    return {
        "name": draw(_food_names),
        "calories": draw(_positive_floats),
        "protein_g": draw(_positive_floats),
        "carbs_g": draw(_positive_floats),
        "fat_g": draw(_positive_floats),
        "serving_size": draw(_serving_sizes),
        "serving_unit": "g",
        "barcode": barcode,
    }


@st.composite
def usda_result_strategy(draw):
    """Generate a valid USDA API result dict."""
    barcode = draw(_barcode_strategy)
    return {
        "name": draw(_food_names),
        "calories": draw(_positive_floats),
        "protein_g": draw(_positive_floats),
        "carbs_g": draw(_positive_floats),
        "fat_g": draw(_positive_floats),
        "serving_size": draw(_serving_sizes),
        "serving_unit": "g",
        "category": "General",
        "region": "USDA",
        "barcode": barcode,
    }


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 1: Barcode lookup fallback chain
# ---------------------------------------------------------------------------


class TestProperty1BarcodeLookupFallbackChain:
    """Property 1: Barcode lookup fallback chain.

    For any valid barcode string, if the Open Food Facts API returns no
    result, the system should query USDA as a fallback. If both return no
    result, the system should return found=False.

    **Validates: Requirements 1.1.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_both_miss_returns_not_found(
        self,
        data,
        db_session: AsyncSession,
    ):
        """When both OFF and USDA return None, found=False.

        **Validates: Requirements 1.1.3**
        """
        barcode = _unique_barcode()
        with (
            patch(
                "src.modules.food_database.barcode_service.get_product_by_barcode",
                new_callable=AsyncMock,
                return_value=None,
            ) as mock_off,
            patch(
                "src.modules.food_database.barcode_service.search_usda_foods",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_usda,
        ):
            service = BarcodeService(db_session)
            result = await service.lookup_barcode(barcode)

            assert result.found is False
            assert result.food_item is None
            assert result.source is None

            # Both APIs were called
            mock_off.assert_awaited_once_with(barcode)
            mock_usda.assert_awaited_once()

    @pytest.mark.asyncio
    @_fixture_settings
    @given(usda_data=usda_result_strategy())
    async def test_off_miss_falls_through_to_usda(
        self,
        usda_data: dict,
        db_session: AsyncSession,
    ):
        """When OFF returns None but USDA has a result, USDA result is used.

        **Validates: Requirements 1.1.3**
        """
        # Use a unique barcode per example to avoid cache collisions
        barcode = uuid.uuid4().hex[:14]
        usda_data["barcode"] = barcode

        with (
            patch(
                "src.modules.food_database.barcode_service.get_product_by_barcode",
                new_callable=AsyncMock,
                return_value=None,
            ) as mock_off,
            patch(
                "src.modules.food_database.barcode_service.search_usda_foods",
                new_callable=AsyncMock,
                return_value=[usda_data],
            ) as mock_usda,
        ):
            service = BarcodeService(db_session)
            result = await service.lookup_barcode(barcode)

            assert result.found is True
            assert result.source == "usda"
            assert result.food_item is not None

            # OFF was called first, then USDA
            mock_off.assert_awaited_once_with(barcode)
            mock_usda.assert_awaited_once()

    @pytest.mark.asyncio
    @_fixture_settings
    @given(off_data=off_result_strategy())
    async def test_off_hit_skips_usda(
        self,
        off_data: dict,
        db_session: AsyncSession,
    ):
        """When OFF returns a result, USDA is not called.

        **Validates: Requirements 1.1.3**
        """
        barcode = _unique_barcode()
        off_data["barcode"] = barcode

        with (
            patch(
                "src.modules.food_database.barcode_service.get_product_by_barcode",
                new_callable=AsyncMock,
                return_value=off_data,
            ) as mock_off,
            patch(
                "src.modules.food_database.barcode_service.search_usda_foods",
                new_callable=AsyncMock,
            ) as mock_usda,
        ):
            service = BarcodeService(db_session)
            result = await service.lookup_barcode(barcode)

            assert result.found is True
            assert result.source == "off"

            mock_off.assert_awaited_once_with(barcode)
            mock_usda.assert_not_awaited()


# ---------------------------------------------------------------------------
# Property 2: Barcode result completeness
# ---------------------------------------------------------------------------


class TestProperty2BarcodeResultCompleteness:
    """Property 2: Barcode result completeness.

    For any food item returned from a barcode lookup (regardless of source
    API), the result should contain non-null, non-empty values for: name,
    calories (≥0), protein_g (≥0), carbs_g (≥0), fat_g (≥0), and
    serving_size (>0).

    **Validates: Requirements 1.1.4**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(off_data=off_result_strategy())
    async def test_off_result_has_complete_fields(
        self,
        off_data: dict,
        db_session: AsyncSession,
    ):
        """OFF-sourced results have all required fields populated.

        **Validates: Requirements 1.1.4**
        """
        barcode = _unique_barcode()
        off_data["barcode"] = barcode

        with patch(
            "src.modules.food_database.barcode_service.get_product_by_barcode",
            new_callable=AsyncMock,
            return_value=off_data,
        ):
            service = BarcodeService(db_session)
            result = await service.lookup_barcode(barcode)

            assert result.found is True
            item = result.food_item
            assert item is not None
            assert item.name is not None and len(item.name) > 0
            assert item.calories >= 0
            assert item.protein_g >= 0
            assert item.carbs_g >= 0
            assert item.fat_g >= 0
            assert item.serving_size > 0

    @pytest.mark.asyncio
    @_fixture_settings
    @given(usda_data=usda_result_strategy())
    async def test_usda_result_has_complete_fields(
        self,
        usda_data: dict,
        db_session: AsyncSession,
    ):
        """USDA-sourced results have all required fields populated.

        **Validates: Requirements 1.1.4**
        """
        barcode = _unique_barcode()
        usda_data["barcode"] = barcode

        with (
            patch(
                "src.modules.food_database.barcode_service.get_product_by_barcode",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "src.modules.food_database.barcode_service.search_usda_foods",
                new_callable=AsyncMock,
                return_value=[usda_data],
            ),
        ):
            service = BarcodeService(db_session)
            result = await service.lookup_barcode(barcode)

            assert result.found is True
            item = result.food_item
            assert item is not None
            assert item.name is not None and len(item.name) > 0
            assert item.calories >= 0
            assert item.protein_g >= 0
            assert item.carbs_g >= 0
            assert item.fat_g >= 0
            assert item.serving_size > 0


# ---------------------------------------------------------------------------
# Property 4: Barcode cache round-trip
# ---------------------------------------------------------------------------


class TestProperty4BarcodeCacheRoundTrip:
    """Property 4: Barcode cache round-trip.

    For any barcode that was successfully looked up from an external API,
    a subsequent lookup for the same barcode should: (a) not make any
    external API call, (b) return found=True, and (c) return a food item
    with macros equivalent to the original lookup result.

    **Validates: Requirements 1.1.6**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(off_data=off_result_strategy())
    async def test_second_lookup_uses_cache(
        self,
        off_data: dict,
        db_session: AsyncSession,
    ):
        """After a successful OFF lookup, the second lookup returns from cache.

        **Validates: Requirements 1.1.6**
        """
        barcode = _unique_barcode()
        off_data["barcode"] = barcode

        # First lookup — hits OFF API
        with patch(
            "src.modules.food_database.barcode_service.get_product_by_barcode",
            new_callable=AsyncMock,
            return_value=off_data,
        ):
            service = BarcodeService(db_session)
            first_result = await service.lookup_barcode(barcode)
            assert first_result.found is True

        # Commit so the cache entry is visible
        await db_session.commit()

        # Second lookup — should use cache, no external API calls
        with (
            patch(
                "src.modules.food_database.barcode_service.get_product_by_barcode",
                new_callable=AsyncMock,
            ) as mock_off,
            patch(
                "src.modules.food_database.barcode_service.search_usda_foods",
                new_callable=AsyncMock,
            ) as mock_usda,
        ):
            service2 = BarcodeService(db_session)
            second_result = await service2.lookup_barcode(barcode)

            # (a) No external API calls
            mock_off.assert_not_awaited()
            mock_usda.assert_not_awaited()

            # (b) found=True
            assert second_result.found is True
            assert second_result.source == "cache"

            # (c) Macros match within tolerance
            first_item = first_result.food_item
            second_item = second_result.food_item
            assert second_item is not None
            assert first_item is not None
            assert abs(second_item.calories - first_item.calories) < 0.01
            assert abs(second_item.protein_g - first_item.protein_g) < 0.01
            assert abs(second_item.carbs_g - first_item.carbs_g) < 0.01
            assert abs(second_item.fat_g - first_item.fat_g) < 0.01


# ---------------------------------------------------------------------------
# OFF Client — _parse_serving_size unit tests
# ---------------------------------------------------------------------------

from src.modules.food_database.off_client import _parse_serving_size, get_product_by_barcode


class TestParseServingSize:
    """Unit tests for OFF client's serving size parser."""

    def test_simple_grams(self):
        assert _parse_serving_size("100g") == (100.0, "g")

    def test_grams_with_space(self):
        assert _parse_serving_size("30 g") == (30.0, "g")

    def test_milliliters(self):
        assert _parse_serving_size("250 ml") == (250.0, "ml")

    def test_complex_format(self):
        """'1 bar (40g)' → extracts 40g."""
        size, unit = _parse_serving_size("1 bar (40g)")
        assert size == 40.0
        assert unit == "g"

    def test_none_returns_default(self):
        assert _parse_serving_size(None) == (100.0, "g")

    def test_empty_string_returns_default(self):
        assert _parse_serving_size("") == (100.0, "g")

    def test_no_unit_extracts_number(self):
        """'50' without unit → (50.0, 'g')."""
        size, unit = _parse_serving_size("50")
        assert size == 50.0
        assert unit == "g"

    def test_ounces(self):
        assert _parse_serving_size("2oz") == (2.0, "oz")

    def test_decimal_grams(self):
        size, unit = _parse_serving_size("33.5g")
        assert size == 33.5
        assert unit == "g"

    def test_garbage_string_returns_default(self):
        """Unparseable string → default (100.0, 'g')."""
        assert _parse_serving_size("one serving") == (100.0, "g")


# ---------------------------------------------------------------------------
# OFF Client — get_product_by_barcode with mocked HTTP
# ---------------------------------------------------------------------------


class TestGetProductByBarcode:
    """Tests for OFF API client with mocked HTTP responses."""

    @staticmethod
    def _make_mock_client(mock_resp):
        """Build a mock httpx.AsyncClient that works with `async with`."""
        mock_instance = AsyncMock()
        mock_instance.get = AsyncMock(return_value=mock_resp)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        return mock_instance

    @staticmethod
    def _make_mock_response(json_data, status_code=200):
        """Build a mock httpx.Response with synchronous .json() and .raise_for_status()."""
        from unittest.mock import MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = status_code
        mock_resp.json.return_value = json_data
        mock_resp.raise_for_status.return_value = None
        return mock_resp

    @pytest.mark.asyncio
    async def test_successful_lookup(self):
        """Valid barcode with complete data → returns normalized dict."""
        mock_response = {
            "status": 1,
            "product": {
                "product_name": "Test Protein Bar",
                "nutriments": {
                    "energy-kcal_100g": 350,
                    "proteins_100g": 25,
                    "carbohydrates_100g": 30,
                    "fat_100g": 15,
                },
                "serving_size": "60g",
            },
        }
        mock_resp = self._make_mock_response(mock_response)
        with patch("src.modules.food_database.off_client.httpx.AsyncClient") as MockClient:
            MockClient.return_value = self._make_mock_client(mock_resp)

            result = await get_product_by_barcode("3017620422003")
            assert result is not None
            assert result["name"] == "Test Protein Bar"
            assert result["calories"] == 350
            assert result["protein_g"] == 25
            assert result["carbs_g"] == 30
            assert result["fat_g"] == 15
            assert result["serving_size"] == 60.0
            assert result["barcode"] == "3017620422003"

    @pytest.mark.asyncio
    async def test_product_not_found_returns_none(self):
        """Status 0 (not found) → returns None."""
        mock_resp = self._make_mock_response({"status": 0})
        with patch("src.modules.food_database.off_client.httpx.AsyncClient") as MockClient:
            MockClient.return_value = self._make_mock_client(mock_resp)

            result = await get_product_by_barcode("0000000000000")
            assert result is None

    @pytest.mark.asyncio
    async def test_missing_product_name_returns_none(self):
        """Product with empty name → returns None."""
        mock_resp = self._make_mock_response({
            "status": 1,
            "product": {
                "product_name": "",
                "nutriments": {"energy-kcal_100g": 100},
            },
        })
        with patch("src.modules.food_database.off_client.httpx.AsyncClient") as MockClient:
            MockClient.return_value = self._make_mock_client(mock_resp)

            result = await get_product_by_barcode("1234567890123")
            assert result is None

    @pytest.mark.asyncio
    async def test_missing_calories_returns_none(self):
        """Product without calories → returns None."""
        mock_resp = self._make_mock_response({
            "status": 1,
            "product": {
                "product_name": "Some Food",
                "nutriments": {"proteins_100g": 10},
            },
        })
        with patch("src.modules.food_database.off_client.httpx.AsyncClient") as MockClient:
            MockClient.return_value = self._make_mock_client(mock_resp)

            result = await get_product_by_barcode("1234567890123")
            assert result is None

    @pytest.mark.asyncio
    async def test_timeout_returns_none(self):
        """HTTP timeout → returns None (no crash)."""
        import httpx as httpx_mod
        with patch("src.modules.food_database.off_client.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.get = AsyncMock(side_effect=httpx_mod.TimeoutException("timeout"))
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await get_product_by_barcode("1234567890123")
            assert result is None

    @pytest.mark.asyncio
    async def test_macros_default_to_zero_when_missing(self):
        """Product with calories but no macros → macros default to 0."""
        mock_resp = self._make_mock_response({
            "status": 1,
            "product": {
                "product_name": "Mystery Food",
                "nutriments": {"energy-kcal_100g": 200},
            },
        })
        with patch("src.modules.food_database.off_client.httpx.AsyncClient") as MockClient:
            MockClient.return_value = self._make_mock_client(mock_resp)

            result = await get_product_by_barcode("9999999999999")
            assert result is not None
            assert result["protein_g"] == 0.0
            assert result["carbs_g"] == 0.0
            assert result["fat_g"] == 0.0


# ---------------------------------------------------------------------------
# Barcode Router — endpoint validation tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_barcode_endpoint_invalid_format_returns_422(client, override_get_db):
    """GET /food/barcode/abc → 422 (not numeric)."""
    # Register and get auth headers
    resp = await client.post("/api/v1/auth/register", json={"email": "bc_test@example.com", "password": "securepass123"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/v1/food/barcode/abc", headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_barcode_endpoint_too_short_returns_422(client, override_get_db):
    """GET /food/barcode/123 → 422 (too short, min 8 digits)."""
    resp = await client.post("/api/v1/auth/register", json={"email": "bc_short@example.com", "password": "securepass123"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/v1/food/barcode/123", headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_barcode_endpoint_unauthenticated_returns_401(client, override_get_db):
    """GET /food/barcode/12345678 without auth → 401."""
    resp = await client.get("/api/v1/food/barcode/12345678")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Property 5: Barcode format validation (backend)
# Feature: camera-barcode-scanner, Property 5: Barcode format validation (backend)
# ---------------------------------------------------------------------------

import re

_BARCODE_VALID_RE = re.compile(r"^\d{8,14}$")

# Strategy: invalid barcodes — digit-only strings with wrong length.
# We use digit-only strings to ensure they route cleanly to /barcode/{barcode}
# and isolate the regex validation logic (not URL routing or UUID parsing).
_invalid_digit_barcode_strategy = st.one_of(
    # Too short: 0-7 digits
    st.text(alphabet="0123456789", min_size=0, max_size=7),
    # Too long: 15-30 digits
    st.text(alphabet="0123456789", min_size=15, max_size=30),
)

# Strategy: invalid barcodes — contain non-digit characters.
# Use safe URL-path characters (alphanumeric + some punctuation) to avoid
# routing issues with slashes, percent-encoding, etc.
_invalid_alpha_barcode_strategy = st.text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
    min_size=1,
    max_size=20,
).filter(lambda s: not _BARCODE_VALID_RE.match(s))

# Combined invalid strategy
_invalid_barcode_strategy_p5 = st.one_of(
    _invalid_digit_barcode_strategy,
    _invalid_alpha_barcode_strategy,
)

# Strategy: strings that DO match ^\d{8,14}$
_valid_barcode_strategy_p5 = st.text(
    alphabet="0123456789",
    min_size=8,
    max_size=14,
)


class TestProperty5BarcodeFormatValidationBackend:
    """Property 5: Barcode format validation (backend).

    For any string that does NOT match ``^\\d{8,14}$``, the
    ``GET /food/barcode/{barcode}`` endpoint should return HTTP 422.
    For any string that DOES match the pattern, the endpoint should NOT
    return 422.

    **Validates: Requirements 8.2**
    """

    @pytest.mark.asyncio
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @given(barcode=_invalid_barcode_strategy_p5)
    async def test_property_5_invalid_barcode_returns_422(
        self,
        barcode: str,
        client,
        override_get_db,
    ):
        """Strings not matching ^\\d{8,14}$ → HTTP 422.

        **Validates: Requirements 8.2**
        """
        # Empty strings can't form a valid URL path segment
        if not barcode:
            return

        # Register a user and get auth token
        email = f"prop5_inv_{uuid.uuid4().hex[:8]}@test.com"
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass123"},
        )
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.get(
            f"/api/v1/food/barcode/{barcode}",
            headers=headers,
        )
        assert resp.status_code == 422, (
            f"Expected 422 for invalid barcode {barcode!r}, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @given(barcode=_valid_barcode_strategy_p5)
    async def test_property_5_valid_barcode_not_422(
        self,
        barcode: str,
        client,
        override_get_db,
    ):
        """Strings matching ^\\d{8,14}$ → NOT HTTP 422.

        **Validates: Requirements 8.2**
        """
        # Register a user and get auth token
        email = f"prop5_val_{uuid.uuid4().hex[:8]}@test.com"
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass123"},
        )
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Mock external APIs to avoid real network calls — we only care
        # that the endpoint does NOT reject valid barcodes with 422.
        with (
            patch(
                "src.modules.food_database.barcode_service.get_product_by_barcode",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "src.modules.food_database.barcode_service.search_usda_foods",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            resp = await client.get(
                f"/api/v1/food/barcode/{barcode}",
                headers=headers,
            )
            assert resp.status_code != 422, (
                f"Got 422 for valid barcode {barcode!r} — should pass validation"
            )
