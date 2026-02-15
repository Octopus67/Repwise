# Requirements Document

## Introduction

This spec addresses 32 bugs identified during a bug bash, organized by severity (P0 through P2). The fixes span broken design token references causing runtime crashes and invisible UI, UX-critical missing safeguards, logic bugs, and polish improvements across the React Native frontend and Python FastAPI backend.

## Glossary

- **Token_System**: The design token module at `app/theme/tokens.ts` exporting `colors`, `typography`, `spacing`, `radius`, and `motion`
- **BarcodeScanner**: The barcode scanning component at `app/components/nutrition/BarcodeScanner.tsx`
- **RecipeBuilder**: The recipe creation screen at `app/screens/nutrition/RecipeBuilderScreen.tsx`
- **Dashboard**: The main dashboard screen at `app/screens/dashboard/DashboardScreen.tsx`
- **AddNutritionModal**: The nutrition logging modal at `app/components/modals/AddNutritionModal.tsx`
- **AddTrainingModal**: The training logging modal at `app/components/modals/AddTrainingModal.tsx`
- **NutritionReport**: The micronutrient report screen at `app/screens/nutrition/NutritionReportScreen.tsx`
- **DateScroller**: The horizontal date picker component at `app/components/dashboard/DateScroller.tsx`
- **UnitConversion**: The weight/height conversion utility at `app/utils/unitConversion.ts`
- **RDA**: Recommended Daily Allowance for micronutrients

## Requirements

### Requirement 1: Fix Broken Color Token References

**User Story:** As a user, I want all UI elements to render with correct background and icon colors, so that the app is visually usable and not broken.

#### Acceptance Criteria

1. WHEN the BarcodeScanner renders any card or container, THE Token_System SHALL provide a valid background color via `colors.bg.surface` or `colors.bg.surfaceRaised` instead of the non-existent `colors.bg.card`
2. WHEN the BarcodeScanner renders an input field, THE Token_System SHALL provide a valid background color via `colors.bg.surfaceRaised` instead of the non-existent `colors.bg.input`
3. WHEN the RecipeBuilder renders a trash/delete icon, THE Token_System SHALL provide a valid color via `colors.semantic.negative` instead of the non-existent `colors.accent.error`
4. WHEN the RecipeBuilder renders a success checkmark icon, THE Token_System SHALL provide a valid color via `colors.semantic.positive` instead of the non-existent `colors.accent.success`
5. WHEN the RecipeBuilder renders any card, container, or border, THE Token_System SHALL provide valid background colors via `colors.bg.surface` or `colors.bg.surfaceRaised` instead of the non-existent `colors.bg.card`

### Requirement 2: Fix Broken Typography Token References

**User Story:** As a user, I want all text to render with correct font sizes and weights, so that the app is readable and does not crash.

#### Acceptance Criteria

1. WHEN the BarcodeScanner renders text using `typography.body.fontSize`, THE BarcodeScanner SHALL use `typography.size.base` instead, since `typography.body` does not exist
2. WHEN the BarcodeScanner renders heading text using `typography.h3.fontSize`, THE BarcodeScanner SHALL use `typography.size.xl` instead, since `typography.h3` does not exist
3. WHEN the BarcodeScanner renders caption text using `typography.caption.fontSize`, THE BarcodeScanner SHALL use `typography.size.xs` instead, since `typography.caption` does not exist
4. WHEN the RecipeBuilder uses spread syntax like `...typography.body`, `...typography.heading2`, `...typography.heading3`, `...typography.heading4`, or `...typography.caption`, THE RecipeBuilder SHALL replace each spread with explicit `fontSize` and `fontWeight` properties using valid token paths
5. FOR ALL style rules referencing typography tokens, THE Token_System SHALL only be accessed via `typography.size.*` and `typography.weight.*` paths that exist in the token definition

### Requirement 3: Unsaved Data Confirmation Dialogs

**User Story:** As a user, I want to be warned before losing unsaved data when closing a modal, so that I don't accidentally discard my input.

#### Acceptance Criteria

1. WHEN a user attempts to close the AddNutritionModal with non-empty form fields, THE AddNutritionModal SHALL display a confirmation dialog before discarding the data
2. WHEN a user attempts to close the AddTrainingModal with exercises that have data entered, THE AddTrainingModal SHALL display a confirmation dialog before discarding the data
3. WHEN a user attempts to close the RecipeBuilder with a non-empty recipe name or ingredients, THE RecipeBuilder SHALL display a confirmation dialog before discarding the data
4. WHEN the user confirms the discard action in the dialog, THE modal SHALL close and reset its state
5. WHEN the user cancels the discard action in the dialog, THE modal SHALL remain open with all data preserved

### Requirement 4: Nutrition Report RDA Defaults Warning

**User Story:** As a user, I want to know when the Nutrition Report is using default demographic values for RDA calculations, so that I can set my profile for accurate recommendations.

#### Acceptance Criteria

1. WHEN the NutritionReport loads and the user has not set their age or sex in their profile, THE NutritionReport SHALL display a visible warning banner indicating that default values (age=30, sex=male) are being used
2. WHEN the warning banner is displayed, THE NutritionReport SHALL provide a link or button to navigate to the profile settings screen
3. WHEN the user has set both age and sex in their profile, THE NutritionReport SHALL use the user's actual values and not display the warning banner

### Requirement 5: Pre-fill Meal Name in AddNutritionModal

**User Story:** As a user, I want the meal name to be pre-filled when I tap "+" on a meal slot, so that I don't have to type it manually.

#### Acceptance Criteria

1. WHEN the Dashboard passes a `prefilledMealName` to the AddNutritionModal, THE AddNutritionModal SHALL accept and use the value to pre-fill the notes/meal name field
2. WHEN the AddNutritionModal opens without a `prefilledMealName`, THE AddNutritionModal SHALL leave the notes/meal name field empty

### Requirement 6: Fix Weight Conversion Round-Trip Precision

**User Story:** As a developer, I want weight conversion round-trips to stay within acceptable tolerance, so that users don't see accumulated rounding errors.

#### Acceptance Criteria

1. THE UnitConversion `kgToLbs` and `lbsToKg` functions SHALL use sufficient decimal precision to keep round-trip error within 0.01 kg
2. WHEN converting kg→lbs→kg, THE UnitConversion SHALL produce a result within 0.01 of the original value for all inputs between 0.1 and 500 kg

### Requirement 7: Remove Unused Imports and Dead Code

**User Story:** As a developer, I want clean code without unused imports, so that the codebase is maintainable and bundle size is minimized.

#### Acceptance Criteria

1. THE Dashboard SHALL not import `radius` if it is unused
2. THE Dashboard SHALL not import `WeeklyCheckinData` type if it is unused
3. THE NutritionReport SHALL not import `Animated` if it is unused
4. THE NutritionReport SHALL not contain the unused `COLOR_SUBTLE_MAP` constant
5. THE NutritionReport SHALL not import `MICRO_FIELDS` if it is unused at the top level

### Requirement 8: Date Scroller Today Highlight

**User Story:** As a user, I want to see which date is "today" in the date scroller, so that I can quickly orient myself.

#### Acceptance Criteria

1. WHEN the DateScroller renders, THE DateScroller SHALL visually distinguish today's date from other dates using a distinct style (e.g., a "Today" label or unique color)
2. WHEN today's date is also the selected date, THE DateScroller SHALL show both the today indicator and the selected state

### Requirement 9: Success Toasts After Logging

**User Story:** As a user, I want to see a brief success confirmation after logging bodyweight, nutrition, or training, so that I know my entry was saved.

#### Acceptance Criteria

1. WHEN a bodyweight entry is successfully logged, THE AddBodyweightModal SHALL display a brief success toast or feedback message
2. WHEN a training session is successfully logged, THE AddTrainingModal SHALL display a brief success toast or feedback message
3. WHEN a nutrition entry is successfully logged, THE AddNutritionModal SHALL display a brief success toast or feedback message

### Requirement 10: Keyboard Dismissal on Outside Tap

**User Story:** As a user, I want the keyboard to dismiss when I tap outside of input fields in modals, so that I can see the full modal content.

#### Acceptance Criteria

1. WHEN a user taps outside of any text input within a modal, THE modal SHALL dismiss the keyboard

### Requirement 11: Nutrient Rows Show Actual RDA Value

**User Story:** As a user, I want to see the actual RDA target value alongside the percentage, so that I understand what 100% means.

#### Acceptance Criteria

1. WHEN a nutrient row displays RDA percentage, THE NutritionReport SHALL also display the actual RDA value with its unit (e.g., "15mg" next to "75%")

### Requirement 12: Prevent Future Date Navigation in Nutrition Report

**User Story:** As a user, I want the Nutrition Report to prevent navigating to future dates, so that I don't see empty reports for dates that haven't happened yet.

#### Acceptance Criteria

1. WHEN the selected date in the NutritionReport is today, THE NutritionReport SHALL disable or hide the "next day" navigation button
2. WHEN a user attempts to navigate to a future date, THE NutritionReport SHALL prevent the navigation

### Requirement 13: Rest Timer Units Label

**User Story:** As a user, I want rest timer preferences to show units, so that I know the value represents seconds.

#### Acceptance Criteria

1. WHEN rest timer preferences display a numeric value, THE RestTimer settings SHALL append a "seconds" or "s" label to the displayed value

### Requirement 14: Loading State on Date Switch

**User Story:** As a user, I want to see a loading indicator when switching dates on the dashboard, so that I know data is being fetched.

#### Acceptance Criteria

1. WHEN the user selects a different date on the DateScroller, THE Dashboard SHALL show a loading indicator while fetching data for the new date
2. WHEN the data fetch completes, THE Dashboard SHALL hide the loading indicator and display the updated data

### Requirement 15: Haptic Feedback on Interactive Elements

**User Story:** As a user, I want subtle haptic feedback on key interactive elements, so that the app feels responsive and tactile.

#### Acceptance Criteria

1. WHEN a user taps a quick action button on the Dashboard, THE Dashboard SHALL trigger a light haptic feedback
2. WHEN a user completes a swipe-to-delete action, THE system SHALL trigger a medium haptic feedback

### Requirement 16: Date Formatting on Logs Screen

**User Story:** As a user, I want dates on the Logs screen to be human-readable, so that I can quickly understand when entries were logged.

#### Acceptance Criteria

1. WHEN the Logs screen displays date headers, THE Logs screen SHALL format dates as human-readable strings (e.g., "Monday, Jan 15") instead of ISO format (e.g., "2024-01-15")

### Requirement 17: Body Fat Optional Label in Onboarding

**User Story:** As a user, I want the body fat percentage field to be clearly marked as optional during onboarding, so that I don't feel pressured to provide it.

#### Acceptance Criteria

1. WHEN the onboarding screen displays the body fat percentage field, THE onboarding screen SHALL display an "(optional)" label next to the field label

### Requirement 18: Articles Section Empty State

**User Story:** As a user, I want to see a helpful empty state when no articles are available, so that the section doesn't just disappear.

#### Acceptance Criteria

1. WHEN the articles API returns an empty list, THE Dashboard SHALL display a subtle empty state message instead of hiding the section entirely

### Requirement 19: Avatar Initial Updates After Name Change

**User Story:** As a user, I want my avatar initial to update immediately after I change my name in profile settings, so that the UI stays consistent.

#### Acceptance Criteria

1. WHEN a user updates their display name in profile settings, THE profile avatar SHALL immediately reflect the new initial letter
