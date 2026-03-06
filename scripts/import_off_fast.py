#!/usr/bin/env python3
"""
Fast OFF import using bulk INSERT (bypasses SQLAlchemy ORM).
Imports 2.36M Open Food Facts items with streaming CSV parsing.
"""
import asyncio
import csv
import gzip
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

OFF_CSV_PATH = Path("data/off_cache/products.csv.gz")

# Micronutrient field mapping (OFF column → our field)
MICRO_MAP = {
    'fiber_100g': 'fibre_g',
    'sodium_100g': 'sodium_mg',
    'calcium_100g': 'calcium_mg',
    'iron_100g': 'iron_mg',
    'potassium_100g': 'potassium_mg',
    'vitamin-c_100g': 'vitamin_c_mg',
    'vitamin-a_100g': 'vitamin_a_mcg',
}

def parse_off_csv(limit=None):
    """Stream parse OFF CSV, extract items with complete macro data."""
    print(f"Parsing OFF CSV (streaming)...")
    csv.field_size_limit(10_000_000)
    
    items = []
    rows_scanned = 0
    
    with gzip.open(OFF_CSV_PATH, 'rt', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f, delimiter='\t')
        
        for row in reader:
            rows_scanned += 1
            
            if rows_scanned % 100000 == 0:
                print(f"  Scanned {rows_scanned:,} rows, collected {len(items):,} items...")
            
            # Skip if missing required fields
            if not all([row.get('product_name'), row.get('energy-kcal_100g'), 
                       row.get('proteins_100g'), row.get('carbohydrates_100g'), row.get('fat_100g')]):
                continue
            
            try:
                calories = float(row['energy-kcal_100g'])
                protein = float(row['proteins_100g'])
                carbs = float(row['carbohydrates_100g'])
                fat = float(row['fat_100g'])
                
                if calories <= 0:
                    continue
                
                # Extract micronutrients
                micros = {}
                for off_key, our_key in MICRO_MAP.items():
                    val = row.get(off_key, '')
                    if val:
                        try:
                            # OFF uses grams for everything, convert mg fields
                            num = float(val)
                            if our_key.endswith('_mg'):
                                num *= 1000  # g → mg
                            elif our_key.endswith('_mcg'):
                                num *= 1000000  # g → mcg
                            micros[our_key] = num
                        except:
                            pass
                
                micros['_serving_options'] = [{'size': 100, 'unit': 'g', 'label': '100g'}]
                
                items.append({
                    'name': row['product_name'][:500],  # Truncate to fit column
                    'category': row.get('categories_en', 'Packaged Food')[:100],
                    'calories': calories,
                    'protein_g': protein,
                    'carbs_g': carbs,
                    'fat_g': fat,
                    'barcode': row.get('code', '')[:50] or None,
                    'micros': micros,
                })
                
                if limit and len(items) >= limit:
                    break
                    
            except (ValueError, KeyError):
                continue
    
    print(f"Scanned {rows_scanned:,} rows, collected {len(items):,} items")
    return items

async def bulk_insert(foods, db_url):
    """Bulk insert using multi-row VALUES."""
    engine = create_async_engine(db_url, pool_size=5, max_overflow=10)
    
    async with engine.begin() as conn:
        # Get existing names to skip duplicates
        result = await conn.execute(text("SELECT name FROM food_items"))
        existing_names = {row[0] for row in result}
        print(f"Loaded {len(existing_names):,} existing names")
        
        new_foods = [f for f in foods if f['name'] not in existing_names]
        print(f"Inserting {len(new_foods):,} new foods (skipped {len(foods) - len(new_foods):,} duplicates)...")
        
        batch_size = 250  # Reduced to stay under PostgreSQL 65535 param limit
        total_batches = (len(new_foods) - 1) // batch_size + 1
        
        for i in range(0, len(new_foods), batch_size):
            batch = new_foods[i:i+batch_size]
            
            values_parts = []
            params = {}
            
            for idx, food in enumerate(batch):
                base = f"b{idx}_"
                item_id = uuid.uuid4()
                now = datetime.utcnow()
                
                values_parts.append(f"(:{base}id, :{base}name, :{base}category, :{base}region, :{base}serving_size, :{base}serving_unit, :{base}calories, :{base}protein_g, :{base}carbs_g, :{base}fat_g, CAST(:{base}micro_nutrients AS jsonb), :{base}source, :{base}barcode, :{base}is_recipe, :{base}created_at, :{base}updated_at)")
                
                params.update({
                    f"{base}id": item_id,
                    f"{base}name": food['name'],
                    f"{base}category": food['category'],
                    f"{base}region": "Global",
                    f"{base}serving_size": 100.0,
                    f"{base}serving_unit": "g",
                    f"{base}calories": food['calories'],
                    f"{base}protein_g": food['protein_g'],
                    f"{base}carbs_g": food['carbs_g'],
                    f"{base}fat_g": food['fat_g'],
                    f"{base}micro_nutrients": json.dumps(food['micros']),
                    f"{base}source": "community",
                    f"{base}barcode": food['barcode'],
                    f"{base}is_recipe": False,
                    f"{base}created_at": now,
                    f"{base}updated_at": now,
                })
            
            sql = f"""
                INSERT INTO food_items (
                    id, name, category, region, serving_size, serving_unit,
                    calories, protein_g, carbs_g, fat_g, micro_nutrients,
                    source, barcode, is_recipe, created_at, updated_at
                ) VALUES {', '.join(values_parts)}
                ON CONFLICT (barcode) DO NOTHING
            """
            
            await conn.execute(text(sql), params)
            
            if (i // batch_size + 1) % 10 == 0:
                print(f"  Batch {i//batch_size + 1}/{total_batches} ({i + len(batch):,} items)")
        
        print(f"✓ Imported {len(new_foods):,} OFF foods")
    
    await engine.dispose()
    return len(new_foods)

async def main():
    db_url = "postgresql+asyncpg://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require"
    
    print("=== Open Food Facts Import ===")
    print(f"Target DB: Neon production")
    print()
    
    if not OFF_CSV_PATH.exists():
        print(f"ERROR: {OFF_CSV_PATH} not found")
        print("Download it first: wget https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz -P data/off_cache/")
        sys.exit(1)
    
    foods = parse_off_csv(limit=None)  # No limit = all 2.36M
    count = await bulk_insert(foods, db_url)
    
    print(f"\n✓ Import complete: {count:,} new items added")
    print(f"Total database size: ~{8034 + count:,} items")

if __name__ == "__main__":
    asyncio.run(main())
