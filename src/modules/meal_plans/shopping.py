"""Pure shopping list computation — no DB access, no side effects."""

from __future__ import annotations
from typing import Optional

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {"produce", "protein", "dairy", "grains", "pantry", "other"}

UNIT_CONVERSIONS: dict[tuple[str, str], float] = {
    ("ml", "l"): 0.001,
    ("l", "ml"): 1000.0,
    ("g", "kg"): 0.001,
    ("kg", "g"): 1000.0,
    ("tsp", "tbsp"): 1 / 3,
    ("tbsp", "tsp"): 3.0,
}

CATEGORY_MAP: dict[str, str] = {
    "vegetables": "produce",
    "fruits": "produce",
    "leafy greens": "produce",
    "chicken": "protein",
    "beef": "protein",
    "fish": "protein",
    "eggs": "protein",
    "tofu": "protein",
    "paneer": "protein",
    "milk": "dairy",
    "cheese": "dairy",
    "yogurt": "dairy",
    "curd": "dairy",
    "rice": "grains",
    "bread": "grains",
    "pasta": "grains",
    "oats": "grains",
    "wheat": "grains",
    "roti": "grains",
}


@dataclass(frozen=True)
class IngredientEntry:
    name: str
    quantity: float
    unit: str
    food_category: str


@dataclass(frozen=True)
class ShoppingItem:
    name: str
    quantity: float
    unit: str
    category: str


@dataclass(frozen=True)
class ShoppingList:
    items: list[ShoppingItem]


def resolve_category(food_category: str) -> str:
    """Map a food category string to a shopping list category."""
    lower = food_category.lower().strip()
    if lower in VALID_CATEGORIES:
        return lower
    if lower in CATEGORY_MAP:
        return CATEGORY_MAP[lower]
    # keyword match
    for keyword, cat in CATEGORY_MAP.items():
        if keyword in lower:
            return cat
    return "other"


def normalize_unit(quantity: float, unit: str, target_unit: str) -> Optional[float]:
    """Convert quantity to target_unit. Returns None if no conversion exists."""
    if unit == target_unit:
        return quantity
    key = (unit.lower(), target_unit.lower())
    factor = UNIT_CONVERSIONS.get(key)
    if factor is None:
        return None
    return quantity * factor


def consolidate_ingredients(all_ingredients: list[IngredientEntry]) -> ShoppingList:
    """Aggregate ingredients, combine duplicates by name+unit, group by category."""
    if not all_ingredients:
        return ShoppingList(items=[])

    # Group by (name_lower, unit_lower)
    buckets: dict[tuple[str, str], tuple[float, str, str]] = {}
    for entry in all_ingredients:
        qty = entry.quantity
        if qty < 0:
            logger.warning("Negative quantity %.2f for %s, clamping to 0", qty, entry.name)
            qty = 0.0
        key = (entry.name.lower(), entry.unit.lower())
        if key in buckets:
            existing_qty, cat, orig_name = buckets[key]
            buckets[key] = (existing_qty + qty, cat, orig_name)
        else:
            cat = resolve_category(entry.food_category)
            buckets[key] = (qty, cat, entry.name)

    # Try to merge items with same name but different convertible units
    merged: dict[str, list[tuple[float, str, str]]] = {}
    for (name_lower, unit_lower), (qty, cat, orig_name) in buckets.items():
        if name_lower not in merged:
            merged[name_lower] = []
        # Try to convert to an existing unit for this name
        combined = False
        for i, (eq, eu, ec) in enumerate(merged[name_lower]):
            converted = normalize_unit(qty, unit_lower, eu)
            if converted is not None:
                merged[name_lower][i] = (eq + converted, eu, ec)
                combined = True
                break
        if not combined:
            merged[name_lower].append((qty, unit_lower, cat))

    items: list[ShoppingItem] = []
    for name_lower, entries in merged.items():
        for qty, unit, cat in entries:
            # Use original-cased name from first occurrence
            orig_name = name_lower
            for (nl, _), (_, _, on) in buckets.items():
                if nl == name_lower:
                    orig_name = on
                    break
            items.append(
                ShoppingItem(
                    name=orig_name,
                    quantity=round(qty, 2),
                    unit=unit,
                    category=cat,
                )
            )

    # Sort by category then name
    items.sort(key=lambda x: (x.category, x.name.lower()))
    return ShoppingList(items=items)
