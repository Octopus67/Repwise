#!/usr/bin/env python3
"""Update micronutrient data for sparse foods in production Neon DB.

Usage: DATABASE_URL='postgresql+asyncpg://...' python scripts/update_production_micros.py
"""
import asyncio
import json
import os
import sys
import glob

sys.path.insert(0, '.')

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set")
    print("Usage: DATABASE_URL='postgresql+asyncpg://...' python scripts/update_production_micros.py")
    sys.exit(1)


async def update_micros():
    """Update sparse food items with enriched micronutrient data."""
    # Load all enriched micro data from batch outputs
    micro_files = sorted(glob.glob('/tmp/food_batches/micro_*.json'))
    if not micro_files:
        print("ERROR: No micro batch files found in /tmp/food_batches/")
        sys.exit(1)

    all_micros = {}
    for fpath in micro_files:
        with open(fpath) as f:
            batch = json.load(f)
        for item in batch:
            name = item['name']
            micros = item.get('micro_nutrients', {})
            if micros and len(micros) >= 10:
                all_micros[name] = micros

    print(f"Loaded {len(all_micros)} enriched food items from {len(micro_files)} batch files")

    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        # Check current state
        result = await conn.execute(text("SELECT COUNT(*) FROM food_items WHERE deleted_at IS NULL"))
        total = result.scalar()
        print(f"Total food items in production: {total}")

        # Find sparse foods
        result = await conn.execute(text(
            "SELECT id, name, micro_nutrients FROM food_items WHERE deleted_at IS NULL"
        ))
        rows = result.fetchall()

        sparse = []
        for row in rows:
            micro = row[2]
            if micro is None or micro == {} or micro == 'null':
                sparse.append(row)
                continue
            if isinstance(micro, str):
                try:
                    data = json.loads(micro)
                except:
                    sparse.append(row)
                    continue
            else:
                data = micro
            real_keys = [k for k in data.keys() if not k.startswith('_')]
            if len(real_keys) <= 5:
                sparse.append(row)

        print(f"Sparse foods in production (<=5 micro keys): {len(sparse)}")

        # Update each sparse food that we have enriched data for
        updated = 0
        not_found = 0
        for row in sparse:
            food_id, name, existing_raw = row
            if name not in all_micros:
                not_found += 1
                continue

            # Parse existing micros
            if existing_raw is None or existing_raw == 'null':
                existing = {}
            elif isinstance(existing_raw, str):
                try:
                    existing = json.loads(existing_raw)
                except:
                    existing = {}
            else:
                existing = existing_raw if isinstance(existing_raw, dict) else {}

            # Merge: new micros overwrite, preserve _serving_options
            merged = {**existing}
            for k, v in all_micros[name].items():
                if not k.startswith('_'):
                    merged[k] = v

            # Update in DB
            await conn.execute(
                text("UPDATE food_items SET micro_nutrients = :micros WHERE id = :id"),
                {"micros": json.dumps(merged), "id": str(food_id)}
            )
            updated += 1

        print(f"Updated: {updated}")
        print(f"Not found in enriched data: {not_found}")

        # Verify
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM food_items WHERE deleted_at IS NULL"
        ))
        final_total = result.scalar()
        print(f"Final total: {final_total} (unchanged)")

    await engine.dispose()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(update_micros())
