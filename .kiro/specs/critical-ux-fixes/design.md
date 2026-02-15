# Critical UX Fixes — Design

## Architecture Decisions

### Date-Aware Logging (US-1)
- All modals already have access to the Zustand store via `useStore`
- Replace hardcoded `new Date().toISOString().split('T')[0]` with `useStore((s) => s.selectedDate)` in each modal's submit handler
- QuickAddModal already accepts `targetDate` prop — verify DashboardScreen passes `selectedDate`
- No backend changes needed — the API already accepts `entry_date`, `session_date`, `recorded_date`

### Quick Actions Reorder (US-2)
- In DashboardScreen.tsx, move the `quickActionsAnim` Animated.View block to render after `dayBadgeAnim` and before `ringsAnim`
- Adjust staggered entrance indices accordingly
- No new components needed

### Forgot Password (US-3)
- Backend: New `POST /auth/forgot-password` endpoint in `src/modules/auth/router.py`
  - Accepts `{ email: string }`
  - Generates a time-limited reset token (UUID, stored in DB or cache)
  - In dev mode: returns token in response (no email sending)
  - In prod: would send email via configured provider
- Backend: New `POST /auth/reset-password` endpoint
  - Accepts `{ token: string, new_password: string }`
  - Validates token, updates password hash
- Frontend: New `ForgotPasswordScreen.tsx` in `app/screens/auth/`
  - Simple form: email input + submit button
  - Success state: "Check your email for a reset link"
- Navigation: Add to AuthStack in App.tsx

### Email Validation (US-4)
- Create `app/utils/validation.ts` with `isValidEmail(email: string): boolean`
- Use standard regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Add inline error state to LoginScreen and RegisterScreen
- Show error below the email input field, not at the top

### Terms of Service (US-5)
- Add checkbox state to RegisterScreen
- Add `TouchableOpacity` with checkbox icon + text
- Disable register button when unchecked
- Links open placeholder URLs (configurable later)

### Analytics Tabs (US-6)
- Add a `selectedTab` state to AnalyticsScreen: `'nutrition' | 'training' | 'body'`
- Render tab pills at the top (reuse the same pill pattern as LogsScreen)
- Conditionally render chart sections based on selected tab
- Move TimeRangeSelector inside each tab's content area
- Keep weekly report link visible on all tabs

### Learn Discoverability (US-7)
- In DashboardScreen's featured articles section, add a "See All →" TouchableOpacity
- Navigation: `navigation.navigate('Profile', { screen: 'Learn' })` or add Learn to DashboardStack
- Simplest approach: Add "ArticleDetail" already exists in DashboardStack; add a "Learn" route too

### Error Boundary (US-8)
- Create `app/components/common/ErrorBoundary.tsx` — class component (React error boundaries require class components)
- Wrap `<BottomTabNavigator />` and `<OnboardingWizard />` in App.tsx
- Show error screen with app branding and restart button

### Back Navigation (US-9)
- Add a reusable `ScreenHeader` component or inline back button to each screen
- Use `useNavigation().goBack()` for the back action
- Pattern: `<TouchableOpacity onPress={goBack}><Text>← Back</Text></TouchableOpacity>` at the top of each screen

### Splash Screen (US-10)
- Replace `if (!ready) return null` in App.tsx with a branded loading view
- Show "HypertrophyOS" text + ActivityIndicator on dark background
- Uses existing theme tokens

## Files to Modify (ordered by execution batch)

### Batch A (independent, parallelizable)
- `app/utils/validation.ts` — NEW: email validation + trim utilities
- `app/__tests__/utils/validation.test.ts` — NEW: unit tests for validation
- `app/components/common/ErrorBoundary.tsx` — NEW: React class error boundary
- `app/App.tsx` — error boundary wrapper, splash screen, forgot password route (touched in Tasks 2, 3, 9)
- `app/screens/coaching/CoachingScreen.tsx` — add back button
- `app/screens/community/CommunityScreen.tsx` — add back button
- `app/screens/health/HealthReportsScreen.tsx` — add back button
- `app/screens/founder/FounderStoryScreen.tsx` — add back button
- `app/components/modals/AddNutritionModal.tsx` — use selectedDate
- `app/components/modals/AddTrainingModal.tsx` — use selectedDate
- `app/components/modals/AddBodyweightModal.tsx` — use selectedDate
- `app/screens/dashboard/DashboardScreen.tsx` — reorder quick actions (Task 6), Learn link (Task 11)
- `src/modules/auth/schemas.py` — new forgot-password/reset-password schemas
- `src/modules/auth/service.py` — forgot-password/reset-password logic
- `src/modules/auth/router.py` — 2 new endpoints
- `tests/test_forgot_password.py` — NEW: 7 backend tests

### Batch B (depends on Batch A)
- `app/screens/auth/LoginScreen.tsx` — email validation, forgot password link
- `app/screens/auth/RegisterScreen.tsx` — email validation, ToS checkbox
- `app/screens/auth/ForgotPasswordScreen.tsx` — NEW: forgot password form
- `app/screens/analytics/AnalyticsScreen.tsx` — add 3 tabs
- `app/navigation/BottomTabNavigator.tsx` — add Learn to DashboardStack

### Batch C (depends on all)
- `app/e2e/auth-validation.spec.ts` — NEW: 5 E2E tests
- `app/e2e/date-aware-logging.spec.ts` — NEW: 2 E2E tests
- `app/e2e/analytics-tabs.spec.ts` — NEW: 4 E2E tests
