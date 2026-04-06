"""Search sub-service — FTS5, LIKE fallback, frequency ranking, and Food DNA personalization."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.models import FoodItem
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)


class SearchService:
    """Handles food item search: FTS5, LIKE fallback, frequency ranking, personalization."""

    _fts_cache: tuple[bool, float] | None = None

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def search(
        self,
        query: str,
        pagination: PaginationParams,
        category: Optional[str] = None,
        region: Optional[str] = None,
        user_prefs: Optional[dict] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> PaginatedResult[Any]:
        """Search food items by name.

        Uses FTS5 on SQLite for fast full-text search (~5ms vs ~3s for LIKE).
        Falls back to LIKE for PostgreSQL or when FTS table doesn't exist.
        When user_id is provided and food_search_ranking flag is enabled,
        applies frequency-based weighted ranking.
        """
        # Try FTS5 path for text queries on SQLite
        if query and await self._has_fts_table():
            result = await self._search_fts(query, pagination, category, region, user_prefs)
        else:
            # Fallback: original LIKE-based search
            result = await self._search_like(query, pagination, category, region, user_prefs)

        # Apply frequency-based re-ranking if user_id provided
        if user_id and result.items:
            result = await self._apply_frequency_ranking(result, user_id)

        return result

    async def _apply_frequency_ranking(
        self,
        result: PaginatedResult[Any],
        user_id: uuid.UUID,
    ) -> PaginatedResult[Any]:
        """Re-rank search results using user food frequency data."""
        import math
        from datetime import datetime, timezone

        try:
            from src.modules.food_database.models import UserFoodFrequency

            item_ids = [item.id for item in result.items if hasattr(item, "id")]
            if not item_ids:
                return result

            stmt = select(UserFoodFrequency).where(
                UserFoodFrequency.user_id == user_id,
                UserFoodFrequency.food_item_id.in_(item_ids),
            )
            freq_result = await self.db.execute(stmt)
            freq_map = {
                f.food_item_id: f for f in freq_result.scalars().all()
            }

            now = datetime.now(timezone.utc)
            frequency_weight = 0.3
            recency_weight = 0.1

            scored: list[tuple[float, int, Any]] = []
            for idx, item in enumerate(result.items):
                base_score = len(result.items) - idx  # preserve original order as base
                freq = freq_map.get(item.id)
                if freq and freq.log_count > 0:
                    freq_bonus = frequency_weight * math.log(1 + freq.log_count)
                    days_since = (
                        (now - freq.last_logged_at).days
                        if freq.last_logged_at
                        else 999
                    )
                    recency_bonus = recency_weight * (1.0 / (1 + days_since / 30))
                    total = base_score + freq_bonus + recency_bonus
                else:
                    total = base_score
                scored.append((total, idx, item))

            scored.sort(key=lambda x: -x[0])
            reranked = [item for _, _, item in scored]

            return PaginatedResult(
                items=reranked,
                total_count=result.total_count,
                page=result.page,
                limit=result.limit,
            )
        except (SQLAlchemyError, TypeError, ValueError) as e:
            # Fallback: return unranked results if frequency scoring fails
            logger.exception("Food search failed")  # Audit fix 10.1
            return result

    async def _get_popular_items(
        self,
        pagination: PaginationParams,
        category: Optional[str] = None,
        region: Optional[str] = None,
        user_prefs: Optional[dict] = None,
    ) -> PaginatedResult[Any]:
        """Return popular items (USDA items) for empty queries."""
        base = select(FoodItem).where(FoodItem.source == "usda")
        base = FoodItem.not_deleted(base)

        if category:
            base = base.where(FoodItem.category == category)
        if region:
            base = base.where(FoodItem.region == region)

        items_stmt = (
            base.order_by(FoodItem.name)
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.db.execute(items_stmt)
        items = list(result.scalars().all())

        if user_prefs:
            items = self._personalize_results(items, user_prefs)

        return PaginatedResult(
            items=items,
            total_count=-1,  # Don't count for popular items
            page=pagination.page,
            limit=pagination.limit,
        )

    async def _has_fts_table(self) -> bool:
        """Check if the FTS5 virtual table exists (cached with 60s TTL).

        FTS5 is SQLite-only — skip the check entirely on PostgreSQL.
        """
        import time
        from sqlalchemy.exc import SQLAlchemyError

        now = time.monotonic()
        cache = SearchService._fts_cache
        if cache is not None and (now - cache[1]) < 60:
            return cache[0]

        try:
            # FTS5 only exists on SQLite — skip on PostgreSQL
            dialect = self.db.bind.dialect.name if self.db.bind else "unknown"
            if dialect != "sqlite":
                SearchService._fts_cache = (False, now)
                return False

            from sqlalchemy import text
            result = await self.db.execute(
                text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='food_items_fts' LIMIT 1")
            )
            available = result.scalar_one_or_none() is not None
        except (SQLAlchemyError, AttributeError):
            available = False
        SearchService._fts_cache = (available, now)
        return available

    async def _search_fts(
        self,
        query: str,
        pagination: PaginationParams,
        category: Optional[str] = None,
        region: Optional[str] = None,
        user_prefs: Optional[dict] = None,
    ) -> PaginatedResult[Any]:
        """FTS5-based search — prefix match first, then full token match.

        Strategy:
        1. Prefix match (query*) — instant, covers typeahead use case
        2. If <limit results, try full token match — catches compound words
        3. Fetch full FoodItem rows by rowid (indexed, ~1ms)
        """
        from sqlalchemy import text

        limit = pagination.limit
        offset = pagination.offset
        # Fetch more candidates from FTS so Python re-ranking can surface exact/USDA matches
        fts_fetch_limit = max(limit * 5, 100)

        # Sanitize query for FTS5: remove special chars, collapse whitespace
        import re
        safe_query = re.sub(r'["*(){}\[\]^~<>|+\-]', ' ', query).strip()
        # Audit fix 6.1 — strip FTS5 boolean operators
        safe_query = re.sub(r'\b(AND|OR|NOT|NEAR)\b', ' ', safe_query, flags=re.IGNORECASE)
        safe_query = ' '.join(safe_query.split())  # collapse whitespace
        if not safe_query:
            # Return popular items (USDA items) for empty queries
            return await self._get_popular_items(pagination, category, region, user_prefs)

        # Build FTS MATCH expression: prefix match on each token
        tokens = safe_query.split()
        prefix_expr = " ".join(f"{t}*" for t in tokens)

        # Optional category/source filter via FTS columns
        fts_filter = ""
        params: dict = {"match_expr": prefix_expr, "limit": fts_fetch_limit, "offset": offset}
        if category:
            fts_filter = " AND fts.category = :category"
            params["category"] = category

        # Step 1: Prefix match with BM25 ranking
        fts_sql = text(f"""
            SELECT fts.rowid
            FROM food_items_fts fts
            WHERE fts.name MATCH :match_expr{fts_filter}
            ORDER BY bm25(food_items_fts)
            LIMIT :limit OFFSET :offset
        """)
        result = await self.db.execute(fts_sql, params)
        rowids = [r[0] for r in result.fetchall()]

        # Step 2: If too few results, try full token match (no prefix)
        if len(rowids) < fts_fetch_limit and len(tokens) == 1:
            full_expr = safe_query
            params2 = {**params, "match_expr": full_expr}
            result2 = await self.db.execute(fts_sql, params2)
            extra_rowids = [r[0] for r in result2.fetchall()]
            seen = set(rowids)
            for rid in extra_rowids:
                if rid not in seen:
                    rowids.append(rid)
                    seen.add(rid)
                    if len(rowids) >= fts_fetch_limit:
                        break

        if not rowids:
            return PaginatedResult(items=[], total_count=-1, page=pagination.page, limit=limit)

        # Step 3: Fetch full rows by rowid using parameterized query
        # Audit fix 10.3 — filter soft-deleted rows
        ph = ",".join(f":rowid_{i}" for i in range(len(rowids)))
        fetch_sql = text(f"""
            SELECT id, name, category, region, serving_size, serving_unit,
                   calories, protein_g, carbs_g, fat_g, micro_nutrients,
                   is_recipe, source, barcode, description, total_servings,
                   created_by, deleted_at, created_at, updated_at
            FROM food_items WHERE rowid IN ({ph}) AND deleted_at IS NULL
        """)
        params = {f"rowid_{i}": rowid for i, rowid in enumerate(rowids)}
        if region:
            fetch_sql = text(f"""
                SELECT id, name, category, region, serving_size, serving_unit,
                       calories, protein_g, carbs_g, fat_g, micro_nutrients,
                       is_recipe, source, barcode, description, total_servings,
                       created_by, deleted_at, created_at, updated_at
                FROM food_items WHERE rowid IN ({ph}) AND deleted_at IS NULL AND region = :region
            """)
            params["region"] = region
        fetch_result = await self.db.execute(fetch_sql, params)
        rows = fetch_result.fetchall()

        # Build a map of id→row for ordering
        row_map: dict = {}
        rowid_to_id: dict = {}
        for row in rows:
            row_map[row[0]] = row  # id is first column

        # Also get rowid→id mapping for ordering — reuse params from fetch query
        id_map_sql = text(
            "SELECT rowid, id FROM food_items WHERE rowid IN ("
            + ",".join(f":rowid_{i}" for i in range(len(rowids)))
            + ")"
        )
        id_result = await self.db.execute(
            id_map_sql, {f"rowid_{i}": rid for i, rid in enumerate(rowids)}
        )
        for r in id_result.fetchall():
            rowid_to_id[r[0]] = r[1]

        # Build ordered FoodItem objects preserving FTS rank
        import json as _json
        from datetime import datetime as _dt
        items = []
        for rid in rowids:
            fid = rowid_to_id.get(rid)
            if fid and fid in row_map:
                row = row_map[fid]
                item = FoodItem()
                item.id = row[0]
                item.name = row[1]
                item.category = row[2]
                item.region = row[3]
                item.serving_size = row[4]
                item.serving_unit = row[5]
                item.calories = row[6]
                item.protein_g = row[7]
                item.carbs_g = row[8]
                item.fat_g = row[9]
                # micro_nutrients may be a JSON string from raw SQL
                mn = row[10]
                item.micro_nutrients = _json.loads(mn) if isinstance(mn, str) else mn
                item.is_recipe = bool(row[11])
                item.source = row[12]
                item.barcode = row[13]
                item.description = row[14]
                item.total_servings = row[15]
                # Parse datetime strings
                ca = row[18]
                item.created_at = _dt.fromisoformat(ca) if isinstance(ca, str) else ca
                ua = row[19]
                item.updated_at = _dt.fromisoformat(ua) if isinstance(ua, str) else ua
                items.append(item)

        # Apply Food DNA personalization
        if user_prefs:
            items = self._personalize_results(items, user_prefs)

        # Re-rank: exact → starts-with → word-match → contains, prefer USDA/verified, shorter names first
        q_lower = query.lower()
        q_words = q_lower.split()
        source_order = {"usda": 0, "verified": 1, "community": 2, "custom": 3}
        def _rank(item: FoodItem) -> tuple:
            n = item.name.lower()
            if n == q_lower:
                tier = 0  # exact match: "apple" == "apple"
            elif n.startswith(q_lower):
                tier = 1  # starts with: "apple juice" starts with "apple"
            elif all(any(w.startswith(qw) for w in n.split()) for qw in q_words):
                tier = 2  # all query words match word starts: "White Bread" for "bread"
            else:
                tier = 3  # substring: "Breadless" contains "bread"
            return (tier, source_order.get(item.source, 9), len(item.name), item.name)
        items.sort(key=_rank)
        items = items[:limit]  # Trim to requested limit after re-ranking

        return PaginatedResult(
            items=items,
            total_count=len(items) if len(items) < limit else -1,  # Estimate: if less than limit, that's the total
            page=pagination.page,
            limit=limit,
        )

    async def _search_like(
        self,
        query: str,
        pagination: PaginationParams,
        category: Optional[str] = None,
        region: Optional[str] = None,
        user_prefs: Optional[dict] = None,
    ) -> PaginatedResult[Any]:
        """Original LIKE-based search — fallback for PostgreSQL or missing FTS."""
        base = select(FoodItem)
        base = FoodItem.not_deleted(base)

        if query:
            escaped = query.replace("%", r"\%").replace("_", r"\_")
            base = base.where(func.lower(FoodItem.name).like(func.lower(f"%{escaped}%"), escape="\\"))

        if category:
            base = base.where(FoodItem.category == category)
        if region:
            base = base.where(FoodItem.region == region)

        total = -1
        if not query:
            count_stmt = select(func.count()).select_from(base.subquery())
            total = (await self.db.execute(count_stmt)).scalar_one()

        if query:
            relevance = case(
                (func.lower(FoodItem.name) == func.lower(query), 0),
                (func.lower(FoodItem.name).like(func.lower(f"{query}%")), 1),
                (func.lower(FoodItem.name).like(func.lower(f"% {query}%")), 2),
                else_=3,
            )
            source_priority = case(
                (FoodItem.source == "usda", 0),
                (FoodItem.source == "verified", 1),
                (FoodItem.source == "community", 2),
                (FoodItem.source == "custom", 3),
                else_=4,
            )
            items_stmt = (
                base.order_by(relevance, func.length(FoodItem.name), source_priority, FoodItem.name)
                .offset(pagination.offset)
                .limit(pagination.limit)
            )
        else:
            source_priority = case(
                (FoodItem.source == "usda", 0),
                (FoodItem.source == "verified", 1),
                (FoodItem.source == "community", 2),
                (FoodItem.source == "custom", 3),
                else_=4,
            )
            items_stmt = (
                base.order_by(source_priority, FoodItem.name)
                .offset(pagination.offset)
                .limit(pagination.limit)
            )
        result = await self.db.execute(items_stmt)
        items = list(result.scalars().all())

        if user_prefs:
            items = self._personalize_results(items, user_prefs)

        return PaginatedResult(
            items=items,
            total_count=total,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Food DNA personalization
    # ------------------------------------------------------------------

    @staticmethod
    def _personalize_results(
        items: list[Any],
        user_prefs: Optional[dict],
    ) -> list[Any]:
        """Re-rank search results based on user's Food DNA preferences.
        
        Boost factors (multiplicative):
          +50% if food.region matches any cuisine_preferences
          +30% if food.source == 'verified'
          +20% if food.source == 'usda'
          -80% if food name contains an allergen keyword
          -50% if food category conflicts with dietary restrictions
        """
        if not user_prefs or not items:
            return items

        cuisine_prefs = {c.lower() for c in (user_prefs.get("cuisine_preferences") or [])}
        restrictions = {r.lower() for r in (user_prefs.get("dietary_restrictions") or [])}
        allergies = {a.lower() for a in (user_prefs.get("allergies") or [])}

        if not cuisine_prefs and not restrictions and not allergies:
            return items

        scored: list[tuple[float, Any]] = []
        for item in items:
            score = 1.0

            # Boost matching cuisines
            region = getattr(item, "region", "") or ""
            if cuisine_prefs and region.lower() in cuisine_prefs:
                score *= 1.5

            # Boost verified/usda sources
            source = getattr(item, "source", "") or ""
            if source == "verified":
                score *= 1.3
            elif source == "usda":
                score *= 1.2

            # Demote allergens
            name_lower = (getattr(item, "name", "") or "").lower()
            for allergen in allergies:
                if allergen in name_lower:
                    score *= 0.2
                    break

            # Demote restricted foods
            cat_lower = (getattr(item, "category", "") or "").lower()
            if restrictions:
                meat_categories = {"meat", "poultry", "seafood", "protein"}
                if "vegetarian" in restrictions and cat_lower in meat_categories:
                    score *= 0.5
                if "vegan" in restrictions and cat_lower in (meat_categories | {"dairy"}):
                    score *= 0.3

            scored.append((score, item))

        scored.sort(key=lambda x: -x[0])
        return [item for _, item in scored]
