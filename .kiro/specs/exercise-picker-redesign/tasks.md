# Implementation Plan: Exercise Picker Redesign

## Overview

Replace the inline `ExerciseSearchInput` dropdown in `AddTrainingModal.tsx` with a full-page `ExercisePickerScreen`. The work is primarily frontend (React Native/Expo with TypeScript) with a small backend data model update (Python/FastAPI). Tasks are ordered: data model → pure utilities → UI components → screen composition → navigation wiring → error handling.

**Tech stack:** Backend: Python 3.11+ / FastAPI. Frontend: React Native / Expo / TypeScript. Navigation: `@react-navigation/stack` v6. Testing: `jest` + `@testing-library/react-native` for unit tests, `fast-check` for property tests (TS), `hypothesis` for property tests (Python). Styling: theme tokens from `app/theme/tokens.ts`.

## Tasks

- [ ] 1. Backend: Add image_url field to exercise data
  - [x] 1.1 In `src/modules/training/exercises.py`, add `"image_url": None` key to every dict in the `EXERCISES` list (all 151+ entries)
    - The field is `str | None`, defaulting to `None`
    - No changes needed to `search_exercises()`, `get_all_exercises()`, or `get_muscle_groups()` — they return the dicts as-is, so the new field propagates automatically
    - Verify: `GET /training/exercises` response now includes `"image_url": null` on every exercise object
    - _Requirements: 5.1, 5.3_
  - [ ] 1.2 Write property test verifying all exercises have image_url field
    - Create `tests/test_exercise_image_url_property.py`
    - Use `hypothesis` to verify: for every exercise returned by `get_all_exercises()`, the dict contains the key `"image_url"` and its value is either `None` or a non-empty string
    - **Property 6: All exercises include image_url field**
    - **Validates: Requirements 5.1**

- [ ] 2. Frontend: Create exercise data types and muscle group config
  - [x] 2.1 Create `app/types/exercise.ts` exporting the `Exercise` TypeScript interface
    - Fields: `id: string`, `name: string`, `muscle_group: string`, `equipment: string`, `category: 'compound' | 'isolation'`, `image_url: string | null`
    - This is a type-only file, no runtime code
    - _Requirements: 5.1_
  - [x] 2.2 Create `app/config/muscleGroups.ts` exporting `MUSCLE_GROUP_CONFIG: MuscleGroupConfig[]` and the `MuscleGroupConfig` interface
    - Interface: `{ key: string; label: string; emoji: string; color: string }`
    - Must contain exactly 13 entries, one per muscle group: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, traps, forearms, full_body
    - Use the emoji/color mapping from the design document (e.g., chest → 🫁 / #EF4444, biceps → 💪 / #F59E0B)
    - Also export a `getMuscleGroupConfig(key: string): MuscleGroupConfig | undefined` lookup helper
    - _Requirements: 3.1, 6.2_
  - [ ] 2.3 Write property test verifying muscle group colors are unique
    - Create `app/__tests__/muscleGroupConfig.property.test.ts`
    - Assert: all 13 `color` values in `MUSCLE_GROUP_CONFIG` are distinct (no two groups share a color)
    - Assert: all 13 `key` values match the known muscle group strings
    - Assert: `getMuscleGroupConfig(key)` returns the correct entry for every key
    - **Property 7: Muscle group colors are unique**
    - **Validates: Requirements 6.2**

- [ ] 3. Frontend: Implement filterExercises pure utility
  - [x] 3.1 Create `app/utils/filterExercises.ts` exporting `filterExercises(exercises: Exercise[], searchText: string, muscleGroup: string | null): Exercise[]`
    - When `muscleGroup` is non-null: keep only exercises where `exercise.muscle_group === muscleGroup`
    - When `searchText` is non-empty (after `.trim()`): keep only exercises where `exercise.name.toLowerCase().includes(searchText.trim().toLowerCase())`
    - Both filters apply simultaneously (AND logic)
    - When both are empty/null: return the full list unchanged
    - This is a pure function with no side effects, no API calls
    - _Requirements: 2.1, 3.2, 8.1, 8.2, 8.3_
  - [ ] 3.2 Write property test for filter function correctness
    - Create `app/__tests__/filterExercises.property.test.ts`
    - Use `fast-check` with minimum 100 iterations
    - Generate: random arrays of Exercise objects, random search strings (including empty, whitespace-only, partial matches), random muscle group values (including null and invalid groups)
    - Assert: every returned exercise satisfies both filter conditions
    - Assert: no exercise satisfying both conditions is missing from results
    - Assert: when both filters are empty/null, result equals input
    - Assert: result is always a subset of input (length <= input length)
    - **Property 1: Filter function correctness**
    - **Validates: Requirements 2.1, 3.2, 8.1, 8.2, 8.3**

- [ ] 4. Frontend: Implement extractRecentExercises pure utility
  - [x] 4.1 Create `app/utils/extractRecentExercises.ts` exporting `extractRecentExercises(sessions: TrainingSession[], allExercises: Exercise[]): Exercise[]`
    - Input `sessions` is ordered most-recent-first (as returned by the API with `limit=5`)
    - Iterate through sessions in order, collecting exercise names. For each session, iterate its `exercises` array
    - Deduplicate by exercise name (first occurrence wins, preserving recency order)
    - Cap at 10 results
    - Map exercise names back to full `Exercise` objects using `allExercises` (skip names not found)
    - Return type: `Exercise[]` with length 0–10
    - Define a minimal `TrainingSession` type inline or import from existing types: `{ exercises: { exercise_name: string }[] }`
    - _Requirements: 7.1, 7.2_
  - [ ] 4.2 Write property test for recent exercises extraction
    - Create `app/__tests__/extractRecentExercises.property.test.ts`
    - Use `fast-check` with minimum 100 iterations
    - Generate: random arrays of sessions with random exercise names, random allExercises lists
    - Assert: result length <= 10
    - Assert: all exercise names in result are distinct
    - Assert: result order matches first-seen order from sessions (most recent first)
    - Assert: every exercise in result exists in allExercises
    - **Property 12: Recent exercises are distinct and capped**
    - **Validates: Requirements 7.1**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Run `pytest tests/test_exercise_image_url_property.py` for backend
  - Run `npx jest --testPathPattern="muscleGroupConfig|filterExercises|extractRecentExercises"` for frontend
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Frontend: Build ExercisePickerScreen UI components
  - [x] 6.1 Create `app/components/exercise-picker/SearchBar.tsx`
    - Props: `value: string`, `onChangeText: (text: string) => void`, `onClear: () => void`, `resultCount: number | null`
    - Renders a `TextInput` with placeholder "Search exercises...", styled with `colors.bg.surfaceRaised`, `colors.border.default`, `colors.text.primary` from `app/theme/tokens.ts`
    - Shows a "✕" clear button (TouchableOpacity) on the right when `value` is non-empty
    - Shows result count text (e.g., "12 exercises") below the input when `resultCount` is non-null and > 0
    - Debounce is handled by the parent (ExercisePickerScreen), not inside this component — this is a controlled input
    - _Requirements: 2.1, 2.4, 10.3_
  - [x] 6.2 Create `app/components/exercise-picker/MuscleGroupGrid.tsx`
    - Props: `exercises: Exercise[]`, `onSelectMuscleGroup: (key: string) => void`
    - Renders a 2-column `FlatList` (`numColumns={2}`) of tiles using `MUSCLE_GROUP_CONFIG`
    - Each tile: colored background at 15% opacity (`rgba(color, 0.15)`), emoji centered (fontSize 32), label below (fontSize `typography.size.sm`), exercise count below label (e.g., "17 exercises" in `colors.text.muted`)
    - Exercise count per group: computed by filtering `exercises` prop by `muscle_group` and taking `.length`
    - Each tile: `accessibilityRole="button"`, `accessibilityLabel="{label} - {count} exercises"`
    - Tile size: flex 1 with `spacing[2]` gap, `radius.md` border radius, `spacing[4]` padding
    - _Requirements: 3.1, 9.1, 12.2_
  - [x] 6.3 Create `app/components/exercise-picker/ExerciseCard.tsx`
    - Props: `exercise: Exercise`, `onPress: (exercise: Exercise) => void`
    - Layout: horizontal row. Left: 48x48 circle with emoji placeholder (or `Image` if `image_url` is non-null). Center: exercise name (primary text, `typography.size.base`, `colors.text.primary`), below it a row of two tags — equipment tag (`colors.accent.primaryMuted` bg) and category tag (`colors.semantic.positiveSubtle` bg for compound, `colors.semantic.warningSubtle` bg for isolation). Right: chevron "›" in `colors.text.muted`
    - Emoji placeholder: use `getMuscleGroupConfig(exercise.muscle_group)` to get emoji and color. Render emoji on a circle with `rgba(color, 0.15)` background
    - Remote image: when `exercise.image_url` is non-null and non-empty, render `<Image source={{ uri: exercise.image_url }} />` with `onError` fallback to emoji placeholder
    - `accessibilityLabel="{name}, {equipment}, {category}"`
    - Wrap in `TouchableOpacity` with `activeOpacity={0.7}`
    - _Requirements: 4.1, 4.2, 4.3, 5.2, 10.2, 12.3_
  - [x] 6.4 Create `app/components/exercise-picker/RecentExercises.tsx`
    - Props: `exercises: Exercise[]`, `onPress: (exercise: Exercise) => void`
    - Renders nothing if `exercises.length === 0`
    - Otherwise: section header "Recent" in `colors.text.secondary`, then a horizontal `FlatList` (`horizontal={true}`, `showsHorizontalScrollIndicator={false}`)
    - Each item: compact card (~120px wide) with emoji icon (from muscle group config) and exercise name (2 lines max, `numberOfLines={2}`)
    - Styled with `colors.bg.surfaceRaised` background, `radius.sm` border radius, `spacing[2]` padding
    - _Requirements: 7.1, 7.4_
  - [ ] 6.5 Write unit tests for ExerciseCard rendering
    - Create `app/__tests__/ExerciseCard.test.tsx`
    - Use `@testing-library/react-native`
    - Test 1: render with `image_url: null` → verify emoji text is present, no `Image` component rendered
    - Test 2: render with `image_url: "https://example.com/img.png"` → verify `Image` component rendered with correct `source.uri`
    - Test 3: verify rendered output contains exercise name, equipment text, category text
    - Test 4: verify `accessibilityLabel` contains name, equipment, and category
    - Test 5: verify `onPress` is called with the exercise object when tapped
    - _Requirements: 4.1, 4.2, 4.3, 12.3_

- [ ] 7. Frontend: Build ExercisePickerScreen and compose all components
  - [x] 7.1 Create `app/screens/exercise-picker/ExercisePickerScreen.tsx`
    - Route params type: `{ onSelect: (exerciseName: string) => void }`
    - State: `exercises: Exercise[]` (fetched once), `recentExercises: Exercise[]` (derived), `searchText: string`, `selectedMuscleGroup: string | null`, `loading: boolean`, `error: boolean`
    - On mount: call `api.get('training/exercises')` to populate `exercises`. Call `api.get('training/sessions', { params: { limit: 5 } })` to get recent sessions, then call `extractRecentExercises(sessions, exercises)` to populate `recentExercises`
    - Compute `filteredExercises = filterExercises(exercises, debouncedSearchText, selectedMuscleGroup)` using `useMemo`
    - Debounce: use a 300ms debounce on `searchText` before passing to `filterExercises` (use a `useRef` timer or a `useDebouncedValue` hook)
    - Layout structure:
      - `SafeAreaView` with `colors.bg.base` background
      - Fixed header: back button (TouchableOpacity with "←" or "✕") + title "Choose Exercise" + `SearchBar` component
      - Content area (when no filter active): `RecentExercises` + `MuscleGroupGrid`
      - Content area (when filter active): `FlatList` of `ExerciseCard` items with `keyboardDismissMode="on-drag"`, `keyExtractor={item => item.id}`
      - When `selectedMuscleGroup` is set: show muscle group name as section header with a "✕ Clear" button
    - On exercise tap: call `route.params.onSelect(exercise.name)`, then `navigation.goBack()`
    - On back button tap: `navigation.goBack()` without calling `onSelect`
    - On muscle group tap: set `selectedMuscleGroup` to that group's key
    - On clear muscle group: set `selectedMuscleGroup` to null
    - On search clear: set `searchText` to ''
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 7.1, 7.2, 8.1, 8.2, 8.3, 10.1, 10.3, 11.1, 11.2, 11.3_

- [ ] 8. Frontend: Wire navigation and integrate with AddTrainingModal
  - [x] 8.1 Update navigation types and register ExercisePickerScreen
    - In `app/navigation/BottomTabNavigator.tsx`:
      - Add `ExercisePicker: { onSelect: (exerciseName: string) => void }` to `DashboardStackParamList` and `LogsStackParamList`
      - Add `<DashboardStack.Screen name="ExercisePicker" component={ExercisePickerScreen} />` inside `DashboardStackScreen()`
      - Add `<LogsStack.Screen name="ExercisePicker" component={ExercisePickerScreen} />` inside `LogsStackScreen()`
      - Import `ExercisePickerScreen` from `../../screens/exercise-picker/ExercisePickerScreen`
    - _Requirements: 1.1_
  - [x] 8.2 Update `app/components/modals/AddTrainingModal.tsx` to use ExercisePickerScreen
    - Remove the entire `ExerciseSearchInput` component and its `pickerStyles` StyleSheet from the file
    - Replace the `<ExerciseSearchInput value={ex.name} onChangeText={...} />` usage with a `TouchableOpacity` that displays the current exercise name (or placeholder "Tap to choose exercise")
    - On press: call `navigation.navigate('ExercisePicker', { onSelect: (name) => updateExerciseName(ex.id, name) })`
    - The modal needs access to `navigation` — either accept it as a prop, or use `useNavigation()` hook from `@react-navigation/native`
    - The modal stays mounted while the picker is open (the picker is a stack screen on top)
    - _Requirements: 1.1, 1.3, 1.4_
  - [ ] 8.3 Write unit tests for navigation integration
    - Create `app/__tests__/ExercisePickerNavigation.test.tsx`
    - Test 1: tapping the exercise name field in AddTrainingModal calls `navigation.navigate('ExercisePicker', ...)` with an `onSelect` function
    - Test 2: when `onSelect` callback fires with "Barbell Bench Press", the exercise name field in the modal updates to "Barbell Bench Press"
    - Test 3: pressing back on ExercisePickerScreen calls `navigation.goBack()` without invoking `onSelect`
    - Mock `useNavigation` and `route.params` as needed
    - _Requirements: 1.1, 1.3, 1.4_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx jest` for frontend, `pytest` for backend
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Frontend: Error handling and empty states
  - [ ] 10.1 Add error state to `ExercisePickerScreen`
    - When `api.get('training/exercises')` fails (catch block): set `error: true`, `loading: false`
    - Render: centered `View` with error icon "⚠️", text "Failed to load exercises" in `colors.text.secondary`, and a "Retry" `TouchableOpacity` button styled with `colors.accent.primary` that re-triggers the fetch
    - _Requirements: 11.1_
  - [ ] 10.2 Add empty search state to `ExercisePickerScreen`
    - When `filteredExercises.length === 0` and `(searchText || selectedMuscleGroup)` is active: render centered text "No exercises match your search" in `colors.text.muted`
    - If a muscle group filter is active, add a suggestion: "Try clearing the muscle group filter"
    - _Requirements: 2.2_
  - [ ] 10.3 Write unit tests for error and empty states
    - Create `app/__tests__/ExercisePickerStates.test.tsx`
    - Test 1: mock `api.get` to reject → verify "Failed to load exercises" text and "Retry" button are rendered
    - Test 2: mock `api.get` to resolve with exercises, set search text to "zzzznonexistent" → verify "No exercises match" text is rendered
    - _Requirements: 11.1, 2.2_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Run full test suite: `npx jest` for frontend, `pytest` for backend
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All test tasks are required (not optional) per review decision
- The backend change (task 1) is minimal — adding `"image_url": None` to each exercise dict in `exercises.py`
- The core filtering logic (task 3) is a pure function with no dependencies, making it the most testable piece
- Property tests use `fast-check` for TypeScript and `hypothesis` for Python, minimum 100 iterations each
- The existing `ExerciseSearchInput` component and `pickerStyles` in `AddTrainingModal.tsx` are fully removed in task 8.2
- File dependencies: Task 3 depends on Task 2 (types). Task 6 depends on Tasks 2+3 (config + utils). Task 7 depends on Tasks 3+4+6 (all components). Task 8 depends on Task 7 (screen exists)
