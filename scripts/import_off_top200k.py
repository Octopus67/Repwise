#!/usr/bin/env python3
"""Import top 200K Open Food Facts items by scan count into Neon."""
import asyncio, csv, gzip, json, os, sys, uuid
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

OFF_CSV = Path("data/off_cache/products.csv.gz")
TARGET = 200_000
BATCH = 500
csv.field_size_limit(10_000_000)

MICRO_MAP = {
    'fiber_100g': 'fibre_g', 'sodium_100g': 'sodium_mg',
    'calcium_100g': 'calcium_mg', 'iron_100g': 'iron_mg',
    'potassium_100g': 'potassium_mg', 'vitamin-c_100g': 'vitamin_c_mg',
    'vitamin-a_100g': 'vitamin_a_mcg',
}

def parse_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def stream_top_products():
    """Stream OFF CSV, collect items with calories, sort by scans, yield top N."""
    print(f"Streaming {OFF_CSV} to find top {TARGET:,} products...")
    items = []
    skipped = 0
    with gzip.open(OFF_CSV, 'rt', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for i, row in enumerate(reader):
            if i % 500_000 == 0 and i > 0:
                print(f"  Scanned {i:,} rows, kept {len(items):,}...")
            
            name = (row.get('product_name') or '').strip()
            cal = parse_float(row.get('energy-kcal_100g') or row.get('energy_100g'))
            scans_raw = row.get('unique_scans_n') or '0'
            try:
                scans = int(float(scans_raw))
            except (ValueError, TypeError):
                skipped += 1
                continue
            
            # Skip items without name, calories, or scans
            if not name or cal <= 0 or scans <= 0:
                skipped += 1
                continue
            
            # Skip very long names (junk data)
            if len(name) > 200:
                skipped += 1
                continue
            
            protein = parse_float(row.get('proteins_100g'))
            carbs = parse_float(row.get('carbohydrates_100g'))
            fat = parse_float(row.get('fat_100g'))
            barcode = (row.get('code') or '').strip() or None
            
            micros = {}
            for off_key, our_key in MICRO_MAP.items():
                v = parse_float(row.get(off_key))
                if v > 0:
                    micros[our_key] = round(v, 2)
            
            items.append({
                'name': name[:500],
                'calories': round(cal, 1),
                'protein_g': round(protein, 1),
                'carbs_g': round(carbs, 1),
                'fat_g': round(fat, 1),
                'barcode': barcode,
                'micros': micros,
                'scans': scans,
            })
    
    print(f"Scanned complete: {i+1:,} total rows, {len(items):,} valid, {skipped:,} skipped")
    
    # Sort by scans descending, take top N
    items.sort(key=lambda x: x['scans'], reverse=True)
    top = items[:TARGET]
    print(f"Top {len(top):,} items by scan count (min scans: {top[-1]['scans'] if top else 0})")
    return top

async def import_to_neon(foods, db_url):
    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        r = await conn.execute(text("SELECT name FROM food_items"))
        existing = {row[0] for row in r}
        print(f"Existing items in DB: {len(existing):,}")
        
        new = [f for f in foods if f['name'] not in existing]
        print(f"New items to insert: {len(new):,} (skipping {len(foods)-len(new):,} dupes)")
        
        total_batches = (len(new) - 1) // BATCH + 1
        for i in range(0, len(new), BATCH):
            batch = new[i:i+BATCH]
            values, params = [], {}
            for idx, food in enumerate(batch):
                k = f"b{idx}_"
                now = datetime.utcnow()
                micros = food['micros'].copy()
                micros['_serving_options'] = [{'size': 100, 'unit': 'g', 'label': '100g'}]
                
                values.append(f"(:{k}id, :{k}name, :{k}cat, :{k}reg, 100.0, 'g', :{k}cal, :{k}p, :{k}c, :{k}f, CAST(:{k}m AS jsonb), 'off', false, :{k}bc, :{k}t, :{k}t)")
                params[f"{k}id"] = uuid.uuid4()
                params[f"{k}name"] = food['name']
                params[f"{k}cat"] = "Packaged"
                params[f"{k}reg"] = "Global"
                params[f"{k}cal"] = food['calories']
                params[f"{k}p"] = food['protein_g']
                params[f"{k}c"] = food['carbs_g']
                params[f"{k}f"] = food['fat_g']
                params[f"{k}m"] = json.dumps(micros)
                params[f"{k}bc"] = food['barcode']
                params[f"{k}t"] = now
            
            sql = f"""INSERT INTO food_items (id, name, category, region, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, micro_nutrients, source, is_recipe, barcode, created_at, updated_at) VALUES {', '.join(values)}"""
            await conn.execute(text(sql), params)
            
            bn = i // BATCH + 1
            if bn % 20 == 0 or bn == total_batches:
                print(f"  Batch {bn}/{total_batches}")
        
        print(f"✓ Imported {len(new):,} OFF items")
    await engine.dispose()
    return len(new)

async def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: Set DATABASE_URL"); sys.exit(1)
    
    foods = stream_top_products()
    count = await import_to_neon(foods, db_url)
    print(f"\n✓ Done: {count:,} new items added")

if __name__ == "__main__":
    asyncio.run(main())
