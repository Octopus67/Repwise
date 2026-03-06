#!/usr/bin/env python3
"""
Fast USDA import using raw SQL (bypasses SQLAlchemy ORM foreign key issues).
Imports ~7,890 USDA SR Legacy items with full micronutrient data in ~2 minutes.
"""
import asyncio
import csv
import json
import sys
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

SR_LEGACY_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
CACHE_DIR = Path("data/usda_cache")

NUTRIENT_MAP = {
    "203": "protein_g", "204": "fat_g", "205": "carbs_g", "208": "calories",
    "291": "fibre_g", "307": "sodium_mg", "301": "calcium_mg", "303": "iron_mg",
    "306": "potassium_mg", "304": "magnesium_mg", "309": "zinc_mg", "305": "phosphorus_mg",
    "320": "vitamin_a_mcg", "401": "vitamin_c_mg", "328": "vitamin_d_mcg",
    "323": "vitamin_e_mg", "430": "vitamin_k_mcg", "415": "vitamin_b6_mg",
    "418": "vitamin_b12_mcg", "417": "folate_mcg", "601": "cholesterol_mg",
    "851": "omega_3_g", "317": "selenium_mcg", "404": "thiamin_mg",
    "315": "manganese_mg", "312": "copper_mg", "421": "choline_mg",
}

async def download_and_parse():
    cache_dir = CACHE_DIR / "sr_legacy"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    food_csv = cache_dir / "FoodData_Central_sr_legacy_food_csv_2018-04" / "food.csv"
    nutrient_csv = cache_dir / "FoodData_Central_sr_legacy_food_csv_2018-04" / "food_nutrient.csv"
    nutrient_def_csv = cache_dir / "FoodData_Central_sr_legacy_food_csv_2018-04" / "nutrient.csv"
    
    if not food_csv.exists() or not nutrient_csv.exists():
        print(f"Downloading USDA SR Legacy dataset...")
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.get(SR_LEGACY_URL)
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                z.extractall(cache_dir)
        print(f"✓ Downloaded and extracted to {cache_dir}")
    else:
        print(f"Using cached data from {cache_dir}")
    
    # Load nutrient ID to nutrient_nbr mapping
    nutrient_id_to_nbr = {}
    with open(nutrient_def_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            nid = row['id']
            nbr = row.get('nutrient_nbr', '').strip()
            if nbr:
                nutrient_id_to_nbr[nid] = nbr
    print(f"Loaded {len(nutrient_id_to_nbr)} nutrient definitions")
    
    # Parse food descriptions
    foods = {}
    with open(food_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row['fdc_id']
            foods[fdc_id] = {
                'name': row['description'],
                'category': row.get('food_category_id', 'General'),
                'calories': 0.0,
                'protein_g': 0.0,
                'carbs_g': 0.0,
                'fat_g': 0.0,
                'micros': {},
            }
    
    print(f"Found {len(foods)} food descriptions")
    
    # Parse nutrients
    with open(nutrient_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row['fdc_id']
            if fdc_id not in foods:
                continue
            
            nutrient_id = row['nutrient_id']
            nutrient_nbr = nutrient_id_to_nbr.get(nutrient_id, '')
            amount = float(row['amount']) if row['amount'] else 0.0
            
            if nutrient_nbr in NUTRIENT_MAP:
                field = NUTRIENT_MAP[nutrient_nbr]
                if field in ('calories', 'protein_g', 'carbs_g', 'fat_g'):
                    foods[fdc_id][field] = amount
                else:
                    foods[fdc_id]['micros'][field] = amount
    
    # Filter to items with calorie data
    valid_foods = [f for f in foods.values() if f['calories'] > 0]
    print(f"Final dataset: {len(valid_foods)} foods with calorie data")
    
    return valid_foods

async def import_to_neon(foods, db_url):
    engine = create_async_engine(db_url)
    
    async with engine.begin() as conn:
        # Check existing count
        result = await conn.execute(text("SELECT COUNT(*) FROM food_items"))
        existing = result.scalar()
        print(f"Database has {existing} existing foods")
        
        # Get existing names to skip duplicates
        result = await conn.execute(text("SELECT name FROM food_items"))
        existing_names = {row[0] for row in result}
        print(f"Loaded {len(existing_names)} existing names")
        
        new_foods = [f for f in foods if f['name'] not in existing_names]
        print(f"Inserting {len(new_foods)} new foods (skipped {len(foods) - len(new_foods)} duplicates)...")
        
        batch_size = 500
        total_batches = (len(new_foods) - 1) // batch_size + 1
        
        for i in range(0, len(new_foods), batch_size):
            batch = new_foods[i:i+batch_size]
            
            # Build bulk INSERT with VALUES
            values_parts = []
            params = {}
            
            for idx, food in enumerate(batch):
                base_key = f"b{idx}_"
                item_id = uuid.uuid4()
                now = datetime.utcnow()
                
                micros = food['micros'].copy()
                micros['_serving_options'] = [{'size': 100, 'unit': 'g', 'label': '100g'}]
                
                values_parts.append(f"(:{base_key}id, :{base_key}name, :{base_key}category, :{base_key}region, :{base_key}serving_size, :{base_key}serving_unit, :{base_key}calories, :{base_key}protein_g, :{base_key}carbs_g, :{base_key}fat_g, CAST(:{base_key}micro_nutrients AS jsonb), :{base_key}source, :{base_key}is_recipe, :{base_key}created_at, :{base_key}updated_at)")
                
                params[f"{base_key}id"] = item_id
                params[f"{base_key}name"] = food['name']
                params[f"{base_key}category"] = food['category']
                params[f"{base_key}region"] = "USDA"
                params[f"{base_key}serving_size"] = 100.0
                params[f"{base_key}serving_unit"] = "g"
                params[f"{base_key}calories"] = food['calories']
                params[f"{base_key}protein_g"] = food['protein_g']
                params[f"{base_key}carbs_g"] = food['carbs_g']
                params[f"{base_key}fat_g"] = food['fat_g']
                params[f"{base_key}micro_nutrients"] = json.dumps(micros)
                params[f"{base_key}source"] = "usda"
                params[f"{base_key}is_recipe"] = False
                params[f"{base_key}created_at"] = now
                params[f"{base_key}updated_at"] = now
            
            sql = f"""
                INSERT INTO food_items (
                    id, name, category, region, serving_size, serving_unit,
                    calories, protein_g, carbs_g, fat_g, micro_nutrients,
                    source, is_recipe, created_at, updated_at
                ) VALUES {', '.join(values_parts)}
            """
            
            await conn.execute(text(sql), params)
            print(f"  Batch {i//batch_size + 1}/{total_batches} ({len(batch)} items)")
        
        print(f"✓ Imported {len(new_foods)} USDA foods")
    
    await engine.dispose()
    return len(new_foods)

async def main():
    db_url = "postgresql+asyncpg://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require"
    
    print("=== USDA SR Legacy Import ===")
    print(f"Target DB: {db_url}")
    print()
    
    foods = await download_and_parse()
    count = await import_to_neon(foods, db_url)
    
    print(f"\n✓ Import complete: {count} new items added")

if __name__ == "__main__":
    import io
    asyncio.run(main())
