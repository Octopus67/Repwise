# HIGH + MEDIUM UX Fixes — Design

## Architecture Decisions

### Password Visibility Toggle (US-1)
- Add `showPassword` boolean state to LoginScreen and RegisterScreen
- Toggle `secureTextEntry` prop on TextInput based on state
- Use Icon component with "eye" / "eye-off" names (verify Icon supports these)
- Position toggle as an absolute-positioned TouchableOpacity inside the input container

### Onboarding Step Counter (US-2)
- In OnboardingWizard.tsx, add `<Text>Step {currentStep} of {TOTAL_STEPS}</Text>` next to the progress bar
- Style: muted text, small font, right-aligned

### Remove IntentStep Auto-Advance (US-3)
- Remove `setTimeout(onNext, 200)` from `handleSelect` in IntentStep
- Change `handleSelect` to only update the store field
- Add a "Next" Button at the bottom (same pattern as other steps)
- Disable "Next" until a goal is selected

### Input Field Chaining (US-4)
- Add `useRef` for each TextInput in LoginScreen and RegisterScreen
- Set `returnKeyType="next"` on all fields except the last
- Set `returnKeyType="done"` on the last field
- Use `onSubmitEditing` to focus the next ref or trigger submit

### DateScroller "Jump to Today" (US-5)
- In DateScroller.tsx, accept an optional `onJumpToToday` callback or handle internally
- Show a "Today" pill when `selectedDate !== today`
- Tapping resets `weekOffset` to 0 and calls `onDateSelect(today)`
- Position: small pill above or beside the date row

### Logs Screen Date Filtering (US-6)
- Add a compact date display at the top of LogsScreen showing the selected date
- Read `selectedDate` from the store
- Filter nutrition entries to `selectedDate` only (not last 7 days)
- Add left/right arrows to change date (or reuse DateScroller component)

### Post-Save Rapid Logging (US-7)
- After successful save in AddNutritionModal, instead of switching to the "Save as Favorite" full-screen:
  - Show a brief inline success indicator (green checkmark + "Logged ✓" text for 2 seconds)
  - Clear form fields
  - Keep modal open
  - Add a small "Save as Favorite" text link below the success indicator
  - Add a "Done" button that closes the modal
- This requires refactoring the `showSaveAsFavorite` state flow

### Learn Screen Search (US-8)
- Add a TextInput above the filter pills in LearnScreen
- Debounce search input (300ms)
- Pass `q` param to the articles API alongside category filter
- Show search results in the same FlatList

### Consistent Empty States (US-9)
- Replace plain `<Text>` empty states in CoachingScreen and HealthReportsScreen with `<EmptyState>` component
- Use appropriate icons: "target" for coaching, "chart" for health reports

### Remove Placeholder Buttons (US-10)
- CoachingScreen: Remove the "Upload Document" Button entirely from request cards
- HealthReportsScreen: Change "Upload New Report" to a disabled button with subtitle "File upload coming soon"
- Remove the `handleUploadDocument` function and its Alert

### Favorites Filter (US-11)
- Add "Favorites" to the CATEGORIES array in LearnScreen (or as a separate state)
- When selected, filter the articles list client-side using the `favorites` Set
- Use a star icon prefix on the pill label

### Article Card Preview (US-12)
- The Article interface needs a `summary` or `content_preview` field
- If the API returns `content_markdown`, extract first ~100 chars stripped of markdown syntax
- Add a `<Text numberOfLines={2}>` below the title in AnimatedArticleCard
- Create a `stripMarkdown(text: string, maxLength: number): string` utility

### Nutrition Report Age/Sex (US-13)
- Read `birthYear` and `sex` from the onboarding store (`useOnboardingStore`)
- If onboarding store has values, compute age and use real sex
- If not, fall back to current defaults (age 30, male)
- Update the warning banner to only show when using defaults

## Files to Modify

### Batch A (independent)
- `app/screens/auth/LoginScreen.tsx` — password toggle, input chaining
- `app/screens/auth/RegisterScreen.tsx` — password toggle, input chaining
- `app/screens/onboarding/OnboardingWizard.tsx` — step counter
- `app/screens/onboarding/steps/IntentStep.tsx` — remove auto-advance, add Next button
- `app/components/dashboard/DateScroller.tsx` — "Today" jump button
- `app/screens/coaching/CoachingScreen.tsx` — remove upload button, use EmptyState
- `app/screens/health/HealthReportsScreen.tsx` — disable upload, use EmptyState
- `app/utils/textHelpers.ts` — NEW: stripMarkdown utility

### Batch B (depends on Batch A)
- `app/screens/logs/LogsScreen.tsx` — date filtering with selectedDate
- `app/components/modals/AddNutritionModal.tsx` — rapid logging refactor
- `app/screens/learn/LearnScreen.tsx` — search input, favorites filter, article preview
- `app/screens/nutrition/NutritionReportScreen.tsx` — read age/sex from store
