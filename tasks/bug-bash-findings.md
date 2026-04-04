# Bug Bash & Test Gap Analysis — Repwise Backend

**Date:** 2025-01-27  
**Scope:** Full backend sweep (`src/modules/`, `tests/`)  
**Stats:** 190 endpoints across 32 modules, 101 test files, 1260 tests passing  
**Syntax:** All Python files parse OK (ast.parse verified)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1     |
| HIGH     | 5     |
| MEDIUM   | 9     |
| LOW      | 6     |
| **Total**| **21**|

---

## CRITICAL

### 1. XSS in Sharing HTML — Unescaped `og_url`
- **File:** `src/modules/sharing/router.py:64,79`
- **Type:** Security — Reflected XSS
- **Detail:** `og_url = str(request.url)` is injected directly into `<meta property="og:url" content="{og_url}">` without HTML escaping. An attacker can craft a URL with `"` to break out of the attribute and inject arbitrary HTML/JS. `session_date` (line 102) is also unescaped in the HTML body, though it's a `date` type so lower risk.
- **Fix needed:** Code fix — `html_mod.escape(og_url)` and `html_mod.escape(str(workout['session_date']))`

---

## HIGH

### 2. Missing Soft-Delete Filter — Barcode Service
- **File:** `src/modules/food_database/barcode_service.py:89,98`
- **Type:** Logic error — returns deleted food items
- **Detail:** Two `select(FoodItem)` queries lack `FoodItem.not_deleted()`. A barcode lookup or duplicate check can return soft-deleted items, causing ghost data to resurface.
- **Fix needed:** Code fix — add `FoodItem.not_deleted(stmt)` to both queries

### 3. Missing JSONB Type Guard — Health Reports
- **File:** `src/modules/health_reports/service.py:263`
- **Type:** Runtime error — TypeError on bad data
- **Detail:** `nutrient_totals[nutrient] += value` where `value` comes from `entry.micro_nutrients` JSONB. No `isinstance(value, (int, float))` guard. A string or null value in the JSONB will crash with `TypeError`. The `food_database` module correctly guards this (line 994), but `health_reports` and `dietary_analysis` do not.
- **Fix needed:** Code fix — add `if isinstance(value, (int, float)):` guard

### 4. Missing JSONB Type Guard — Dietary Analysis
- **File:** `src/modules/dietary_analysis/service.py:156`
- **Type:** Runtime error — TypeError on bad data
- **Detail:** Same pattern as #3. `micro_totals[k] += v` without type guard on JSONB values.
- **Fix needed:** Code fix — add `if isinstance(v, (int, float)):` guard

### 5. No Upper Bound on List Sizes — DoS Vector
- **File:** `src/modules/training/schemas.py:51,44`
- **Type:** Missing validation — potential DoS
- **Detail:** `TrainingSessionCreate.exercises` has `min_length=1` but no `max_length`. `ExerciseEntry.sets` has `min_length=1` but no `max_length`. A malicious client could send 10,000 exercises with 10,000 sets each, causing memory exhaustion and slow DB writes. Same issue in `RecipeCreateRequest.ingredients` (`src/modules/food_database/schemas.py:178`).
- **Fix needed:** Code fix — add `max_length=50` on exercises, `max_length=100` on sets, `max_length=100` on ingredients

### 6. Deprecated `datetime.utcnow()` Usage
- **File:** `src/modules/training/fatigue_service.py:184`
- **Type:** Bug — timezone-naive datetime
- **Detail:** `datetime.utcnow()` is deprecated in Python 3.12+ and returns a naive datetime. Should use `datetime.now(timezone.utc)`. This can cause comparison issues with timezone-aware datetimes elsewhere in the codebase.
- **Fix needed:** Code fix — replace with `datetime.now(timezone.utc)`

---

## MEDIUM

### 7. Missing Upper Bounds on Numeric Fields
- **File:** `src/modules/training/schemas.py:17-18`
- **Type:** Missing validation
- **Detail:** `SetEntry.reps` (int, ge=0, no upper bound) and `SetEntry.weight_kg` (float, ge=0, no upper bound). A client could send `reps=999999999` or `weight_kg=1e308`. The `nutrition` module correctly bounds these (`le=50000` for calories, `le=5000` for macros) but training does not.
- **Fix needed:** Code fix — add `le=10000` on reps, `le=2000` on weight_kg

### 8. Missing Upper Bounds on Meal Macros
- **File:** `src/modules/meals/schemas.py:18-21`
- **Type:** Missing validation
- **Detail:** `CustomMealCreate` has `calories`, `protein_g`, `carbs_g`, `fat_g` all with `ge=0` but no upper bound. The `nutrition` module correctly uses `le=50000`/`le=5000`.
- **Fix needed:** Code fix — add `le=` bounds matching nutrition module

### 9. Error Message Leakage — Recomp Router
- **File:** `src/modules/recomp/router.py:61`
- **Type:** Information disclosure
- **Detail:** `raise HTTPException(status_code=400, detail=str(exc))` exposes raw `ValueError` messages to the client. While `ValueError` messages are typically developer-written, this pattern can leak internal details.
- **Fix needed:** Code fix — use a generic message or sanitize

### 10. `date.today()` Without Timezone Context
- **File:** Multiple (15 occurrences across achievements, training, challenges, recomp, user, readiness)
- **Type:** Consistency issue
- **Detail:** `date.today()` uses the server's local timezone. If the server timezone differs from UTC, date boundaries can be off by hours. Not a crash bug, but can cause incorrect streak calculations, challenge completions, or session date validation near midnight.
- **Fix needed:** Evaluate — consider `datetime.now(timezone.utc).date()` for consistency

### 11. No Dedicated Test File — Account Module
- **File:** `src/modules/account/` (2 endpoints: delete + reactivate)
- **Type:** Test gap
- **Detail:** Account deletion with 30-day grace period and reactivation are critical user flows with zero dedicated tests. Only a JSON roundtrip test exists.
- **Test needed:** Happy path, already-deleted, expired grace period, reactivation after expiry, rate limiting

### 12. No Dedicated Test File — Dashboard Module
- **File:** `src/modules/dashboard/` (1 endpoint consolidating 12 API calls)
- **Type:** Test gap
- **Detail:** Dashboard summary endpoint has no dedicated unit/integration tests. Only referenced in performance tests and a basic integration smoke test.
- **Test needed:** Empty state, partial data, all sub-queries returning data, error in one sub-query

### 13. No Dedicated Test File — Reports Module
- **File:** `src/modules/reports/` (3 endpoints: weekly, monthly, yearly)
- **Type:** Test gap
- **Detail:** Weekly report has a unit test (`test_weekly_report_unit.py`) but monthly and yearly reports have zero tests. These are complex aggregation endpoints.
- **Test needed:** Monthly/yearly report generation, empty data, future date rejection, edge cases (year boundary, leap year)

### 14. No Dedicated Test File — Import Execute Endpoint
- **File:** `src/modules/import_data/` (4 endpoints)
- **Type:** Test gap
- **Detail:** `test_import_parser.py` tests CSV parsing but there are no integration tests for the `execute_import` endpoint (actual DB writes, deduplication, rate limiting).
- **Test needed:** Execute import happy path, duplicate detection, rate limit enforcement, malformed CSV handling

### 15. No Dedicated Test File — Community Module
- **File:** `src/modules/community/` (2 endpoints)
- **Type:** Test gap
- **Detail:** Community links GET (public) and PUT (admin-only) have zero tests.
- **Test needed:** Public GET, admin PUT, non-admin PUT rejection

---

## LOW

### 16. `weight_unit` Not Validated in Import
- **File:** `src/modules/import_data/router.py:55,65`
- **Type:** Missing validation
- **Detail:** `weight_unit: str = Form("kg")` accepts any string. The `_to_kg` function only checks for `"lbs"` and treats everything else as kg. Not a crash, but confusing if someone passes `"pounds"` or `"lb"`.
- **Fix needed:** Code fix — validate against `{"kg", "lbs"}`

### 17. Bare `except Exception` in User Service
- **File:** `src/modules/user/service.py:60`
- **Type:** Code quality
- **Detail:** `except Exception:` catches all exceptions from Redis cooldown check. While it has a fallback, it should catch `redis.RedisError` or similar specific exception.
- **Fix needed:** Code fix — narrow to specific Redis exceptions

### 18. Missing Response Model on Periodization Endpoint
- **File:** `src/modules/periodization/router.py:107`
- **Type:** Code quality
- **Detail:** `list_templates() -> list[dict]` returns untyped dicts instead of a Pydantic response model. This bypasses OpenAPI schema generation and response validation.
- **Fix needed:** Code fix — add response model

### 19. Sharing HTML — `description` Not Escaped in OG Meta
- **File:** `src/modules/sharing/router.py:80`
- **Type:** Low-risk XSS
- **Detail:** The `description` variable (built from integer counts) is injected into `<meta property="og:description" content="{description}">`. Since it's built from integers and a safe display name, the actual risk is minimal, but it should be escaped for defense-in-depth.
- **Fix needed:** Code fix — `html_mod.escape(description)`

### 20. FTS Search Returns `-1` for `total_count`
- **File:** `src/modules/food_database/service.py:253`
- **Type:** API inconsistency
- **Detail:** When FTS returns no results, `total_count=-1` is returned. All other paginated endpoints return `total_count=0` for empty results. Clients may not handle `-1` correctly.
- **Fix needed:** Code fix — return `0` instead of `-1`

### 21. Export `_collect_user_data` Loads All Data Into Memory
- **File:** `src/modules/export/service.py:261`
- **Type:** Performance — potential OOM for power users
- **Detail:** Export collects ALL training sessions, meal entries, measurements, etc. into a single dict. A power user with years of data could cause memory pressure. Rate-limited to 1/24h which mitigates this.
- **Fix needed:** Evaluate — consider streaming for large exports (low priority given rate limit)

---

## Test Coverage Summary

| Module | Endpoints | Dedicated Tests | Coverage |
|--------|-----------|----------------|----------|
| account | 2 | ❌ None | Gap |
| achievements | 5 | ✅ engine unit | Good |
| adaptive | 13 | ✅ engine, properties, measurements | Good |
| auth | 11 | ✅ properties, security, unit, email, password | Excellent |
| challenges | 2 | ✅ 14 tests | OK |
| coaching | 8 | ✅ properties, tier | Good |
| community | 2 | ❌ None | Gap |
| content | 8 | ✅ properties | Good |
| dashboard | 1 | ⚠️ Smoke only | Gap |
| dietary_analysis | 3 | ✅ dedicated | Good |
| export | 6 | ✅ dedicated | Good |
| feature_flags | 1 | ✅ endpoint + audit | Good |
| food_database | 12 | ✅ properties, search, barcode, frequency | Excellent |
| founder | 2 | ✅ properties | Good |
| health_reports | 5 | ✅ dedicated | Good |
| import_data | 4 | ⚠️ Parser only | Gap |
| legal | 2 | ✅ 6 tests | OK |
| meal_plans | 8 | ✅ properties, unit | Good |
| meals | 9 | ✅ properties, builder | Good |
| measurements | 9 | ✅ dedicated | Good |
| notifications | 6 | ✅ unit, triggers | Good |
| nutrition | 7 | ✅ properties, bugfixes, scaling, frequency | Excellent |
| onboarding | 1 | ✅ edge cases, properties, unit | Excellent |
| payments | 3 | ✅ webhook, trial | Good |
| periodization | 8 | ✅ unit | Good |
| progress_photos | 6 | ✅ properties, unit | Good |
| recomp | 5 | ✅ engine unit | Good |
| reports | 3 | ⚠️ Weekly only | Gap |
| sharing | 2 | ✅ dedicated | Good |
| social | 11 | ✅ dedicated | Good |
| training | 15 | ✅ properties, PRs, templates, analytics | Excellent |
| user | 10 | ✅ properties, unit, settings | Good |

**Modules needing test investment:** account, community, dashboard, import_data (execute), reports (monthly/yearly)
