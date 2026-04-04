"""Global food database seed data — 145 common foods with USDA-sourced nutritional data."""

import json
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "global_food_items.json"


def _load_global_food_items() -> list[dict]:
    with open(_DATA_FILE) as f:
        return json.load(f)


try:
    GLOBAL_FOOD_ITEMS: list[dict] = _load_global_food_items()
except (FileNotFoundError, json.JSONDecodeError) as e:
    raise RuntimeError(f"Failed to load global food items data: {e}") from e
