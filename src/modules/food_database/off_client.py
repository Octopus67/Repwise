"""Open Food Facts API client.

Provides barcode-based product lookup against the Open Food Facts database
(3M+ products, free, no API key required).

The client normalises OFF's nutriment data into our internal schema format
and enforces a 5-second timeout to avoid blocking the barcode lookup chain.
"""

from __future__ import annotations
from typing import Optional

import logging
import re

import httpx

logger = logging.getLogger(__name__)

OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2"


def _parse_serving_size(raw: Optional[str]) -> tuple[float, str]:
    """Extract numeric serving size and unit from OFF's free-text field.

    Examples: "100g", "30 g", "250 ml", "1 bar (40g)" → best-effort parse.
    Returns (100.0, "g") as default when parsing fails.
    """
    if not raw:
        return 100.0, "g"

    # Try to find a pattern like "100g" or "30 ml"
    match = re.search(r"(\d+(?:\.\d+)?)\s*(g|ml|oz|kg|l)", raw.lower())
    if match:
        return float(match.group(1)), match.group(2)

    # Fallback: try to extract any number
    num_match = re.search(r"(\d+(?:\.\d+)?)", raw)
    if num_match:
        return float(num_match.group(1)), "g"

    return 100.0, "g"


async def get_product_by_barcode(barcode: str) -> Optional[dict]:
    """Look up a product by barcode on Open Food Facts.

    Returns a normalised dict matching our internal food item schema::

        {
            "name": str,
            "calories": float,
            "protein_g": float,
            "carbs_g": float,
            "fat_g": float,
            "serving_size": float,
            "serving_unit": str,
            "barcode": str,
        }

    Returns ``None`` on 404, timeout, network error, or if required fields
    (name, calories) are missing from the response.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.get(
                f"{OFF_BASE_URL}/product/{barcode}.json",
                headers={"User-Agent": "HypertrophyOS/1.0"},
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()
            data = response.json()

        except (httpx.HTTPError, httpx.TimeoutException, ValueError):
            logger.warning("OFF API error for barcode=%s", barcode, exc_info=True)
            return None

    # OFF returns status=0 when product is not found
    if data.get("status") != 1:
        return None

    product = data.get("product", {})
    if not product:
        return None

    # Extract product name — required field
    name = product.get("product_name", "").strip()
    if not name:
        return None

    # Extract nutriments (per 100g values)
    nutriments = product.get("nutriments", {})

    calories = nutriments.get("energy-kcal_100g")
    protein_g = nutriments.get("proteins_100g")
    carbs_g = nutriments.get("carbohydrates_100g")
    fat_g = nutriments.get("fat_100g")

    # Calories is required; macros default to 0 if missing
    if calories is None:
        return None

    try:
        calories = float(calories)
        protein_g = float(protein_g) if protein_g is not None else 0.0
        carbs_g = float(carbs_g) if carbs_g is not None else 0.0
        fat_g = float(fat_g) if fat_g is not None else 0.0
    except (TypeError, ValueError):
        return None

    # Parse serving size
    serving_size, serving_unit = _parse_serving_size(
        product.get("serving_size")
    )

    return {
        "name": name,
        "calories": calories,
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
        "serving_size": serving_size,
        "serving_unit": serving_unit,
        "barcode": barcode,
    }
