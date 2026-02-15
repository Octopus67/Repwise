# Implementation Plan: Premium Polish V1

## Overview

Surgical bug fixes organized by priority. Each task group targets a severity tier. All changes are find-and-replace token fixes, small logic additions, or UI polish — no new screens or APIs.

## Tasks

- [x] 1. P0 Code Fixes — Token Replacements in BarcodeScanner + RecipeBuilderScreen
  - [x] 1.1 Fix color token references in BarcodeScanner.tsx
    - Replace `colors.bg.card` → `colors.bg.surfaceRaised` in `messageCard` and `confirmCard` styles
    - Replace `colors.bg.input` → `colors.bg.surfaceRaised` in `servingInput` and `closeBtn` styles
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Fix typography token references in BarcodeScanner.tsx
    - Replace `typography.body.fontSize` → `typography.size.base` in `instructionText`, `cancelScanBtnText`, `messageText`, `servingLabel`, `servingInput`, `primaryBtnText`, `closeBtnText`
    - Replace `typography.h3.fontSize` → `typography.size.xl` in `messageTitle`, `confirmTitle`, `macroValue`
    - Replace `typography.caption.fontSize` → `typography.size.xs` in `confirmServing`, `macroLabel`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 1.3 Fix color token references in RecipeBuilderScreen.tsx
    - Replace all `colors.bg.card` → `colors.bg.surfaceRaised` in styles (header borderBottomColor, input, totalsBar, searchResults, qtyInputSmall, ingredientRow, nutritionCard, reviewIngRow, secondaryBtn)
    - Replace `colors.accent.error` → `colors.semantic.negative` (trash icon)
    - Replace `colors.accent.success` → `colors.semantic.positive` (checkmark icon)
    - _Requirements: 1.3, 1.4, 1.5_
  - [x] 1.4 Fix typography spread syntax in RecipeBuilderScreen.tsx
    - Replace `...typography.body` → `fontSize: typography.size.base, fontWeight: typography.weight.regular` in all affected styles
    - Replace `...typography.heading2` → `fontSize: typography.size['2xl'], fontWeight: typography.weight.bold`
    - Replace `...typography.heading3` → `fontSize: typography.size.xl, fontWeight: typography.weight.bold`
    - Replace `...typography.heading4` → `fontSize: typography.size.lg, fontWeight: typography.weight.semibold`
    - Replace `...typography.caption` → `fontSize: typography.size.xs, fontWeight: typography.weight.regular`
    - _Requirements: 2.4, 2.5_

- [x] 2. Checkpoint — Verify P0 code fixes compile
  - Run `npx tsc --noEmit` to verify no type errors in BarcodeScanner.tsx and RecipeBuilderScreen.tsx
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. P0 UX Fixes — Confirmation Dialogs, RDA Warning, Meal Name Pre-fill
  - [x] 3.1 Add unsaved data confirmation to AddNutritionModal
    - Add `hasUnsavedData()` helper checking calories, protein, carbs, fat, notes, searchQuery
    - Wrap `handleClose` to show `Alert.alert` confirmation when data exists
    - _Requirements: 3.1, 3.4, 3.5_
  - [x] 3.2 Add unsaved data confirmation to AddTrainingModal
    - Add `hasUnsavedData()` helper checking if any exercise has name or set data
    - Wrap `handleClose` to show `Alert.alert` confirmation when data exists
    - _Requirements: 3.2_
  - [x] 3.3 Add unsaved data confirmation to RecipeBuilderScreen
    - Add `hasUnsavedData()` helper checking recipeName and ingredients.length
    - Wrap `handleClose` to show `Alert.alert` confirmation when data exists
    - _Requirements: 3.3_
  - [x] 3.4 Add RDA defaults warning banner to NutritionReportScreen
    - Detect when `store.profile?.age` or `store.profile?.sex` is missing
    - Render yellow warning banner with "Update your profile" link
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 3.5 Pass prefilledMealName to AddNutritionModal
    - Add `prefilledMealName?: string` to AddNutritionModal Props
    - Pass `prefilledMealName={prefilledMealName}` from DashboardScreen
    - Add `useEffect` to populate notes field when `prefilledMealName` is provided
    - _Requirements: 5.1, 5.2_
  - [ ]* 3.6 Write property test for dirty form confirmation
    - **Property 2: Dirty Form Triggers Confirmation**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 4. Checkpoint — Verify P0 UX fixes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. P1 Logic Fixes — Weight Conversion, Unused Imports, Schema Type
  - [x] 5.1 Fix weight conversion precision in unitConversion.ts
    - Change `kgToLbs`: round to 2 decimal places (`* 100 / 100` instead of `* 10 / 10`)
    - Change `lbsToKg`: round to 2 decimal places
    - _Requirements: 6.1, 6.2_
  - [x]* 5.2 Update weight conversion property test tolerance
    - Update `weightConversion.test.ts` round-trip tolerance from 0.1/0.15 to 0.01/0.02
    - **Property 4: Weight Conversion Round-Trip**
    - **Validates: Requirements 6.1, 6.2**
  - [x] 5.3 Remove unused imports from DashboardScreen.tsx
    - Remove `radius` from tokens import
    - Remove `WeeklyCheckinData` type import (keep `WeeklyCheckinCard`)
    - _Requirements: 7.1, 7.2_
  - [x] 5.4 Remove unused imports and dead code from NutritionReportScreen.tsx
    - Remove `Animated` from react-native import
    - Remove `MICRO_FIELDS` from microNutrientSerializer import
    - Remove `COLOR_SUBTLE_MAP` constant
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 6. Checkpoint — Verify P1 logic fixes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. P1 UX Fixes — Today Highlight, Success Toasts, Loading States, RDA Display, Future Dates
  - [x] 7.1 Add today highlight to DateScroller
    - Compute `today` date string and compare with each cell's date
    - Add `dayCellToday` style with subtle indicator (e.g., dot or "Today" micro-label)
    - Handle combined today + selected state
    - _Requirements: 8.1, 8.2_
  - [x] 7.2 Add success toasts to AddTrainingModal and AddBodyweightModal
    - After successful API call in AddTrainingModal, show brief Alert before closing
    - After successful API call in AddBodyweightModal, show brief Alert before closing
    - _Requirements: 9.1, 9.2_
  - [x] 7.3 Add keyboard dismissal to modals
    - Wrap modal ScrollView content with `TouchableWithoutFeedback` + `Keyboard.dismiss()`
    - Apply to AddNutritionModal, AddTrainingModal, AddBodyweightModal
    - _Requirements: 10.1_
  - [x] 7.4 Show actual RDA value in nutrient rows
    - In NutrientRow component, add RDA value display next to percentage (e.g., "/ 15mg")
    - Add `rdaActual` style
    - _Requirements: 11.1_
  - [x] 7.5 Prevent future date navigation in NutritionReportScreen
    - Compute `today` and compare with `selectedDate`
    - Disable forward button when `selectedDate >= today`
    - Apply muted style to disabled button
    - _Requirements: 12.1, 12.2_
  - [x] 7.6 Add units label to rest timer preferences
    - Append "s" label to rest timer duration display in RestTimer settings
    - _Requirements: 13.1_
  - [x] 7.7 Add loading state when switching dates on Dashboard
    - Add `dateLoading` state, set true on date select, false on data load complete
    - Show subtle loading indicator on macro rings section during loading
    - _Requirements: 14.1, 14.2_
  - [ ]* 7.8 Write property test for date formatting
    - **Property 7: Date Header Formatting**
    - **Validates: Requirements 16.1**

- [x] 8. Checkpoint — Verify P1 UX fixes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. P2 Polish — Haptics, Animations, Optional Labels, Date Formatting, Empty States
  - [x] 9.1 Add haptic feedback to quick action buttons
    - Import expo-haptics in DashboardScreen
    - Trigger `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on quick action press
    - Wrap in try/catch for web fallback
    - _Requirements: 15.1, 15.2_
  - [x] 9.2 Format date headers on Logs screen
    - Replace ISO date format with `toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })`
    - _Requirements: 16.1_
  - [x] 9.3 Mark body fat field as optional in onboarding
    - Add "(optional)" text next to body fat percentage field label in OnboardingScreen.tsx
    - _Requirements: 17.1_
  - [x] 9.4 Add articles empty state on Dashboard
    - When `articles.length === 0`, show subtle empty state message instead of hiding section
    - _Requirements: 18.1_
  - [x] 9.5 Fix avatar initial update after name change
    - Ensure ProfileScreen reads displayName reactively from store so avatar initial updates on name change
    - _Requirements: 19.1_

- [x] 10. Final Checkpoint — All fixes verified
  - Run full test suite: `yarn test` (frontend) and `pytest` (backend)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each priority tier
- P0 code fixes (Task 1) are pure find-and-replace operations — lowest risk, highest impact
- Property tests validate universal correctness properties; unit tests validate specific examples
