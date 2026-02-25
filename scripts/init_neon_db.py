#!/usr/bin/env python
"""Initialize Neon database with all base tables.

Run this ONCE before running alembic migrations.
Usage: python scripts/init_neon_db.py
"""
import asyncio
import sys
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

# Import Base and all models so metadata knows about every table
from src.shared.base_model import Base
import src.modules.auth.models
import src.modules.user.models
import src.modules.adaptive.models
import src.modules.nutrition.models
import src.modules.meals.models
import src.modules.training.models
import src.modules.payments.models
import src.modules.content.models
import src.modules.coaching.models
import src.modules.food_database.models
import src.modules.feature_flags.models
import src.modules.health_reports.models
import src.modules.founder.models
import src.modules.progress_photos.models
import src.modules.achievements.models
import src.modules.recomp.models
import src.modules.meal_plans.models
import src.modules.periodization.models
import src.modules.notifications.models

async def init_db(database_url: str):
    """Create all tables in the database."""
    engine = create_async_engine(database_url, echo=True)
    
    async with engine.begin() as conn:
        print("Enabling pg_trgm extension...")
        await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        print("✓ Extension enabled")
        
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("✓ All tables created successfully")
    
    await engine.dispose()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/init_neon_db.py <DATABASE_URL>")
        print("Example: python scripts/init_neon_db.py 'postgresql+asyncpg://user:pass@host/db?ssl=require'")
        sys.exit(1)
    
    database_url = sys.argv[1]
    asyncio.run(init_db(database_url))
