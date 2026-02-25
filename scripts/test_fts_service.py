"""Test FTS search service in isolation."""
import asyncio
from sqlalchemy import text, select
from src.config.database import async_session_factory
from src.modules.food_database.models import FoodItem


async def test():
    async with async_session_factory() as session:
        # Step 1: FTS rowids
        result = await session.execute(
            text("SELECT rowid FROM food_items_fts WHERE name MATCH :m ORDER BY bm25(food_items_fts) LIMIT :l OFFSET :o"),
            {"m": "apple*", "l": 5, "o": 0},
        )
        rowids = [r[0] for r in result.fetchall()]
        print(f"rowids: {rowids}")

        if not rowids:
            print("No FTS results")
            return

        # Step 2: rowid → id mapping
        ph = ",".join(str(r) for r in rowids)
        id_result = await session.execute(text(f"SELECT rowid, id FROM food_items WHERE rowid IN ({ph})"))
        all_ids = []
        rowid_to_id = {}
        for r in id_result.fetchall():
            rowid_to_id[r[0]] = r[1]
            all_ids.append(r[1])
        print(f"ids: {all_ids[:3]}, type: {type(all_ids[0]) if all_ids else 'N/A'}")

        # Step 3: ORM fetch
        try:
            stmt = select(FoodItem).where(FoodItem.id.in_(all_ids))
            result = await session.execute(stmt)
            items = list(result.scalars().all())
            print(f"ORM fetch: {len(items)} items")
            for item in items[:3]:
                print(f"  {item.name} ({item.calories}kcal)")
        except Exception as e:
            print(f"ORM error: {type(e).__name__}: {e}")


asyncio.run(test())
