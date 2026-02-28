# Implementation Plan: Camera Barcode Scanner

## Overview

Implement feature-flag-gated camera barcode scanning for the nutrition logger. The existing `BarcodeScanner.tsx` already handles camera scanning — this plan adds the flag gate, extracts testable utilities, creates the flag check endpoint, and wires the manual fallback for web/flag-off users.

## Tasks

- [ ] 1. Create barcode utility module and property tests
  - [ ] 1.1 Create `app/utils/barcodeUtils.ts` with pure functions: `isValidBarcode`, `shouldProcessScan`, `scaleBarcodeResult`, `isValidMultiplier`, `resolveScannerMode`
    - Extract logic currently inline in `BarcodeScanner.tsx` into testable pure functions
    - `isValidBarcode`: regex `^\d{8,14}$`
    - `shouldProcessScan`: `now - lastScanTime >= debounceMs`
    - `scaleBarcodeResult`: `Math.round(calories * mult)`, `Math.round(x_g * mult * 10) / 10`
    - `isValidMultiplier`: `parseFloat(input)` is finite and > 0
    - `resolveScannerMode`: returns `'camera'` only when platform is mobile AND flag is enabled
    - _Requirements: 3.3, 4.3, 5.1, 6.1, 8.1_

  - [ ]* 1.2 Write property test: Scanner mode selection (Property 1)
    - **Property 1: Scanner mode selection**
    - Use fast-check to generate random (platform, flagEnabled) pairs
    - Assert `resolveScannerMode` returns `'camera'` iff platform ∈ {ios, android} AND flagEnabled === true
    - Min 100 iterations
    - **Validates: Requirements 1.1, 1.2, 6.1**

  - [ ]* 1.3 Write property test: Scan debounce correctness (Property 2)
    - **Property 2: Scan debounce correctness**
    - Use fast-check to generate random `(now, lastScanTime, debounceMs)` tuples
    - Assert `shouldProcessScan` returns true iff `now - lastScanTime >= debounceMs`
    - Min 100 iterations
    - **Validates: Requirements 3.3**

  - [ ]* 1.4 Write property test: Macro scaling correctness (Property 3)
    - **Property 3: Macro scaling correctness**
    - Use fast-check to generate random food items (non-negative macros) and positive multipliers
    - Assert each scaled field matches `Math.round(base * mult)` for calories and `Math.round(base * mult * 10) / 10` for gram fields
    - Assert multiplier 1 returns original values (identity)
    - Min 100 iterations
    - **Validates: Requirements 4.3, 5.1**

  - [ ]* 1.5 Write property test: Barcode format validation (Property 4)
    - **Property 4: Barcode format validation (client)**
    - Use fast-check to generate random strings (valid barcodes: 8-14 digit strings, invalid: arbitrary strings)
    - Assert `isValidBarcode` agrees with `^\d{8,14}$` regex for all inputs
    - Min 100 iterations
    - **Validates: Requirements 8.1, 6.3, 8.3**

  - [ ]* 1.6 Write unit tests for `isValidMultiplier` edge cases
    - Test: "0" → false, "-1" → false, "abc" → false, "" → false, "Infinity" → false, "0.01" → true, "1" → true, "99" → true
    - _Requirements: 4.3_

- [ ] 2. Checkpoint — frontend utilities
  - Ensure all tests pass: `cd app && npx jest --passWithNoTests`
  - Ask the user if questions arise.

- [ ] 3. Create feature flag check endpoint
  - [ ] 3.1 Create `src/modules/feature_flags/router.py` with `GET /check/{flag_name}` endpoint
    - Uses `FeatureFlagService.is_feature_enabled(flag_name, user)`
    - Returns `{"enabled": bool}`
    - Requires JWT auth via `get_current_user`
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 3.2 Register the feature flags router in `src/main.py`
    - Add `app.include_router(feature_flags_router, prefix="/api/v1/feature-flags", tags=["feature-flags"])`
    - _Requirements: 1.1_

  - [ ] 3.3 Create `scripts/seed_camera_barcode_flag.py` seed script
    - Seeds `camera_barcode_scanner` flag with `is_enabled=False`, description, no conditions
    - Follow existing pattern from `scripts/seed_training_log_v2_flag.py`
    - _Requirements: 1.1_

  - [ ]* 3.4 Write unit tests for the feature flag check endpoint
    - Test: authenticated request returns `{"enabled": false}` for non-existent flag
    - Test: unauthenticated request returns 401
    - Test: existing enabled flag returns `{"enabled": true}`
    - Add to `tests/test_audit_feature_flags_properties.py`
    - _Requirements: 1.1, 1.2_

  - [ ]* 3.5 Write property test: Barcode format validation backend (Property 5)
    - **Property 5: Barcode format validation (backend)**
    - Use Hypothesis to generate random strings
    - Assert: strings not matching `^\d{8,14}$` → HTTP 422; strings matching → not 422
    - Min 100 iterations
    - Add to `tests/test_barcode_properties.py`
    - **Validates: Requirements 8.2**

- [ ] 4. Checkpoint — backend
  - Ensure all tests pass: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - Ask the user if questions arise.

- [ ] 5. Create feature flag hook
  - [ ] 5.1 Create `app/hooks/useFeatureFlag.ts`
    - Calls `GET /feature-flags/check/{flagName}` on mount
    - Returns `{ enabled: boolean, loading: boolean }`
    - Defaults to `enabled: false` on error (safe fallback)
    - Cleanup with cancelled flag to prevent state updates after unmount
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 5.2 Write unit tests for `useFeatureFlag` hook
    - Test: returns `{ enabled: false, loading: true }` initially
    - Test: returns `{ enabled: true, loading: false }` after successful API call
    - Test: returns `{ enabled: false, loading: false }` on API error (safe fallback)
    - Create `app/__tests__/hooks/useFeatureFlag.test.ts`
    - _Requirements: 1.1, 1.3_

- [ ] 6. Integrate feature flag gate into AddNutritionModal
  - [ ] 6.1 Wire feature flag and scanner mode into `AddNutritionModal.tsx`
    - Import `useFeatureFlag` and `resolveScannerMode`
    - Call `useFeatureFlag('camera_barcode_scanner')` at component top
    - Replace barcode icon `onPress` to use `resolveScannerMode(Platform.OS, flagEnabled)`
    - When mode is `'camera'`: set `showBarcodeScanner(true)` (existing behavior)
    - When mode is `'manual'`: show inline manual barcode input with `isValidBarcode` validation
    - _Requirements: 1.1, 1.2, 6.1, 6.3, 8.3_

  - [ ] 6.2 Add inline manual barcode input UI to `AddNutritionModal.tsx`
    - Add `showManualBarcode` state, `manualBarcodeValue` state, `manualBarcodeError` state
    - Render TextInput with numeric keyboard, validate with `isValidBarcode` on submit
    - Show inline error "Enter 8-14 digits" for invalid input
    - On valid submit, call existing `handleManualBarcodeEntry` function
    - Reset states when modal closes (useEffect on visible)
    - _Requirements: 6.1, 6.3, 8.3_

- [ ] 7. Refactor BarcodeScanner to use utility functions
  - [ ] 7.1 Update `BarcodeScanner.tsx` to import and use `barcodeUtils`
    - Replace inline `isValidBarcode` check (currently implicit — any scanned barcode is sent to API) with explicit `isValidBarcode` filter
    - Replace inline debounce logic with `shouldProcessScan`
    - Replace inline macro scaling in result card with `scaleBarcodeResult`
    - Replace inline multiplier validation with `isValidMultiplier`
    - No structural changes to component — same props, same state machine, same UI
    - _Requirements: 3.3, 4.3, 8.1_

- [ ] 8. Final checkpoint
  - Run all frontend tests: `cd app && npx jest --passWithNoTests`
  - Run all backend tests: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - Verify barcode icon behavior: flag OFF → manual input, flag ON + mobile → camera scanner
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The existing `BarcodeScanner.tsx` and backend barcode service are NOT being rewritten — only enhanced
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- Feature flag enables instant rollback without a deploy
