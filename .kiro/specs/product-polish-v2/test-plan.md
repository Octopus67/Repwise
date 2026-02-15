# Comprehensive Test Plan — Product Polish V2

## Current State
- Frontend: 46 suites, 300 tests
- Backend: 257 tests
- Total: 557 tests

## Bugs Found (Priority Order)

### P0 — Logic Bugs (will produce wrong results)
1. `quickAddValidation.ts` — NaN passes validation as valid
2. `tdeeEstimation.ts` — Division by zero when windowDays=0
3. `mealPlanLogic.ts` — Negative serving_multiplier not guarded
4. `servingOptions.ts` — Duplicate "1 oz" entries, broken 0g default

### P1 — Edge Case Bugs
5. `comparisonColor.ts` — Negative target not handled
6. `rdaValues.ts` — Age < 19 silently returns adult RDA
7. `unitConversion.ts` — NaN/Infinity inputs propagate silently
8. `calculateStreak.ts` — O(n²) performance with Array.includes

### Files With ZERO Test Coverage
9. `servingOptions.ts` — 3 functions, 0 tests
10. `filterExercises.ts` — 1 function, 0 tests
11. `extractRecentExercises.ts` — 1 function, 0 tests

### Significant Coverage Gaps
12. `unitConversion.ts` — kgToLbs, lbsToKg, parseWeightToKg untested
13. `progressRingLogic.ts` — formatRingLabel untested
14. `mealBuilderLogic.ts` — getDefaultMealNameForHour, RESET action untested

## Execution Plan
- Phase 1: Fix P0 bugs (4 files)
- Phase 2: Fix P1 bugs (4 files)
- Phase 3: Add tests for zero-coverage files (3 new test files)
- Phase 4: Fill coverage gaps (4 existing test files)
