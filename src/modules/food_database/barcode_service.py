"""Barcode lookup service with cache-first strategy.

Lookup chain:
1. Check barcode_cache table (O(1) via unique index)
2. Query Open Food Facts API
3. Fallback to USDA FoodData Central
4. Return found=False if all miss

On hit from any external API, the result is cached in barcode_cache
and a FoodItem is created for future search/logging.
"""

from __future__ import annotations
from typing import Optional

import logging
import os

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.food_database.models import BarcodeCache, FoodItem
from src.modules.food_database.off_client import get_product_by_barcode
from src.modules.food_database.schemas import BarcodeResponse, FoodItemResponse
from src.modules.food_database.usda_client import search_usda_foods

logger = logging.getLogger(__name__)


class BarcodeService:
    """Cache-first barcode lookup with OFF → USDA fallback chain."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def lookup_barcode(self, barcode: str) -> BarcodeResponse:
        """Look up a barcode through the cache → OFF → USDA chain."""

        # 1. Check cache
        cached = await self._check_cache(barcode)
        if cached is not None:
            return BarcodeResponse(
                found=True,
                food_item=FoodItemResponse.model_validate(cached),
                source="cache",
            )

        # 2. Try Open Food Facts
        off_result = await get_product_by_barcode(barcode)
        if off_result is not None:
            food_item = await self._create_food_item(off_result, source="off")
            await self._cache_result(barcode, food_item, "off", off_result)
            return BarcodeResponse(
                found=True,
                food_item=FoodItemResponse.model_validate(food_item),
                source="off",
            )

        # 3. Fallback to USDA (search by barcode/UPC)
        usda_result = await self._search_usda(barcode)
        if usda_result is not None:
            food_item = await self._create_food_item(usda_result, source="usda")
            await self._cache_result(barcode, food_item, "usda", usda_result)
            return BarcodeResponse(
                found=True,
                food_item=FoodItemResponse.model_validate(food_item),
                source="usda",
            )

        # 4. Not found anywhere
        return BarcodeResponse(found=False, food_item=None, source=None)

    async def _check_cache(self, barcode: str) -> Optional[FoodItem]:
        """Check barcode_cache for a previously looked-up barcode."""
        stmt = (
            select(BarcodeCache)
            .where(BarcodeCache.barcode == barcode)
        )
        result = await self.db.execute(stmt)
        cache_entry = result.scalar_one_or_none()
        if cache_entry is None:
            return None

        # Load the associated FoodItem
        food_stmt = select(FoodItem).where(FoodItem.id == cache_entry.food_item_id)
        food_result = await self.db.execute(food_stmt)
        return food_result.scalar_one_or_none()

    async def _create_food_item(self, data: dict, source: str) -> FoodItem:
        """Create a FoodItem from normalised API response data."""
        food_item = FoodItem(
            name=data["name"],
            category="Packaged",
            region="Global",
            serving_size=data.get("serving_size", 100.0),
            serving_unit=data.get("serving_unit", "g"),
            calories=data.get("calories", 0),
            protein_g=data.get("protein_g", 0),
            carbs_g=data.get("carbs_g", 0),
            fat_g=data.get("fat_g", 0),
            micro_nutrients=data.get("micro_nutrients"),
            source=source,
            barcode=data.get("barcode"),
        )
        self.db.add(food_item)
        await self.db.flush()
        await self.db.refresh(food_item)
        return food_item

    async def _cache_result(
        self,
        barcode: str,
        food_item: FoodItem,
        source_api: str,
        raw_response: dict,
    ) -> None:
        """Insert into barcode_cache. Handle concurrent inserts gracefully."""
        cache_entry = BarcodeCache(
            barcode=barcode,
            food_item_id=food_item.id,
            source_api=source_api,
            raw_response=raw_response,
        )
        self.db.add(cache_entry)
        try:
            await self.db.flush()
        except IntegrityError:
            # Another concurrent request already cached this barcode — that's fine
            await self.db.rollback()
            logger.debug("Barcode %s already cached by concurrent request", barcode)

    async def _search_usda(self, barcode: str) -> Optional[dict]:
        """Search USDA by barcode/UPC as fallback."""
        api_key = os.environ.get("USDA_API_KEY", "DEMO_KEY")
        try:
            results = await search_usda_foods(
                query=barcode,
                page_size=1,
                api_key=api_key,
            )
            if results:
                result = results[0]
                result["barcode"] = barcode
                return result
        except Exception:
            logger.warning("USDA barcode search failed for %s", barcode, exc_info=True)
        return None
