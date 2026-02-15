# Design Document: Premium Polish V1

## Overview

This design addresses 32 bugs from a bug bash across the React Native frontend and Python FastAPI backend. The fixes are organized into five priority tiers (P0 code crashes, P0 UX-critical, P1 logic, P1 UX-annoying, P2 polish) and involve token replacements, new UI safeguards, precision fixes, and polish improvements.

All changes are surgical — no new screens, no new API endpoints, no architectural changes. The goal is to fix what's broken and polish what's rough.

## Architecture

No architectural changes. All fixes are within existing components and utilities:

```
app/
├── components/
│   ├── nutrition/BarcodeScanner.tsx      ← P0 token fixes
│   ├── dashboard/DateScroller.tsx        ← P1 today highlight
│   ├── modals/AddNutritionModal.tsx      ← P0 confirmation + prefill
│   ├── modals/AddTrainingModal.tsx       ← P0 confirmation
│   ├── modals/AddBodyweightModal.tsx     ← P1 success toast
│   └── training/RestTimer.tsx            ← P1 units label
├── screens/
│   ├── nutrition/RecipeBuilderScreen.tsx  ← P0 token fixes + confirmation
│   ├── nutrition/NutritionReportScreen.tsx ← P0 RDA warning + P1 fixes
│   ├── dashboard/DashboardScreen.tsx      ← P1 loading state + cleanup
│   ├── logs/LogsScreen.tsx               ← P2 date formatting
│   └── onboarding/OnboardingScreen.tsx   ← P2 optional label
├── utils/
│   └── unitConversion.ts                 ← P1 precision fix
└── theme/tokens.ts                       ← Reference only (no changes)
```

## Components and Interfaces

### P0 Code Fixes: Token Replacements

#### BarcodeScanner.tsx — Color Token Fixes

All instances of non-existent tokens must be replaced:

| Non-existent Token | Replacement | Occurrences |
|---|---|---|
| `colors.bg.card` | `colors.bg.surfaceRaised` | `messageCard`, `confirmCard` styles |
| `colors.bg.input` | `colors.bg.surfaceRaised` | `servingInput`, `closeBtn` styles |

#### BarcodeScanner.tsx — Typography Token Fixes

All `.fontSize` accesses on undefined objects must be replaced with direct token values:

| Broken Access | Replacement | Occurrences |
|---|---|---|
| `typography.body.fontSize` | `typography.size.base` (14) | `instructionText`, `cancelScanBtnText`, `messageText`, `servingLabel`, `servingInput`, `primaryBtnText`, `closeBtnText` |
| `typography.h3.fontSize` | `typography.size.xl` (20) | `messageTitle`, `confirmTitle`, `macroValue` |
| `typography.caption.fontSize` | `typography.size.xs` (12) | `confirmServing`, `macroLabel` |

#### RecipeBuilderScreen.tsx — Color Token Fixes

| Non-existent Token | Replacement | Occurrences |
|---|---|---|
| `colors.bg.card` | `colors.bg.surfaceRaised` | `header` borderBottomColor, `input`, `totalsBar`, `searchResults`, `qtyInputSmall`, `ingredientRow` borderBottomColor, `nutritionCard`, `reviewIngRow` borderBottomColor, `secondaryBtn`, all card-like containers |
| `colors.accent.error` | `colors.semantic.negative` | trash icon color in ingredient row |
| `colors.accent.success` | `colors.semantic.positive` | checkmark icon in SAVED step |

#### RecipeBuilderScreen.tsx — Typography Token Fixes

All spread syntax on undefined typography objects must be replaced:

| Broken Spread | Replacement |
|---|---|
| `...typography.body` | `fontSize: typography.size.base, fontWeight: typography.weight.regular` |
| `...typography.heading2` | `fontSize: typography.size['2xl'], fontWeight: typography.weight.bold` |
| `...typography.heading3` | `fontSize: typography.size.xl, fontWeight: typography.weight.bold` |
| `...typography.heading4` | `fontSize: typography.size.lg, fontWeight: typography.weight.semibold` |
| `...typography.caption` | `fontSize: typography.size.xs, fontWeight: typography.weight.regular` |

Affected styles: `headerTitle`, `label`, `primaryBtnText`, `secondaryBtnText`, `totalsLabel`, `totalsValue`, `foodName`, `foodMacros`, `qtyUnit`, `sectionTitle`, `emptyText`, `recipeTitlePreview`, `recipeDescPreview`, `servingsPreview`, `nutritionTitle`, `nutritionRow`, `savedTitle`, `savedSubtitle`.

### P0 UX Fixes

#### Unsaved Data Confirmation (Requirement 3)

Add a `hasUnsavedData()` helper to each modal that checks if any form fields are non-empty. Wrap the `handleClose` function to check this before closing:

```typescript
// Pattern for all three modals:
const hasUnsavedData = (): boolean => {
  // Check relevant form fields
  return calories !== '' || protein !== '' || notes !== '' /* etc */;
};

const handleClose = () => {
  if (hasUnsavedData()) {
    Alert.alert(
      'Discard changes?',
      'You have unsaved data. Are you sure you want to close?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { reset(); onClose(); } },
      ]
    );
  } else {
    reset();
    onClose();
  }
};
```

For AddNutritionModal: check `calories`, `protein`, `carbs`, `fat`, `notes`, `searchQuery`.
For AddTrainingModal: check if any exercise has a name or set data.
For RecipeBuilderScreen: check `recipeName`, `ingredients.length`.

#### RDA Defaults Warning (Requirement 4)

In `NutritionReportScreen.tsx`, detect when `store.age` or `store.sex` is undefined/null and render a warning banner:

```typescript
const profileIncomplete = !store.profile?.age || !store.profile?.sex;
```

Render a yellow warning banner at the top of the report with text: "RDA values are based on defaults (age 30, male). Update your profile for personalized recommendations." with a "Set Profile →" button that navigates to profile settings.

#### Pre-fill Meal Name (Requirement 5)

In `DashboardScreen.tsx`, the `prefilledMealName` state is already set but never passed to `AddNutritionModal`. Fix:

```diff
- <AddNutritionModal visible={showNutrition} onClose={...} onSuccess={...} />
+ <AddNutritionModal visible={showNutrition} onClose={...} onSuccess={...} prefilledMealName={prefilledMealName} />
```

In `AddNutritionModal`, add `prefilledMealName?: string` to Props interface and use it:

```typescript
useEffect(() => {
  if (visible && prefilledMealName) {
    setNotes(prefilledMealName);
  }
}, [visible, prefilledMealName]);
```

### P1 Logic Fixes

#### Weight Conversion Precision (Requirement 6)

The current `kgToLbs` and `lbsToKg` both round to 1 decimal place independently, causing accumulated error on round-trips. Fix by increasing internal precision:

```typescript
export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 100) / 100; // 2 decimal places
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / KG_TO_LBS) * 100) / 100; // 2 decimal places
}
```

This keeps round-trip error under 0.01 while still producing clean display values. The `convertWeight` and `formatWeight` functions handle display rounding separately.

Update the property test tolerance from 0.1/0.15 to 0.01.

#### Unused Imports (Requirement 7)

In `DashboardScreen.tsx`:
- Remove `radius` from the `tokens` import
- Remove `WeeklyCheckinData` type import (keep `WeeklyCheckinCard` component import)

In `NutritionReportScreen.tsx`:
- Remove `Animated` import from `react-native`
- Remove `MICRO_FIELDS` from the `microNutrientSerializer` import
- Remove the `COLOR_SUBTLE_MAP` constant definition

#### FoodItemResponse Schema Type (Bug #11)

In `src/modules/food_database/schemas.py`, ensure `micro_nutrients` field type is `dict[str, Any] | None` consistently across all response schemas.

### P1 UX Fixes

#### DateScroller Today Highlight (Requirement 8)

In `DateScroller.tsx`, compute today's date and apply a distinct style:

```typescript
const today = new Date().toISOString().split('T')[0];
const isToday = dateStr === today;
```

Add styles: `dayCellToday` with a subtle bottom border or "Today" micro-label below the day number. When both `isToday` and `isSelected`, combine both styles.

#### Success Toasts (Requirement 9)

After successful submission in each modal, show a brief toast. Use a lightweight approach — `Alert.alert` with auto-dismiss or a custom toast component. For MVP, add a brief `Alert.alert('Logged!', 'Entry saved successfully.')` after each successful API call, then close the modal.

For AddTrainingModal, the current flow calls `onSuccess()` then `onClose()` — add a toast before closing.
For AddBodyweightModal, same pattern.
For AddNutritionModal, it already shows a "save as favorite" screen — this serves as confirmation.

#### Keyboard Dismissal (Requirement 10)

Wrap modal `ScrollView` content with `TouchableWithoutFeedback` + `Keyboard.dismiss()`:

```typescript
import { Keyboard, TouchableWithoutFeedback } from 'react-native';

// Wrap ScrollView content:
<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
  <ScrollView keyboardShouldPersistTaps="handled">
    {/* existing content */}
  </ScrollView>
</TouchableWithoutFeedback>
```

#### Nutrient Row RDA Display (Requirement 11)

In `NutrientRow` component within `NutritionReportScreen.tsx`, add the actual RDA value next to the percentage:

```typescript
{rda > 0 && (
  <>
    <Text style={styles.rdaActual}>/ {rda.toFixed(0)}{field.unit}</Text>
    <Text style={[styles.rdaPct, { color: barColor }]}>
      {Math.round(percentage)}%
    </Text>
  </>
)}
```

#### Future Date Prevention (Requirement 12)

In `NutritionReportScreen.tsx`, disable the forward button when `selectedDate >= today`:

```typescript
const today = formatDate(new Date());
const canGoForward = selectedDate < today;
```

Disable the "next" button and style it as muted when `!canGoForward`.

#### Rest Timer Units (Requirement 13)

In `RestTimer.tsx` settings display, append "s" or "seconds" to the numeric value display.

#### Loading State on Date Switch (Requirement 14)

In `DashboardScreen.tsx`, set a `dateLoading` state to true when `handleDateSelect` fires, and false when `loadDashboardData` completes. Show a subtle loading overlay or skeleton on the macro rings section during loading.

### P2 Polish

#### Haptic Feedback (Requirement 15)

Import `expo-haptics` and trigger `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on quick action button presses. Wrap in try/catch for web fallback.

#### Date Formatting on Logs Screen (Requirement 16)

Replace ISO date headers with formatted dates using `toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })`.

#### Body Fat Optional Label (Requirement 17)

In `OnboardingScreen.tsx`, add "(optional)" text next to the body fat percentage field label.

#### Articles Empty State (Requirement 18)

Instead of conditionally hiding the articles section when `articles.length === 0`, show a subtle empty state: "No articles available right now."

#### Avatar Initial Update (Requirement 19)

Ensure the profile screen reads the display name from the store reactively so the avatar initial updates when the name changes.

## Data Models

No new data models. All fixes operate on existing data structures.

The only schema change is ensuring `micro_nutrients: dict[str, Any] | None` is consistent in `FoodItemResponse` in `src/modules/food_database/schemas.py`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Reference Validity

*For any* style rule in BarcodeScanner.tsx and RecipeBuilderScreen.tsx that references a color or typography token, the referenced token path must resolve to a defined, non-undefined value in the token system.

**Validates: Requirements 1.1–1.5, 2.1–2.5**

### Property 2: Dirty Form Triggers Confirmation

*For any* modal (AddNutritionModal, AddTrainingModal, RecipeBuilderScreen) with at least one non-empty/non-default form field, invoking the close action must trigger a confirmation dialog rather than immediately closing.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Pre-filled Meal Name Passthrough

*For any* non-empty string passed as `prefilledMealName` to AddNutritionModal, the notes/meal name field must be populated with that string when the modal opens.

**Validates: Requirements 5.1, 5.2**

### Property 4: Weight Conversion Round-Trip

*For any* weight value between 0.1 and 500 kg, converting via `kgToLbs` then `lbsToKg` must produce a result within 0.01 of the original value. Similarly, *for any* weight between 0.2 and 1100 lbs, converting via `lbsToKg` then `kgToLbs` must produce a result within 0.02 of the original.

**Validates: Requirements 6.1, 6.2**

### Property 5: Nutrient Row RDA Display

*For any* nutrient with a non-zero RDA value, the rendered nutrient row must include both the percentage and the actual RDA value with its unit.

**Validates: Requirements 11.1**

### Property 6: Future Date Prevention

*For any* date that is today or in the future, the NutritionReport forward navigation must be disabled, preventing the user from viewing future dates.

**Validates: Requirements 12.1, 12.2**

### Property 7: Date Header Formatting

*For any* valid ISO date string, the Logs screen date formatting function must produce a human-readable string containing the day name, month abbreviation, and day number (not ISO format).

**Validates: Requirements 16.1**

### Property 8: Avatar Initial Derivation

*For any* non-empty display name string, the avatar initial must equal the first character of that string (uppercased).

**Validates: Requirements 19.1**

## Error Handling

No new error handling patterns. Existing error handling (try/catch with Alert.alert fallbacks) is preserved. The confirmation dialogs (Requirement 3) use React Native's `Alert.alert` with cancel/destructive button options.

For haptic feedback (Requirement 15), all calls are wrapped in try/catch to gracefully degrade on platforms without haptic support.

## Testing Strategy

### Unit Tests

- Verify each token replacement compiles without undefined access (snapshot or render tests)
- Test `hasUnsavedData()` helper functions with specific form states
- Test date formatting function with known dates
- Test avatar initial derivation with edge cases (empty string, single char, unicode)

### Property-Based Tests

Using `fast-check` for frontend (TypeScript) and `hypothesis` for backend (Python):

- **Property 4** (weight round-trip): Already has tests in `app/__tests__/utils/weightConversion.test.ts` — update tolerance from 0.1 to 0.01
- **Property 7** (date formatting): Generate random valid dates, verify output matches human-readable pattern
- **Property 8** (avatar initial): Generate random non-empty strings, verify first char match

Each property test runs minimum 100 iterations. Tests are tagged with:
`Feature: premium-polish-v1, Property N: {property_text}`
