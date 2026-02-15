"""USDA FoodData Central API client.

Provides search and nutrient lookup against the USDA's 300K+ food database.
Uses DEMO_KEY by default (1000 req/hour) — can be upgraded with a free API key
from https://fdc.nal.usda.gov/api-key-signup

The client maps USDA nutrient IDs to our internal schema format.
"""

import httpx
from typing import Any, Optional

USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

# USDA nutrient ID → our field name mapping
NUTRIENT_MAP = {
    1008: ("calories", 1.0),        # Energy (kcal)
    1003: ("protein_g", 1.0),       # Protein
    1004: ("fat_g", 1.0),           # Total lipid (fat)
    1005: ("carbs_g", 1.0),         # Carbohydrate
    1079: ("fibre_g", 1.0),         # Fiber, total dietary
    1087: ("calcium_mg", 1.0),      # Calcium, Ca
    1089: ("iron_mg", 1.0),         # Iron, Fe
    1090: ("magnesium_mg", 1.0),    # Magnesium, Mg
    1091: ("phosphorus_mg", 1.0),   # Phosphorus, P
    1092: ("potassium_mg", 1.0),    # Potassium, K
    1093: ("sodium_mg", 1.0),       # Sodium, Na
    1095: ("zinc_mg", 1.0),         # Zinc, Zn
    1098: ("copper_mg", 1.0),       # Copper, Cu
    1101: ("manganese_mg", 1.0),    # Manganese, Mn
    1103: ("selenium_mcg", 1.0),    # Selenium, Se
    1106: ("vitamin_a_mcg", 1.0),   # Vitamin A, RAE
    1162: ("vitamin_c_mg", 1.0),    # Vitamin C
    1109: ("vitamin_e_mg", 1.0),    # Vitamin E
    1114: ("vitamin_d_mcg", 1.0),   # Vitamin D (D2 + D3)
    1183: ("vitamin_k_mcg", 1.0),   # Vitamin K
    1165: ("thiamin_mg", 1.0),      # Thiamin (B1)
    1166: ("riboflavin_mg", 1.0),   # Riboflavin (B2)
    1167: ("niacin_mg", 1.0),       # Niacin (B3)
    1175: ("vitamin_b6_mg", 1.0),   # Vitamin B-6
    1177: ("folate_mcg", 1.0),      # Folate, total
    1178: ("vitamin_b12_mcg", 1.0), # Vitamin B-12
    1253: ("cholesterol_mg", 1.0),  # Cholesterol
    1170: ("pantothenic_acid_mg", 1.0),  # Pantothenic Acid (Vitamin B5)
    1176: ("biotin_mcg", 1.0),           # Biotin (Vitamin B7)
    1404: ("omega_3_g", 1.0),            # Total Omega-3 fatty acids
    1405: ("omega_6_g", 1.0),            # Total Omega-6 fatty acids
}


def _extract_nutrients(food_nutrients: list[dict]) -> tuple[dict[str, float], dict[str, float]]:
    """Extract macros and micro_nutrients from USDA foodNutrients array.

    Returns (macros, micros) where macros has calories/protein_g/fat_g/carbs_g
    and micros has everything else.
    """
    macros = {"calories": 0.0, "protein_g": 0.0, "fat_g": 0.0, "carbs_g": 0.0}
    micros: dict[str, float] = {}

    for nutrient in food_nutrients:
        nutrient_id = nutrient.get("nutrientId")
        value = nutrient.get("value", 0)
        if nutrient_id in NUTRIENT_MAP and value:
            field_name, multiplier = NUTRIENT_MAP[nutrient_id]
            converted = round(value * multiplier, 2)
            if field_name in macros:
                macros[field_name] = converted
            else:
                micros[field_name] = converted

    return macros, micros


def _parse_usda_food(food: dict) -> dict[str, Any]:
    """Parse a USDA food search result into our internal format."""
    macros, micros = _extract_nutrients(food.get("foodNutrients", []))

    # Determine serving size
    serving_size = food.get("servingSize", 100)
    serving_unit = food.get("servingSizeUnit", "g")

    return {
        "usda_fdc_id": food["fdcId"],
        "name": food.get("description", "").title(),
        "category": food.get("foodCategory", "General"),
        "region": "USDA",
        "serving_size": serving_size,
        "serving_unit": serving_unit,
        "calories": macros["calories"],
        "protein_g": macros["protein_g"],
        "carbs_g": macros["carbs_g"],
        "fat_g": macros["fat_g"],
        "micro_nutrients": micros if micros else None,
        "data_source": "usda_fdc",
    }


async def search_usda_foods(
    query: str,
    page_size: int = 15,
    data_types: str = "Foundation,SR Legacy,Survey (FNDDS)",
    api_key: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Search USDA FoodData Central for foods matching the query.

    Prefers Foundation and SR Legacy data types for better nutrient coverage.
    Falls back to DEMO_KEY if no API key is configured.
    """
    key = api_key or "DEMO_KEY"

    params = {
        "api_key": key,
        "query": query,
        "pageSize": page_size,
        "dataType": data_types,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{USDA_BASE_URL}/foods/search", params=params)
            response.raise_for_status()
            data = response.json()

            foods = data.get("foods", [])
            return [_parse_usda_food(f) for f in foods]
        except (httpx.HTTPError, httpx.TimeoutException, KeyError, ValueError):
            return []


async def get_usda_food_details(
    fdc_id: int,
    api_key: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Get detailed nutrient data for a specific USDA food by FDC ID."""
    key = api_key or "DEMO_KEY"

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{USDA_BASE_URL}/food/{fdc_id}",
                params={"api_key": key},
            )
            response.raise_for_status()
            food = response.json()
            return _parse_usda_food(food)
        except (httpx.HTTPError, httpx.TimeoutException, KeyError, ValueError):
            return None
