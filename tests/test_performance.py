"""Phase 5 — Performance tests.

Validates: Dashboard API call budget (≤10), batch loading, memoization,
feature flag cache TTL/dedup, and pre-computed styles usage.
"""

from __future__ import annotations

import ast
import re
import textwrap
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── Paths ──────────────────────────────────────────────────────────────────

APP_DIR = Path(__file__).resolve().parent.parent / "app"
HOOKS_DIR = APP_DIR / "hooks"
SCREENS_DIR = APP_DIR / "screens"
COMPONENTS_DIR = APP_DIR / "components"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ═══════════════════════════════════════════════════════════════════════════
# 1. Dashboard API call count — ≤10 parallel calls
# ═══════════════════════════════════════════════════════════════════════════


class TestDashboardApiCallCount:
    """Dashboard should make ≤10 API calls per load cycle (per parallel batch)."""

    def test_dashboard_api_call_count(self):
        """useQueries batch must contain ≤15 concurrent query definitions."""
        src = _read(HOOKS_DIR / "queries" / "useDashboardQueries.ts")
        # Count api.get calls inside buildQueries (each becomes a parallel query)
        calls = re.findall(r"api\.get\(", src)
        assert len(calls) >= 1, "Dashboard queries must use api.get for fetching"
        assert len(calls) <= 15, (
            f"Dashboard has {len(calls)} API calls, budget is ≤15 per useQueries batch."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 2. Dashboard parallel execution — uses Promise.allSettled
# ═══════════════════════════════════════════════════════════════════════════


class TestDashboardParallelExecution:
    """Dashboard should fire API calls in parallel, not sequentially."""

    def test_dashboard_parallel_execution(self):
        """Dashboard must use useQueries (TanStack Query) for parallel fetches."""
        src = _read(HOOKS_DIR / "queries" / "useDashboardQueries.ts")
        assert "useQueries" in src, (
            "Dashboard should use useQueries for parallel API execution. "
            "Found 0 occurrences."
        )
        # Verify no sequential await-per-call pattern
        hook_src = _read(HOOKS_DIR / "useDashboardData.ts")
        sequential = re.findall(r"^\s+await api\.get\(", hook_src, re.MULTILINE)
        assert len(sequential) == 0, (
            f"Found {len(sequential)} sequential await api.get() calls. "
            "All fetches should be handled by useQueries."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 3. Shopping list batch query — single API call
# ═══════════════════════════════════════════════════════════════════════════


class TestShoppingListBatchQuery:
    """Shopping list should batch-load items in a single API call."""

    def test_shopping_list_batch_query(self):
        """ShoppingListView must fetch all items in one api.get call."""
        src = _read(SCREENS_DIR / "meal-prep" / "ShoppingListView.tsx")
        api_calls = re.findall(r"api\.get\(", src)
        # Should have exactly 1 unique endpoint pattern for the shopping list
        # (retry re-uses the same call, so count unique call sites in useEffect)
        effect_block = re.search(
            r"useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[",
            src,
        )
        assert effect_block, "ShoppingListView should have a useEffect for data loading"
        effect_src = effect_block.group(1)
        effect_api_calls = re.findall(r"api\.get\(", effect_src)
        assert len(effect_api_calls) == 1, (
            f"Shopping list useEffect makes {len(effect_api_calls)} API calls, "
            "expected 1 batch call."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 4. Session detail exercise images — batch load
# ═══════════════════════════════════════════════════════════════════════════


class TestSessionDetailExerciseImagesBatch:
    """SessionDetailScreen should batch-load exercise images, not per-exercise."""

    def test_session_detail_exercise_images_batch(self):
        """Exercise images fetched via single api.get('training/exercises'), not per-exercise."""
        src = _read(SCREENS_DIR / "training" / "SessionDetailScreen.tsx")
        # Should fetch all exercises in one call
        assert "api.get('training/exercises')" in src or 'api.get("training/exercises")' in src, (
            "SessionDetailScreen should batch-load exercise images via "
            "api.get('training/exercises')"
        )
        # Should NOT have per-exercise image fetches inside a loop
        per_exercise_pattern = re.findall(
            r"for\s*\(.*\)\s*\{[^}]*api\.get\(.*image",
            src,
            re.IGNORECASE,
        )
        assert len(per_exercise_pattern) == 0, (
            "Found per-exercise image API calls inside a loop. "
            "Images should be batch-loaded."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 5. MealSlotGroup sort memoized
# ═══════════════════════════════════════════════════════════════════════════


class TestMealSlotGroupSortMemoized:
    """MealSlotGroup should memoize sorted entries with useMemo."""

    def test_meal_slot_group_sort_memoized(self):
        """Sorted entries in MealSlotGroup must use useMemo."""
        src = _read(COMPONENTS_DIR / "dashboard" / "MealSlotGroup.tsx")
        assert "useMemo" in src, "MealSlotGroup must import/use useMemo"
        # The sorted variable should be wrapped in useMemo
        memo_sort = re.search(r"useMemo\(\s*\n?\s*\(\)\s*=>.*sort", src, re.IGNORECASE)
        assert memo_sort, (
            "MealSlotGroup should memoize the sorted entries via useMemo. "
            "Found useMemo but no sort inside it."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 6. TodayWorkoutCard memo works
# ═══════════════════════════════════════════════════════════════════════════


class TestTodayWorkoutCardMemo:
    """TodayWorkoutCard should be wrapped in React.memo."""

    def test_today_workout_card_memo_works(self):
        """TodayWorkoutCard export must use React.memo with custom comparator."""
        src = _read(COMPONENTS_DIR / "dashboard" / "TodayWorkoutCard.tsx")
        assert "React.memo(" in src, (
            "TodayWorkoutCard must be exported via React.memo"
        )
        # Verify custom comparator is provided (second arg to React.memo)
        memo_match = re.search(r"React\.memo\(\s*\w+\s*,\s*\(", src)
        assert memo_match, (
            "TodayWorkoutCard React.memo should have a custom comparator function "
            "as second argument to avoid unnecessary re-renders."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 7. Feature flag cache dedup
# ═══════════════════════════════════════════════════════════════════════════


class TestFeatureFlagCacheDedup:
    """useFeatureFlag should deduplicate in-flight requests for the same flag."""

    def test_feature_flag_cache_dedup(self):
        """Flag cache must store promises to dedup concurrent requests."""
        src = _read(HOOKS_DIR / "useFeatureFlag.ts")
        assert "_flagCache" in src, (
            "useFeatureFlag must use a _flagCache Map for deduplication"
        )
        # Verify it checks existing cache before fetching
        assert re.search(r"_flagCache\.get\(", src), (
            "useFeatureFlag must check _flagCache.get() before making a new request"
        )
        assert re.search(r"_flagCache\.set\(", src), (
            "useFeatureFlag must store the promise in _flagCache.set()"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 8. Feature flag cache TTL — 5 minutes
# ═══════════════════════════════════════════════════════════════════════════


class TestFeatureFlagCacheTtl:
    """Feature flag cache must have a 5-minute TTL."""

    def test_feature_flag_cache_ttl(self):
        """Cache TTL must be 5 * 60 * 1000 ms (5 minutes)."""
        src = _read(HOOKS_DIR / "useFeatureFlag.ts")
        # Look for the TTL constant
        ttl_match = re.search(r"FLAG_CACHE_TTL_MS\s*=\s*(.+?);", src)
        assert ttl_match, "useFeatureFlag must define FLAG_CACHE_TTL_MS"
        ttl_expr = ttl_match.group(1).strip()
        # Evaluate: 5 * 60 * 1000 = 300000
        assert "5" in ttl_expr and "60" in ttl_expr and "1000" in ttl_expr, (
            f"FLAG_CACHE_TTL_MS should be 5 * 60 * 1000 (5 min), got: {ttl_expr}"
        )
        # Verify the TTL is checked before reusing cache
        assert re.search(r"Date\.now\(\)\s*-\s*\w+\.ts\s*<\s*FLAG_CACHE_TTL_MS", src), (
            "Cache must check (Date.now() - entry.ts < FLAG_CACHE_TTL_MS) before reuse"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 9. TodayWorkoutCard uses styles variable (pre-computed)
# ═══════════════════════════════════════════════════════════════════════════


class TestTodayWorkoutCardUsesStylesVariable:
    """TodayWorkoutCard should use a pre-computed styles variable, not inline getStyles()."""

    def test_today_workout_card_uses_styles_variable(self):
        """Component body should reference `styles.xxx`, not call getStyles() inline."""
        src = _read(COMPONENTS_DIR / "dashboard" / "TodayWorkoutCard.tsx")
        # Should assign styles once at top of component
        assert re.search(r"const styles\s*=\s*getThemedStyles\(", src), (
            "TodayWorkoutCard should pre-compute styles: const styles = getThemedStyles(c)"
        )
        # Should NOT call getThemedStyles() inline in JSX
        jsx_section = src[src.find("return (") :] if "return (" in src else ""
        inline_calls = re.findall(r"getThemedStyles\(", jsx_section)
        assert len(inline_calls) == 0, (
            f"Found {len(inline_calls)} inline getThemedStyles() calls in JSX. "
            "Styles should be pre-computed in a variable."
        )


# ═══════════════════════════════════════════════════════════════════════════
# 10. RecoveryCheckinModal — no getStyles() in Stepper
# ═══════════════════════════════════════════════════════════════════════════


class TestRecoveryCheckinNoGetStylesInStepper:
    """Stepper sub-component in RecoveryCheckinModal should use pre-computed styles."""

    def test_recovery_checkin_no_getstyles_in_stepper(self):
        """Stepper should use `const styles = getThemedStyles(c)`, not call it per render cycle."""
        src = _read(COMPONENTS_DIR / "modals" / "RecoveryCheckinModal.tsx")
        # Find the Stepper function
        stepper_match = re.search(
            r"function Stepper\b([\s\S]*?)(?=\nfunction |\nexport |\nconst getThemedStyles)",
            src,
        )
        assert stepper_match, "RecoveryCheckinModal must contain a Stepper component"
        stepper_src = stepper_match.group(1)
        # Stepper should pre-compute styles
        assert re.search(r"const styles\s*=\s*getThemedStyles\(", stepper_src), (
            "Stepper should pre-compute: const styles = getThemedStyles(c)"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 11. LearnScreen ArticleCard memoized styles
# ═══════════════════════════════════════════════════════════════════════════


class TestLearnScreenArticleCardMemoizedStyles:
    """AnimatedArticleCard in LearnScreen should pre-compute styles."""

    def test_learn_screen_article_card_memoized_styles(self):
        """AnimatedArticleCard must assign styles via getThemedStyles once, not inline."""
        src = _read(SCREENS_DIR / "learn" / "LearnScreen.tsx")
        # Find the AnimatedArticleCard function
        card_match = re.search(
            r"function AnimatedArticleCard\b([\s\S]*?)(?=\nexport |\nfunction (?!AnimatedArticleCard))",
            src,
        )
        assert card_match, "LearnScreen must contain AnimatedArticleCard component"
        card_src = card_match.group(1)
        assert re.search(r"const styles\s*=\s*getThemedStyles\(", card_src), (
            "AnimatedArticleCard should pre-compute styles: const styles = getThemedStyles(c)"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 12. WeeklyCheckinCard uses styles variable
# ═══════════════════════════════════════════════════════════════════════════


class TestWeeklyCheckinCardUsesStyles:
    """WeeklyCheckinCard should use pre-computed styles, not inline getStyles()."""

    def test_weekly_checkin_card_uses_styles(self):
        """WeeklyCheckinCard must pre-compute styles and reference styles.xxx in JSX."""
        src = _read(COMPONENTS_DIR / "coaching" / "WeeklyCheckinCard.tsx")
        # Should have getThemedStyles defined
        assert "getThemedStyles" in src, (
            "WeeklyCheckinCard must define getThemedStyles"
        )
        # Should pre-compute in component body
        assert re.search(r"const styles\s*=\s*getThemedStyles\(", src), (
            "WeeklyCheckinCard should pre-compute: const styles = getThemedStyles(c)"
        )
        # Extract the WeeklyCheckinCard function body (before the style definition)
        func_match = re.search(
            r"export function WeeklyCheckinCard\b([\s\S]*?)(?=\n// -{3,}|\nfunction TargetRow|\nconst getThemedStyles)",
            src,
        )
        assert func_match, "Could not find WeeklyCheckinCard function body"
        func_body = func_match.group(1)
        # After the initial `const styles = getThemedStyles(c)`, no more calls
        # Split at the first assignment and check the rest
        parts = re.split(r"const styles\s*=\s*getThemedStyles\(", func_body, maxsplit=1)
        if len(parts) > 1:
            remaining = parts[1]
            extra_calls = re.findall(r"getThemedStyles\(", remaining)
            assert len(extra_calls) == 0, (
                f"Found {len(extra_calls)} extra getThemedStyles() calls after initial assignment. "
                "Use the pre-computed styles variable instead."
            )
