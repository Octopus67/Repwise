#!/usr/bin/env python3
"""Seed production Neon database with enriched food items."""
import asyncio
import json
import sys
import uuid
from datetime import datetime

sys.path.insert(0, '.')

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

from src.modules.food_database.seed_data import INDIAN_FOOD_ITEMS
from src.modules.food_database.global_seed_data import GLOBAL_FOOD_ITEMS

DATABASE_URL = "postgresql+asyncpg://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require"

async def seed():
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Check current count
        result = await conn.execute(text("SELECT COUNT(*) FROM food_items"))
        count = result.scalar()
        print(f"Current food_items: {count}")
        
        if count > 0:
            print("Database already seeded, skipping")
            return
        
        all_items = list(INDIAN_FOOD_ITEMS) + list(GLOBAL_FOOD_ITEMS)
        print(f"Seeding {len(all_items)} items...")
        
        for item in all_items:
            item_id = uuid.uuid4()
            now = datetime.utcnow()
            
            await conn.execute(text("""
                INSERT INTO food_items (
                    id, name, category, region, serving_size, serving_unit,
                    calories, protein_g, carbs_g, fat_g, micro_nutrients, source,
                    is_recipe, created_at, updated_at
                ) VALUES (
                    :id, :name, :category, :region, :serving_size, :serving_unit,
                    :calories, :protein_g, :carbs_g, :fat_g, CAST(:micro_nutrients AS jsonb), :source,
                    :is_recipe, :created_at, :updated_at
                )
            """), {
                "id": item_id,
                "name": item["name"],
                "category": item.get("category", "General"),
                "region": item.get("region", "Global"),
                "serving_size": item.get("serving_size", 100.0),
                "serving_unit": item.get("serving_unit", "g"),
                "calories": item["calories"],
                "protein_g": item["protein_g"],
                "carbs_g": item["carbs_g"],
                "fat_g": item["fat_g"],
                "micro_nutrients": json.dumps(item.get("micro_nutrients", {})),
                "source": item.get("source", "verified"),
                "is_recipe": False,
                "created_at": now,
                "updated_at": now,
            })
        
        print(f"✓ Seeded {len(all_items)} items to production")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
