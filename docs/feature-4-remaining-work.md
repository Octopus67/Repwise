# Feature 4: Theme Migration — Remaining Work

**Status:** P0 critical issues fixed. Broad migration incomplete.
**Estimated effort:** 3–5 days

---

## What Was Fixed (P0)

| Issue | Fix |
|-------|-----|
| `accent.primary` failed WCAG AA on white | `#0EA5E9` → `#0284C7` (4.5:1 ratio) |
| `semantic.positive` low contrast | `#16A34A` → `#15803D` |
| `semantic.warning` low contrast | `#D97706` → `#B45309` |
| OnboardingScreen 33+ inline `colors.` refs | Migrated to `c.` via `useThemeColors()` |
| PlateCalculatorSheet plates invisible on light bg | Added border for light plates, themed text color |
| NudgeCard hardcoded hex colors | Replaced with `c.semantic.*` / `c.text.*` |
| HUExplainerSheet hardcoded legend colors | Mapped to `c.heatmap.*` / `c.semantic.*` tokens |
| All `lightColors.ts` downstream refs | Updated chart, macro, heatmap, gradient, border.focus |

---

## Remaining: 167 Files with Mixed `colors.`/`c.` Patterns

These files import `useThemeColors` but still have static `colors.` refs in `StyleSheet.create` blocks. The inline JSX uses `c.` correctly but the StyleSheet fallback colors are dark-theme-only.

**High-traffic screens (prioritize first):**
- `screens/dashboard/DashboardScreen.tsx`
- `screens/training/ActiveWorkoutScreen.tsx`
- `screens/training/SessionDetailScreen.tsx`
- `screens/nutrition/RecipeBuilderScreen.tsx`
- `screens/analytics/AnalyticsScreen.tsx`
- `screens/logs/LogsScreen.tsx`
- `screens/reports/WeeklyReportScreen.tsx`
- `screens/learn/LearnScreen.tsx`
- `screens/coaching/CoachingScreen.tsx`

**High-count files (most `colors.` refs):**
- `components/modals/AddNutritionModal.tsx` (52 refs)
- `components/learn/ArticleChart.tsx` (45 refs)
- `components/modals/AddTrainingModal.tsx` (39 refs)
- `screens/nutrition/NutritionReportScreen.tsx` (35 refs)
- `components/coaching/WeeklyCheckinCard.tsx` (34 refs)
- `screens/learn/LearnScreen.tsx` (33 refs)
- `screens/analytics/AnalyticsScreen.tsx` (32 refs)

---

## Remaining: 19 Files with No Theme Hook (Static `colors.` Only)

These files use `colors.` directly without `useThemeColors` and need full migration:

**Components:**
- `components/common/ErrorBoundary.tsx`
- `components/common/Icon.tsx`
- `components/common/SwipeableRow.tsx`
- `components/common/Tooltip.tsx`
- `components/nutrition/BarcodeScanner.tsx`
- `components/profile/AllergiesPicker.tsx`
- `components/profile/CuisinePreferencesPicker.tsx`
- `components/profile/DietaryRestrictionsPicker.tsx`
- `components/profile/DietStylePicker.tsx`
- `components/profile/ExerciseFrequencyPicker.tsx`
- `components/profile/ExerciseTypesPicker.tsx`
- `components/profile/MealFrequencyStepper.tsx`
- `components/profile/ProteinTargetSlider.tsx`

**Utility files (non-React, need `getThemeColors()`):**
- `config/muscleGroups.ts`
- `utils/budgetComputation.ts`
- `utils/comparisonColor.ts`
- `utils/microDashboardLogic.ts`
- `utils/muscleVolumeLogic.ts`
- `utils/periodizationUtils.ts`

---

## Onboarding Wizard Steps (Partial Migration)

The new `OnboardingWizard` step files have mixed patterns:
- `steps/LifestyleStep.tsx` (28 `colors.` refs)
- `steps/DietStyleStep.tsx` (24 refs)
- `steps/GoalStep.tsx` (24 refs)
- `steps/BodyCompositionStep.tsx` (23 refs)
- `steps/TDEERevealStep.tsx` (22 refs)
- `steps/BodyMeasurementsStep.tsx` (18 refs)
- `steps/FoodDNAStep.tsx` (15 refs)
- `steps/BodyBasicsStep.tsx` (14 refs)
- `steps/FastTrackStep.tsx` (13 refs)
- `steps/SmartTrainingStep.tsx` (11 refs)
- `steps/SummaryStep.tsx` (8 refs)
- `steps/IntentStep.tsx` (8 refs)

---

## Test Coverage Gaps

- No theme-toggle integration tests exist
- `__tests__/audit/colorAudit.test.ts` and `__tests__/tokens/contrastCompliance.test.ts` exist but may need updates for new color values
- No visual regression tests for light mode
- FilterPill test (`__tests__/components/FilterPill.test.tsx`) references static `colors.` — may break if FilterPill is migrated

---

## Migration Pattern

For each file:
1. Add `const c = useThemeColors();` (or `getThemeColors()` for non-React)
2. Replace `colors.xxx` in JSX inline styles with `c.xxx`
3. Remove `color:` properties from `StyleSheet.create` that are overridden by inline styles
4. For StyleSheet-only colors (no inline override), move to inline `{ color: c.xxx }`
5. Remove `colors` from import if no longer used

---

## Priority Order

1. **P1 (Week 1):** High-traffic screens + modals listed above
2. **P2 (Week 1–2):** 13 non-themed components (profile pickers, Tooltip, etc.)
3. **P3 (Week 2):** Onboarding wizard steps
4. **P4 (Week 2–3):** Utility files needing `getThemeColors()`
5. **P5 (Week 3):** Test updates + visual regression setup
