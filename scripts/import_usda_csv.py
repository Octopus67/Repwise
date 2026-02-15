#!/usr/bin/env python3
"""Import USDA FoodData Central datasets into the food_items table.

Supports two datasets:
  1. SR Legacy (~7,500 whole foods) — default, always imported
  2. Branded Foods (~380,000 packaged products with barcodes) — opt-in via --branded

Usage:
    python scripts/import_usda_csv.py                    # SR Legacy only
    python scripts/import_usda_csv.py --branded          # SR Legacy + Branded
    python scripts/import_usda_csv.py --branded-only     # Branded only (if SR already imported)

The script is idempotent — it skips foods that already exist by name.

Data source: https://fdc.nal.usda.gov/download-datasets
License: Public domain (US Government work)
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import sys
import zipfile
from pathlib import Path

import httpx

# Add project root to path so we can import our models
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── USDA dataset URLs ─────────────────────────────────────────────────────────
SR_LEGACY_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
BRANDED_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_branded_food_csv_2024-10.zip"
CACHE_DIR = Path("data/usda_cache")

# ── Nutrient ID mapping (USDA nutrient_nbr → our field names) ─────────────────
NUTRIENT_MAP = {
    "203": "protein_g",
    "204": "fat_g",
    "205": "carbs_g",
    "208": "calories",
    "291": "fibre_g",
    "301": "calcium_mg",
    "303": "iron_mg",
    "304": "magnesium_mg",
    "305": "phosphorus_mg",
    "306": "potassium_mg",
    "307": "sodium_mg",
    "309": "zinc_mg",
    "312": "copper_mg",
    "315": "manganese_mg",
    "317": "selenium_mcg",
    "320": "vitamin_a_mcg",
    "401": "vitamin_c_mg",
    "323": "vitamin_e_mg",
    "328": "vitamin_d_mcg",
    "430": "vitamin_k_mcg",
    "404": "thiamin_mg",
    "405": "riboflavin_mg",
    "406": "niacin_mg",
    "415": "vitamin_b6_mg",
    "417": "folate_mcg",
    "418": "vitamin_b12_mcg",
    "601": "cholesterol_mg",
}

MACRO_FIELDS = {"calories", "protein_g", "fat_g", "carbs_g"}


async def download_and_extract(url: str, cache_name: str) -> Path:
    """Download a USDA ZIP file and extract CSVs to cache directory."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = CACHE_DIR / f"{cache_name}.zip"
    extract_dir = CACHE_DIR / cache_name

    if extract_dir.exists() and any(extract_dir.iterdir()):
        logger.info("Using cached data from %s", extract_dir)
        return extract_dir

    logger.info("Downloading %s from %s ...", cache_name, url)
    async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        zip_path.write_bytes(resp.content)
        logger.info("Downloaded %.1f MB", len(resp.content) / 1_048_576)

    logger.info("Extracting ZIP...")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_dir)

    return extract_dir


def find_csv(base_dir: Path, exact_name: str) -> Path:
    """Find a CSV file in the extracted directory tree by exact filename."""
    for p in base_dir.rglob("*.csv"):
        if p.name == exact_name:
            return p
    raise FileNotFoundError(f"No CSV named '{exact_name}' in {base_dir}")


def parse_foods(data_dir: Path, dataset_type: str = "sr_legacy") -> list[dict]:
    """Parse USDA CSV files into our FoodItem format.
    
    dataset_type: 'sr_legacy' or 'branded'
    """
    # 1. Load food descriptions
    food_csv = find_csv(data_dir, "food.csv")
    logger.info("Parsing food descriptions from %s", food_csv.name)

    foods: dict[str, dict] = {}
    with open(food_csv, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row.get("fdc_id", "").strip()
            desc = row.get("description", "").strip()
            category = row.get("food_category_id", "General")
            if fdc_id and desc:
                foods[fdc_id] = {
                    "name": desc.title(),
                    "category": "General",
                    "region": "USDA",
                    "serving_size": 100.0,
                    "serving_unit": "g",
                    "calories": 0.0,
                    "protein_g": 0.0,
                    "carbs_g": 0.0,
                    "fat_g": 0.0,
                    "source": "usda",
                    "barcode": None,
                    "micro_nutrients": {},
                    "_category_id": category,
                }

    logger.info("Found %d food descriptions", len(foods))

    # 2. Load food categories
    try:
        cat_csv = find_csv(data_dir, "food_category.csv")
        categories: dict[str, str] = {}
        with open(cat_csv, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cat_id = row.get("id", "").strip()
                cat_desc = row.get("description", "").strip()
                if cat_id and cat_desc:
                    categories[cat_id] = cat_desc
        for food in foods.values():
            cat_id = food.pop("_category_id", "")
            food["category"] = categories.get(cat_id, "General")
        logger.info("Mapped %d food categories", len(categories))
    except FileNotFoundError:
        logger.warning("No food_category CSV found, using 'General' for all")
        for food in foods.values():
            food.pop("_category_id", None)

    # 3. Load nutrient values
    nutrient_csv = find_csv(data_dir, "food_nutrient.csv")
    logger.info("Parsing nutrient values from %s (this may take a moment)...", nutrient_csv.name)

    # First load nutrient definitions to map nutrient_id → nutrient_nbr
    try:
        ndef_csv = find_csv(data_dir, "nutrient.csv")
        nutrient_id_to_nbr: dict[str, str] = {}
        with open(ndef_csv, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                nid = row.get("id", "").strip()
                nbr = row.get("nutrient_nbr", "").strip()
                if nid and nbr:
                    nutrient_id_to_nbr[nid] = nbr
        logger.info("Loaded %d nutrient definitions", len(nutrient_id_to_nbr))
    except FileNotFoundError:
        nutrient_id_to_nbr = {}
        logger.warning("No nutrient definition CSV found, using nutrient_id directly")

    rows_processed = 0
    with open(nutrient_csv, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row.get("fdc_id", "").strip()
            nutrient_id = row.get("nutrient_id", "").strip()
            amount_str = row.get("amount", "").strip()

            if fdc_id not in foods or not amount_str:
                continue

            try:
                amount = float(amount_str)
            except ValueError:
                continue

            # Map nutrient_id → nutrient_nbr → our field name
            nbr = nutrient_id_to_nbr.get(nutrient_id, nutrient_id)
            field = NUTRIENT_MAP.get(nbr)
            if not field:
                continue

            food = foods[fdc_id]
            if field in MACRO_FIELDS:
                food[field] = round(amount, 2)
            else:
                food["micro_nutrients"][field] = round(amount, 2)

            rows_processed += 1

    logger.info("Processed %d nutrient rows", rows_processed)

    # 4. Load branded food metadata (brand names, barcodes, serving sizes)
    if dataset_type == "branded":
        try:
            branded_csv = find_csv(data_dir, "branded_food.csv")
            logger.info("Loading branded food metadata from %s", branded_csv.name)
            branded_count = 0
            with open(branded_csv, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    fdc_id = row.get("fdc_id", "").strip()
                    if fdc_id not in foods:
                        continue
                    food = foods[fdc_id]
                    brand = row.get("brand_owner", "").strip()
                    brand_name = row.get("brand_name", "").strip()
                    gtin = row.get("gtin_upc", "").strip()
                    serving_str = row.get("serving_size", "").strip()
                    serving_unit = row.get("serving_size_unit", "g").strip()

                    # Prepend brand name to food description for better search
                    if brand_name and brand_name.lower() not in food["name"].lower():
                        food["name"] = f"{food['name']} ({brand_name})"
                    elif brand and brand.lower() not in food["name"].lower():
                        food["name"] = f"{food['name']} ({brand})"

                    # Store barcode
                    if gtin and len(gtin) >= 8:
                        food["barcode"] = gtin

                    # Update serving size if available
                    if serving_str:
                        try:
                            food["serving_size"] = float(serving_str)
                            food["serving_unit"] = serving_unit or "g"
                        except ValueError:
                            pass

                    food["category"] = row.get("branded_food_category", food["category"]) or food["category"]
                    branded_count += 1

            logger.info("Enriched %d branded food items with metadata", branded_count)
        except FileNotFoundError:
            logger.warning("No branded_food.csv found, skipping brand metadata")

    # 5. Filter out foods with no calorie data and clean up
    result = []
    for food in foods.values():
        if food["calories"] <= 0:
            continue
        # Remove empty micro_nutrients
        if not food["micro_nutrients"]:
            food["micro_nutrients"] = None
        # Add default serving options
        if food["micro_nutrients"] is None:
            food["micro_nutrients"] = {}
        food["micro_nutrients"]["_serving_options"] = [
            {"label": "100g", "grams": 100, "is_default": True},
            {"label": "50g", "grams": 50},
            {"label": "200g", "grams": 200},
        ]
        result.append(food)

    logger.info("Final dataset: %d foods with calorie data", len(result))
    return result


async def import_to_db(foods: list[dict], db_url: str) -> int:
    """Bulk insert foods into the database, skipping duplicates by name."""
    from src.shared.base_model import Base
    from src.modules.food_database.models import FoodItem

    engine = create_async_engine(db_url, echo=False)

    # Create tables if they don't exist (for SQLite)
    if "sqlite" in db_url:
        from sqlalchemy import JSON
        from sqlalchemy.dialects.postgresql import JSONB

        # Import all models
        import src.modules.auth.models  # noqa
        import src.modules.user.models  # noqa
        import src.modules.adaptive.models  # noqa
        import src.modules.nutrition.models  # noqa
        import src.modules.meals.models  # noqa
        import src.modules.training.models  # noqa
        import src.modules.payments.models  # noqa
        import src.modules.content.models  # noqa
        import src.modules.coaching.models  # noqa
        import src.modules.food_database.models  # noqa
        import src.modules.feature_flags.models  # noqa
        import src.modules.health_reports.models  # noqa
        import src.modules.founder.models  # noqa
        import src.modules.progress_photos.models  # noqa
        import src.shared.audit  # noqa

        for table in Base.metadata.tables.values():
            for column in table.columns:
                if isinstance(column.type, JSONB):
                    column.type = JSON()
                if column.server_default is not None:
                    default_text = str(column.server_default.arg) if hasattr(column.server_default, "arg") else ""
                    if "::jsonb" in default_text or "gen_random_uuid" in default_text:
                        column.server_default = None

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get existing food names to skip duplicates
        result = await session.execute(select(FoodItem.name))
        existing_names = {row[0].lower() for row in result.fetchall()}
        logger.info("Database has %d existing foods", len(existing_names))

        new_items = []
        skipped = 0
        for food in foods:
            if food["name"].lower() in existing_names:
                skipped += 1
                continue

            item = FoodItem(
                name=food["name"],
                category=food.get("category", "General"),
                region=food.get("region", "USDA"),
                serving_size=food.get("serving_size", 100.0),
                serving_unit=food.get("serving_unit", "g"),
                calories=food["calories"],
                protein_g=food["protein_g"],
                carbs_g=food["carbs_g"],
                fat_g=food["fat_g"],
                micro_nutrients=food.get("micro_nutrients"),
                source="usda",
                barcode=food.get("barcode"),
            )
            new_items.append(item)
            existing_names.add(food["name"].lower())

        logger.info("Inserting %d new foods (skipped %d duplicates)...", len(new_items), skipped)

        # Batch insert in chunks of 500
        BATCH = 500
        for i in range(0, len(new_items), BATCH):
            batch = new_items[i:i + BATCH]
            session.add_all(batch)
            await session.flush()
            logger.info("  Inserted batch %d-%d", i, i + len(batch))

        await session.commit()
        logger.info("Import complete: %d foods added", len(new_items))

    await engine.dispose()
    return len(new_items)


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Import USDA foods into the database")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./dev.db"),
                        help="Database URL (default: sqlite+aiosqlite:///./dev.db)")
    parser.add_argument("--branded", action="store_true",
                        help="Also import USDA Branded Foods (~380K packaged products)")
    parser.add_argument("--branded-only", action="store_true",
                        help="Import only Branded Foods (skip SR Legacy)")
    args = parser.parse_args()

    logger.info("=== USDA Food Database Import ===")
    logger.info("Target DB: %s", args.db_url)

    total_imported = 0

    # Step 1: SR Legacy (whole foods)
    if not args.branded_only:
        logger.info("\n--- SR Legacy (whole foods) ---")
        data_dir = await download_and_extract(SR_LEGACY_URL, "sr_legacy")
        foods = parse_foods(data_dir, "sr_legacy")
        count = await import_to_db(foods, args.db_url)
        total_imported += count

    # Step 2: Branded Foods (packaged products)
    if args.branded or args.branded_only:
        logger.info("\n--- Branded Foods (packaged products) ---")
        logger.info("This is a large download (~420MB). Please be patient...")
        data_dir = await download_and_extract(BRANDED_URL, "branded")
        foods = parse_foods(data_dir, "branded")
        count = await import_to_db(foods, args.db_url)
        total_imported += count

    logger.info("\n=== Done! %d total foods imported ===", total_imported)


if __name__ == "__main__":
    asyncio.run(main())
