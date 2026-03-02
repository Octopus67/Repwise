# Implementation Plan: Camera Barcode Scanner

## Overview

Feature-flag-gated camera barcode scanning for nutrition logging. The existing `BarcodeScanner.tsx` already handles camera scanning — this plan adds the flag gate, extracts testable utilities, creates the flag check endpoint, fixes the manual barcode API call bug, and wires the manual fallback for web/flag-off users.

**Flag:** `camera_barcode_scanner`
**Rollback:** Set flag `is_enabled=false` → instant, no deploy needed.

## What Already Exists (DO NOT REBUILD)

- `BarcodeScanner.tsx` — camera scanning, permission handling, debounce, haptics, overlay, result card, not-found state
- `barcode_service.py` — cache → OFF → USDA lookup chain
- `food_database/router.py` — `GET /food/barcode/{barcode}` with `^\d{8,14}$` validation
- `BarcodeScanner.test.ts` — macro scaling, multiplier validation, debounce, state transitions, barcode format
- `test_barcode_properties.py` — backend lookup chain, cache round-trip, OFF parsing

## What Must Be Built

1. `app/utils/barcodeUtils.ts` — extract pure functions from BarcodeScanner for testability
2. `src/modules/feature_flags/router.py` — `GET /check/{flag_name}` endpoint (none exists today)
3. `app/hooks/useFeatureFlag.ts` — client-side flag check hook
4. Flag gate wiring in `AddNutritionModal.tsx` — conditional camera vs manual input
5. Inline manual barcode input UI in `AddNutritionModal.tsx`
6. Fix `handleManualBarcodeEntry` bug — uses query params, backend expects path param
7. `scripts/seed_camera_barcode_flag.py` — seed the flag row
8. Refactor `BarcodeScanner.tsx` to use extracted utilities

---

## Phase 0: Setup & Baseline

- [x] 0.1 Verify baseline test suites pass
  - **Files:** none (read-only)
  - **Details:** Run both test suites, record pass counts. Do not proceed if either fails.
  - **Depends on:** nothing
  - **Test:** `cd app && npx jest --passWithNoTests` (expect 940+), `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v` (expect 920+)
  - **Rollback:** N/A — read-only step
  - **Risk:** Low. Pre-existing flaky tests may fail; ignore known timezone failures.
  - **Time:** 2 min

---

## Phase 1: Backend — Feature Flag Endpoint

- [x] 1.1 Create feature flags router with `GET /check/{flag_name}` endpoint
  - **Files:** `src/modules/feature_flags/router.py` (NEW)
  - **Details:** Create router with single endpoint. Uses `FeatureFlagService.is_feature_enabled(flag_name, user)`. Returns `{"enabled": bool}`. Requires JWT auth via `get_current_user`. Keep routing-only — no business logic in router (per project rules).
  - **Depends on:** 0.1
  - **Test:** manual curl or wait for 1.4
  - **Rollback:** Delete file, remove import from `main.py`
  - **Risk:** Low. Single endpoint, no schema changes, no migrations.
  - **Time:** 5 min
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 Register feature flags router in `src/main.py`
  - **Files:** `src/main.py` (MODIFY — add 2 lines)
  - **Details:** Add `from src.modules.feature_flags.router import router as feature_flags_router` and `app.include_router(feature_flags_router, prefix="/api/v1/feature-flags", tags=["feature-flags"])`. Follow existing pattern (see lines 190-258).
  - **Depends on:** 1.1
  - **Test:** Server starts without import errors
  - **Rollback:** Remove the 2 added lines
  - **Risk:** Low. Could shadow an existing route prefix — verify no `/api/v1/feature-flags` prefix exists (confirmed: none exists).
  - **Time:** 2 min
  - _Requirements: 1.1_

- [x] 1.3 Create seed script for `camera_barcode_scanner` flag
  - **Files:** `scripts/seed_camera_barcode_flag.py` (NEW)
  - **Details:** Follow `scripts/seed_training_log_v2_flag.py` pattern exactly. Seeds flag with `is_enabled=False`, description `"Gates camera-based barcode scanner in nutrition logger"`, no conditions. Uses `FeatureFlagService.set_flag()` + `session.commit()`.
  - **Depends on:** 1.1 (uses same service, but no runtime dependency)
  - **Test:** `python scripts/seed_camera_barcode_flag.py` prints success message
  - **Rollback:** Delete file. Flag row is harmless if left in DB.
  - **Risk:** Low. Idempotent — `set_flag` does upsert.
  - **Time:** 3 min
  - _Requirements: 1.1_

- [x]* 1.4 Write unit tests for feature flag check endpoint
  - **Files:** `tests/test_feature_flag_endpoint.py` (NEW)
  - **Details:** Three tests: (1) authenticated request for non-existent flag → `{"enabled": false}`, (2) unauthenticated request → 401, (3) existing enabled flag → `{"enabled": true}`. Use existing `conftest.py` fixtures for auth and DB session.
  - **Depends on:** 1.1, 1.2
  - **Test:** `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/test_feature_flag_endpoint.py -v`
  - **Rollback:** Delete file
  - **Risk:** Low. New test file, no production code changes.
  - **Time:** 10 min
  - _Requirements: 1.1, 1.2_

- [x]* 1.5 Write property test: Barcode format validation backend (Property 5)
  - **Property 5: Barcode format validation (backend)**
  - **Validates: Requirements 8.2**
  - **Files:** `tests/test_barcode_properties.py` (MODIFY — append new test)
  - **Details:** Use Hypothesis to generate random strings. Assert: strings not matching `^\d{8,14}$` → HTTP 422 from `GET /food/barcode/{barcode}`; strings matching → NOT 422. Min 100 iterations. Tag: `Feature: camera-barcode-scanner, Property 5: Barcode format validation (backend)`.
  - **Depends on:** 0.1
  - **Test:** `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/test_barcode_properties.py -v -k "property_5"`
  - **Rollback:** Revert appended test function
  - **Risk:** Low. Additive test, no production code changes.
  - **Time:** 10 min

- [x] 1.6 Checkpoint — backend phase gate
  - **Details:** Ensure all backend tests pass. Verify the new endpoint returns JSON. Ask the user if questions arise.
  - **Test:** `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - **PR boundary:** Backend changes (1.1–1.5) can ship as standalone PR.

---

## Phase 2: Frontend — Utilities & Hook (parallelizable: 2.1–2.6 with Phase 1)

- [x] 2.1 Create `barcodeUtils.ts` with pure utility functions
  - **Files:** `app/utils/barcodeUtils.ts` (NEW)
  - **Details:** Five pure functions extracted from `BarcodeScanner.tsx` inline logic: `isValidBarcode(s)` — regex `^\d{8,14}$`; `shouldProcessScan(now, lastScanTime, debounceMs)` — returns `now - lastScanTime >= debounceMs`; `scaleBarcodeResult(food, multiplier)` — `Math.round(calories * mult)`, `Math.round(x_g * mult * 10) / 10` for gram fields; `isValidMultiplier(input)` — `parseFloat` is finite and > 0; `resolveScannerMode(platform, flagEnabled)` — returns `'camera'` only when platform ∈ {ios, android} AND flagEnabled.
  - **Depends on:** nothing
  - **Test:** wait for 2.2–2.6
  - **Rollback:** Delete file
  - **Risk:** Low. New file, no imports yet.
  - **Time:** 10 min
  - _Requirements: 3.3, 4.3, 5.1, 6.1, 8.1_

- [x]* 2.2 Write property test: Scanner mode selection (Property 1)
  - **Property 1: Scanner mode selection**
  - **Validates: Requirements 1.1, 1.2, 6.1**
  - **Files:** `app/__tests__/utils/barcodeUtils.test.ts` (NEW)
  - **Details:** Use fast-check to generate random `(platform, flagEnabled)` pairs. Platforms: `fc.constantFrom('ios', 'android', 'web', 'windows', 'macos')`. Assert `resolveScannerMode` returns `'camera'` iff platform ∈ {ios, android} AND flagEnabled === true. Min 100 iterations. Tag: `Feature: camera-barcode-scanner, Property 1: Scanner mode selection`.
  - **Depends on:** 2.1
  - **Test:** `cd app && npx jest barcodeUtils.test --verbose`
  - **Rollback:** Delete test file
  - **Risk:** Low. New test file.
  - **Time:** 8 min

- [x]* 2.3 Write property test: Scan debounce correctness (Property 2)
  - **Property 2: Scan debounce correctness**
  - **Validates: Requirements 3.3**
  - **Files:** `app/__tests__/utils/barcodeUtils.test.ts` (MODIFY — append)
  - **Details:** Use fast-check to generate `(now: fc.nat(), lastScanTime: fc.nat(), debounceMs: fc.integer({min: 1}))`. Assert `shouldProcessScan(now, lastScanTime, debounceMs)` returns true iff `now - lastScanTime >= debounceMs`. Min 100 iterations. Tag: `Feature: camera-barcode-scanner, Property 2: Scan debounce correctness`.
  - **Depends on:** 2.1, 2.2
  - **Test:** `cd app && npx jest barcodeUtils.test --verbose`
  - **Rollback:** Remove appended test
  - **Risk:** Low.
  - **Time:** 5 min

- [x]* 2.4 Write property test: Macro scaling correctness (Property 3)
  - **Property 3: Macro scaling correctness**
  - **Validates: Requirements 4.3, 5.1**
  - **Files:** `app/__tests__/utils/barcodeUtils.test.ts` (MODIFY — append)
  - **Details:** Use fast-check to generate food items with non-negative macros (`fc.float({min: 0, max: 10000, noNaN: true})`) and positive multipliers (`fc.float({min: 0.01, max: 100, noNaN: true})`). Assert each scaled field matches formula. Assert multiplier 1 returns original values (identity). Min 100 iterations. Tag: `Feature: camera-barcode-scanner, Property 3: Macro scaling correctness`.
  - **Depends on:** 2.1, 2.2
  - **Test:** `cd app && npx jest barcodeUtils.test --verbose`
  - **Rollback:** Remove appended test
  - **Risk:** Low. Floating point edge cases — use `toBeCloseTo` for gram fields.
  - **Time:** 8 min

- [x]* 2.5 Write property test: Barcode format validation client (Property 4)
  - **Property 4: Barcode format validation (client)**
  - **Validates: Requirements 8.1, 6.3, 8.3**
  - **Files:** `app/__tests__/utils/barcodeUtils.test.ts` (MODIFY — append)
  - **Details:** Use fast-check to generate valid barcodes (`fc.stringOf(fc.constantFrom(...'0123456789'), {minLength: 8, maxLength: 14})`) and invalid strings (`fc.string()`). Assert `isValidBarcode` agrees with `^\d{8,14}$` regex for all inputs. Min 100 iterations. Tag: `Feature: camera-barcode-scanner, Property 4: Barcode format validation`.
  - **Depends on:** 2.1, 2.2
  - **Test:** `cd app && npx jest barcodeUtils.test --verbose`
  - **Rollback:** Remove appended test
  - **Risk:** Low.
  - **Time:** 5 min

- [x]* 2.6 Write unit tests for `isValidMultiplier` edge cases
  - **Files:** `app/__tests__/utils/barcodeUtils.test.ts` (MODIFY — append)
  - **Details:** Test: "0" → false, "-1" → false, "abc" → false, "" → false, "Infinity" → false, "NaN" → false, "0.01" → true, "1" → true, "99" → true, "0.001" → true.
  - **Depends on:** 2.1, 2.2
  - **Test:** `cd app && npx jest barcodeUtils.test --verbose`
  - **Rollback:** Remove appended test
  - **Risk:** Low.
  - **Time:** 3 min
  - _Requirements: 4.3_

- [x] 2.7 Checkpoint — frontend utilities phase gate
  - **Details:** Ensure all frontend tests pass. Ask the user if questions arise.
  - **Test:** `cd app && npx jest --passWithNoTests`

---

## Phase 3: Frontend — Feature Flag Hook & Modal Integration

- [x] 3.1 Create `useFeatureFlag` hook
  - **Files:** `app/hooks/useFeatureFlag.ts` (NEW)
  - **Details:** Calls `GET /feature-flags/check/{flagName}` on mount. Returns `{ enabled: boolean, loading: boolean }`. Defaults to `enabled: false` on error (safe fallback — flag off = manual entry, not broken). Cleanup with `cancelled` flag to prevent state updates after unmount. Re-evaluates on each mount (no cross-session caching per Req 1.3).
  - **Depends on:** 1.1, 1.2 (endpoint must exist)
  - **Test:** wait for 3.2
  - **Rollback:** Delete file
  - **Risk:** Low. New file, isolated hook.
  - **Time:** 5 min
  - _Requirements: 1.1, 1.2, 1.3_

- [x]* 3.2 Write unit tests for `useFeatureFlag` hook
  - **Files:** `app/__tests__/hooks/useFeatureFlag.test.ts` (NEW)
  - **Details:** Three tests: (1) returns `{ enabled: false, loading: true }` initially, (2) returns `{ enabled: true, loading: false }` after successful API call with mock, (3) returns `{ enabled: false, loading: false }` on API error (safe fallback). Mock `api.get` via jest.
  - **Depends on:** 3.1
  - **Test:** `cd app && npx jest useFeatureFlag.test --verbose`
  - **Rollback:** Delete file
  - **Risk:** Low.
  - **Time:** 8 min
  - _Requirements: 1.1, 1.3_

- [x] 3.3 Wire feature flag gate into `AddNutritionModal.tsx` barcode icon
  - **Files:** `app/components/modals/AddNutritionModal.tsx` (MODIFY)
  - **Details:** Import `useFeatureFlag` and `resolveScannerMode` from new modules. Call `const { enabled: cameraFlagEnabled } = useFeatureFlag('camera_barcode_scanner')` at component top. Replace barcode icon `onPress` (currently lines ~1148-1155) to use `resolveScannerMode(Platform.OS, cameraFlagEnabled)`. When mode is `'camera'` → `setShowBarcodeScanner(true)` (existing). When mode is `'manual'` → `setShowManualBarcode(true)` (new state). Add `showManualBarcode` to the `reset()` function.
  - **Depends on:** 2.1, 3.1
  - **Test:** `cd app && npx jest AddNutritionModal.test --verbose`
  - **Rollback:** Revert the 3 changed sections (import, hook call, onPress handler)
  - **Risk:** Medium. Modifying a 1851-line file. Keep changes minimal — only touch the barcode icon handler and add state. Do NOT restructure existing code.
  - **Time:** 15 min
  - _Requirements: 1.1, 1.2, 6.1_

- [x] 3.4 Add inline manual barcode input UI to `AddNutritionModal.tsx`
  - **Files:** `app/components/modals/AddNutritionModal.tsx` (MODIFY)
  - **Details:** Add `showManualBarcode`, `manualBarcodeValue`, `manualBarcodeError` state variables. Render a conditional block when `showManualBarcode` is true: TextInput with numeric keyboard, validate with `isValidBarcode` on submit, show inline error "Enter 8-14 digits" for invalid input. On valid submit, call `handleManualBarcodeEntry`. Reset all manual barcode states when modal closes (`useEffect` on `visible` — per project critical rules). Add `disabled={loading}` on submit button (per project critical rules).
  - **Depends on:** 3.3, 2.1
  - **Test:** `cd app && npx jest AddNutritionModal.test --verbose`
  - **Rollback:** Remove the added state variables and JSX block
  - **Risk:** Medium. Same large file. Keep the UI block self-contained.
  - **Time:** 15 min
  - _Requirements: 6.1, 6.3, 8.3_

- [x] 3.5 Fix `handleManualBarcodeEntry` API call bug
  - **Files:** `app/components/modals/AddNutritionModal.tsx` (MODIFY — 1 line)
  - **Details:** Change `api.get('food/barcode', { params: { code: barcode } })` to `` api.get(`food/barcode/${barcode}`) ``. The backend expects a path param (`GET /food/barcode/{barcode}`), not a query param. This is a pre-existing bug — the manual barcode entry on web has never worked.
  - **Depends on:** 3.3
  - **Test:** `cd app && npx jest AddNutritionModal.test --verbose`
  - **Rollback:** Revert the 1 line
  - **Risk:** Low. Single line fix. Strictly correct — matches backend route definition in `food_database/router.py` line `@router.get("/barcode/{barcode}")`.
  - **Time:** 2 min
  - _Requirements: 6.2_

---

## Phase 4: Frontend — Scanner Refactor & Integration Polish

- [x] 4.1 Refactor `BarcodeScanner.tsx` to use `barcodeUtils` functions
  - **Files:** `app/components/nutrition/BarcodeScanner.tsx` (MODIFY)
  - **Details:** Import `isValidBarcode`, `shouldProcessScan`, `scaleBarcodeResult`, `isValidMultiplier` from `barcodeUtils`. In `handleBarCodeScanned`: add `if (!isValidBarcode(data)) return;` before debounce check. Replace inline debounce `if (now - lastScanRef.current < 2000) return;` with `if (!shouldProcessScan(now, lastScanRef.current, 2000)) return;`. In found-state render: replace inline scaling block with `const scaled = scaleBarcodeResult(scannedFood, mult);`. In `handleConfirm`: replace inline validation with `if (!isValidMultiplier(multiplier)) return;`. No structural changes — same component, same props, same state machine, same UI.
  - **Depends on:** 2.1
  - **Test:** `cd app && npx jest BarcodeScanner.test --verbose`
  - **Rollback:** Revert to inline logic (copy from git)
  - **Risk:** Low. Pure refactor — behavior is identical. Existing `BarcodeScanner.test.ts` validates all logic paths.
  - **Time:** 10 min
  - _Requirements: 3.3, 4.3, 8.1_

- [x] 4.2 Final checkpoint — all tests green
  - **Details:** Run full test suites. Compare pass counts to Phase 0 baseline. All new tests must pass. No regressions. Ask the user if questions arise.
  - **Test:** `cd app && npx jest --passWithNoTests` AND `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - **PR boundary:** All frontend changes (2.1–4.1) can ship as second PR, or combine with backend PR.

---

## Parallelization Notes

| Step | Can run in parallel with |
|------|--------------------------|
| 1.1–1.3 (backend endpoint + seed) | 2.1–2.6 (frontend utilities + tests) |
| 1.4–1.5 (backend tests) | 2.1–2.6 |
| 3.1–3.2 (hook) | 4.1 (scanner refactor) — different files |
| 3.3–3.5 (modal changes) | SEQUENTIAL — all touch same file |

---

## Post-Launch Monitoring

| Metric | Source | Alert Threshold | Action |
|--------|--------|-----------------|--------|
| Flag check endpoint p95 latency | API logs / CloudWatch | > 100ms | Check if in-memory cache is working (TTL 60s) |
| Barcode lookup error rate | API logs | > 5% of lookups | Check OFF/USDA API health, verify httpx 5s timeout |
| Scanner crash rate | Expo crash reports | Any increase | Disable flag → instant rollback to manual entry |
| Manual fallback usage | Client analytics | Unexpected spike on mobile | Flag may be stuck off — verify DB row |

---

## Deferred to V2

| Feature | Reason | Effort |
|---------|--------|--------|
| Continuous scan mode (scan → confirm → scan next) | UX enhancement, not MVP | 1 day |
| Scan history (recently scanned barcodes) | Needs new local storage schema | 1 day |
| Animated state transitions (Reanimated 4) | Polish, not functional | 0.5 day |
| Torch/flashlight toggle | Needs expo-camera config | 0.5 day |
| Barcode type indicator in overlay | Nice-to-have | 0.25 day |

---

## Notes

- Tasks marked with `*` are optional property/unit tests — can be skipped for faster MVP
- Each task references specific requirements for traceability
- The existing `BarcodeScanner.tsx` and backend barcode service are NOT being rewritten — only enhanced
- Feature flag enables instant rollback without a deploy
- The `handleManualBarcodeEntry` bug fix (3.5) is a pre-existing issue — the web manual barcode entry has never worked because it sends query params instead of a path param
