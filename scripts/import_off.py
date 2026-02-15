#!/usr/bin/env python3
"""Import Open Food Facts data into the food_items table.

Downloads the OFF CSV export and imports packaged/branded foods with barcodes.
OFF has ~3.4M products worldwide — we filter to items with complete nutrition data.

The full CSV is ~7GB uncompressed, so we stream it and only keep items with
complete macro data (calories + protein + carbs + fat all present).

Usage:
    python scripts/import_off.py [--limit 50000] [--db-url sqlite+aiosqlite:///./dev.db]

Data source: https://world.openfoodfacts.org/data
License: Open Database License (ODbL)
"""
from __future__ import annotations

import asyncio
import csv
import gzip
import logging
import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

OFF_CSV_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
CACHE_DIR = Path("data/off_cache")


async def download_csv(url: str) -> Path:
    """Download the OFF CSV (gzipped) with streaming to avoid memory issues."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    gz_path = CACHE_DIR / "products.csv.gz"

    if gz_path.exists() and gz_path.stat().st_size > 1_000_000:
        logger.info("Using cached OFF data from %s (%.0f MB)", gz_path, gz_path.stat().st_size / 1_048_576)
        return gz_path

    logger.info("Downloading OFF product database from %s ...", url)
    logger.info("This is a large file (~2.5GB compressed). Streaming download...")

    async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            downloaded = 0
            with open(gz_path, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=1_048_576):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded / total * 100
                        if downloaded % (50 * 1_048_576) < 1_048_576:
                            logger.info("  Downloaded %.0f MB / %.0f MB (%.0f%%)",
                                        downloaded / 1_048_576, total / 1_048_576, pct)

    logger.info("Download complete: %.0f MB", gz_path.stat().st_size / 1_048_576)
    return gz_path


def parse_off_csv(gz_path: Path, limit: int = 50000) -> list[dict]:
    """Parse the OFF CSV, extracting items with complete nutrition data."""
    logger.info("Parsing OFF CSV (limit=%d items with complete data)...", limit)

    # Increase CSV field size limit for OFF's large ingredient/additive fields
    csv.field_size_limit(10_000_000)

    items = []
    rows_scanned = 0
    skipped_incomplete = 0

    with gzip.open(gz_path, "rt", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="\t")

        for row in reader:
            rows_scanned += 1

            if rows_scanned % 500_000 == 0:
                logger.info("  Scanned %d rows, collected %d items...", rows_scanned, len(items))

            if len(items) >= limit:
                break

            # Extract fields
            name = (row.get("product_name", "") or "").strip()
            barcode = (row.get("code", "") or "").strip()
            brand = (row.get("brands", "") or "").strip()
            categories = (row.get("categories_en", "") or row.get("categories", "") or "").strip()
            countries = (row.get("countries_en", "") or "").strip()

            # Skip items without a name or barcode
            if not name or len(name) < 2 or not barcode or len(barcode) < 8:
                skipped_incomplete += 1
                continue

            # Extract macros (per 100g)
            try:
                calories = float(row.get("energy-kcal_100g", "") or "0")
                protein = float(row.get("proteins_100g", "") or "0")
                carbs = float(row.get("carbohydrates_100g", "") or "0")
                fat = float(row.get("fat_100g", "") or "0")
            except (ValueError, TypeError):
                skipped_incomplete += 1
                continue

            # Skip items with no calorie data or clearly invalid data
            if calories <= 0 or calories > 1000:
                skipped_incomplete += 1
                continue

            # Extract serving size
            serving_str = (row.get("serving_size", "") or "").strip()
            serving_size = 100.0
            serving_unit = "g"
            if serving_str:
                try:
                    # Try to parse "30g" or "250 ml" patterns
                    import re
                    match = re.match(r"([\d.]+)\s*(g|ml|oz|cl|l)", serving_str.lower())
                    if match:
                        serving_size = float(match.group(1))
                        serving_unit = match.group(2)
                except (ValueError, AttributeError):
                    pass

            # Build display name with brand
            display_name = name
            if brand and brand.lower() not in name.lower():
                display_name = f"{name} ({brand})"

            # Truncate long names
            if len(display_name) > 120:
                display_name = display_name[:117] + "..."

            # Extract micronutrients
            micros = {}
            micro_fields = {
                "fiber_100g": "fibre_g",
                "sodium_100g": "sodium_mg",
                "calcium_100g": "calcium_mg",
                "iron_100g": "iron_mg",
                "potassium_100g": "potassium_mg",
                "vitamin-c_100g": "vitamin_c_mg",
                "vitamin-a_100g": "vitamin_a_mcg",
            }
            for off_key, our_key in micro_fields.items():
                val = row.get(off_key, "")
                if val:
                    try:
                        v = float(val)
                        if v > 0:
                            # sodium in OFF is in mg, but stored as g in some entries
                            if off_key == "sodium_100g" and v < 1:
                                v = v * 1000  # convert g to mg
                            micros[our_key] = round(v, 2)
                    except (ValueError, TypeError):
                        pass

            # Add serving options
            micros["_serving_options"] = [
                {"label": "100g", "grams": 100, "is_default": True},
            ]
            if serving_size != 100.0:
                micros["_serving_options"].insert(0, {
                    "label": f"1 serving ({serving_size}{serving_unit})",
                    "grams": serving_size,
                    "is_default": True,
                })
                micros["_serving_options"][1]["is_default"] = False

            # Determine category
            category = "Packaged Food"
            if categories:
                first_cat = categories.split(",")[0].strip()
                if first_cat:
                    category = first_cat[:50]

            items.append({
                "name": display_name,
                "category": category,
                "region": "Global",
                "serving_size": serving_size,
                "serving_unit": serving_unit,
                "calories": round(calories, 1),
                "protein_g": round(protein, 1),
                "carbs_g": round(carbs, 1),
                "fat_g": round(fat, 1),
                "source": "community",
                "barcode": barcode,
                "micro_nutrients": micros if micros else None,
            })

    logger.info("Scanned %d rows total, collected %d items, skipped %d incomplete",
                rows_scanned, len(items), skipped_incomplete)
    return items


async def import_to_db(foods: list[dict], db_url: str) -> int:
    """Bulk insert foods into the database, skipping duplicates by name."""
    from src.shared.base_model import Base
    from src.modules.food_database.models import FoodItem

    engine = create_async_engine(db_url, echo=False)

    # Create tables if needed (SQLite dev mode)
    if "sqlite" in db_url:
        from sqlalchemy import JSON
        from sqlalchemy.dialects.postgresql import JSONB
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
        # Get existing food names and barcodes to skip duplicates
        result = await session.execute(select(FoodItem.name))
        existing_names = {row[0].lower() for row in result.fetchall()}

        result2 = await session.execute(
            select(FoodItem.barcode).where(FoodItem.barcode.isnot(None))
        )
        existing_barcodes = {row[0] for row in result2.fetchall()}

        logger.info("Database has %d existing foods, %d barcodes", len(existing_names), len(existing_barcodes))

        new_items = []
        skipped = 0
        for food in foods:
            # Skip by barcode first (more precise), then by name
            barcode = food.get("barcode")
            if barcode and barcode in existing_barcodes:
                skipped += 1
                continue
            if food["name"].lower() in existing_names:
                skipped += 1
                continue

            item = FoodItem(
                name=food["name"],
                category=food.get("category", "Packaged Food"),
                region=food.get("region", "Global"),
                serving_size=food.get("serving_size", 100.0),
                serving_unit=food.get("serving_unit", "g"),
                calories=food["calories"],
                protein_g=food["protein_g"],
                carbs_g=food["carbs_g"],
                fat_g=food["fat_g"],
                micro_nutrients=food.get("micro_nutrients"),
                source=food.get("source", "community"),
                barcode=barcode,
            )
            new_items.append(item)
            existing_names.add(food["name"].lower())
            if barcode:
                existing_barcodes.add(barcode)

        logger.info("Inserting %d new foods (skipped %d duplicates)...", len(new_items), skipped)

        # Batch insert in chunks of 1000
        BATCH = 1000
        for i in range(0, len(new_items), BATCH):
            batch = new_items[i:i + BATCH]
            session.add_all(batch)
            await session.flush()
            if (i // BATCH) % 10 == 0:
                logger.info("  Inserted %d / %d", i + len(batch), len(new_items))

        await session.commit()
        logger.info("Import complete: %d foods added to database", len(new_items))

    await engine.dispose()
    return len(new_items)


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Import Open Food Facts products into the database")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./dev.db"),
                        help="Database URL (default: sqlite+aiosqlite:///./dev.db)")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max items to import (0 = no limit, import all valid items)")
    parser.add_argument("--file", type=str, default=None,
                        help="Path to local .csv.gz file (skip download)")
    args = parser.parse_args()

    limit = args.limit if args.limit > 0 else 999_999_999

    logger.info("=== Open Food Facts Import ===")
    logger.info("Target DB: %s", args.db_url)
    logger.info("Limit: %s", "no limit" if args.limit == 0 else f"{args.limit:,}")

    # Step 1: Get the CSV file
    if args.file:
        gz_path = Path(args.file)
        if not gz_path.exists():
            logger.error("File not found: %s", gz_path)
            sys.exit(1)
        logger.info("Using local file: %s", gz_path)
    else:
        gz_path = await download_csv(OFF_CSV_URL)

    # Step 2: Parse CSV
    foods = parse_off_csv(gz_path, limit=limit)

    # Step 3: Import to database
    if foods:
        count = await import_to_db(foods, args.db_url)
        logger.info("\n=== Done! %d foods imported ===", count)
    else:
        logger.warning("No valid foods found to import")


if __name__ == "__main__":
    asyncio.run(main())
