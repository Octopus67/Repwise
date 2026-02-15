# Critical UX Fixes — Revised Execution Plan

## Dependency Graph

```
Task 1 (validation util)     → no deps, leaf node
Task 2 (error boundary)      → no deps, leaf node
Task 3 (splash screen)       → no deps, leaf node
Task 4 (back nav)            → no deps, leaf node
Task 5 (date-aware logging)  → no deps, leaf node
Task 6 (quick actions)       → no deps, leaf node
Task 7 (auth: email+ToS)     → depends on Task 1 (validation util)
Task 8 (forgot pw backend)   → no deps, leaf node
Task 9 (forgot pw frontend)  → depends on Task 7 (LoginScreen changes) + Task 8 (backend endpoints)
Task 10 (analytics tabs)     → no deps, leaf node
Task 11 (learn discovery)    → no deps, leaf node
Task 12 (E2E tests)          → depends on ALL above tasks being complete
```

## Parallel Batches

- Batch A (no deps): Tasks 1, 2, 3, 4, 5, 6, 8 — all independent
- Batch B (deps on Batch A): Tasks 7, 9, 10, 11
- Batch C (deps on all): Task 12

---

## BATCH A — Independent Foundation (all parallelizable)

### Task 1: Create Email Validation Utility [frontend, 0 deps]
Files: `app/utils/validation.ts` (NEW), `app/__tests__/utils/validation.test.ts` (NEW)

- [x] 1.1: Create `app/utils/validation.ts` exporting `isValidEmail(email: string): boolean`. Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Also export `trimEmail(email: string): string` that trims whitespace.
- [x] 1.2: Create `app/__tests__/utils/validation.test.ts` with unit tests: valid emails (user@domain.com, user+tag@sub.domain.co), invalid emails (empty string, "asdf", "@domain", "user@", "user @domain.com" with space), trimming behavior (leading/trailing whitespace removed).
- [x] 1.3: Run `cd app && npx jest __tests__/utils/validation.test.ts` — all tests must pass.

Risk: None. Pure utility, no side effects.
Rollback: Delete both files.

### Task 2: Create Error Boundary Component [frontend, 0 deps]
Files: `app/components/common/ErrorBoundary.tsx` (NEW), `app/App.tsx`

- [x] 2.1: Create `app/components/common/ErrorBoundary.tsx` as a React class component. Props: `children: React.ReactNode`. State: `hasError: boolean`, `error: Error | null`. Implement `static getDerivedStateFromError(error)` returning `{ hasError: true, error }`. Implement `componentDidCatch(error, errorInfo)` calling `console.error('ErrorBoundary caught:', error, errorInfo)`. Render fallback: SafeAreaView with `colors.bg.base` background, centered "HypertrophyOS" title, "Something went wrong" subtitle, error message in `colors.semantic.negative`, "Restart" Button that calls `this.setState({ hasError: false, error: null })`.
- [x] 2.2: In `app/App.tsx`, import `ErrorBoundary`. Wrap the `<NavigationContainer>` content: replace `{isAuthenticated ? (...) : (<AuthNavigator />)}` with `<ErrorBoundary>{isAuthenticated ? (...) : (<AuthNavigator />)}</ErrorBoundary>`.
- [x] 2.3: Verify app still loads normally after wrapping. Run `getDiagnostics` on both files.

Risk: Class component may have stale state after recovery. Mitigation: "Restart" resets `hasError` which re-mounts children.
Rollback: Remove ErrorBoundary import and wrapper from App.tsx, delete ErrorBoundary.tsx.

### Task 3: Add Splash/Loading Screen [frontend, 0 deps]
Files: `app/App.tsx`

- [x] 3.1: In `app/App.tsx`, replace `if (!ready) return null;` with a branded loading view: `<SafeAreaProvider><View style={{ flex: 1, backgroundColor: colors.bg.base, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text.primary, fontSize: 28, fontWeight: '700' }}>HypertrophyOS</Text><ActivityIndicator size="large" color={colors.accent.primary} style={{ marginTop: 24 }} /></View></SafeAreaProvider>`. Import `ActivityIndicator` from react-native and `colors` from theme tokens (already imported).
- [x] 3.2: Verify app shows branded splash on launch instead of blank screen. Run `getDiagnostics` on App.tsx.

Risk: SafeAreaProvider may already wrap the loading view — verify no double-wrapping. Mitigation: Check if SafeAreaProvider is already the outer wrapper; if so, just use a View.
Rollback: Revert to `if (!ready) return null;`.

### Task 4: Add Back Navigation to 4 Secondary Screens [frontend, 0 deps]
Files: `app/screens/coaching/CoachingScreen.tsx`, `app/screens/community/CommunityScreen.tsx`, `app/screens/health/HealthReportsScreen.tsx`, `app/screens/founder/FounderStoryScreen.tsx`

- [x] 4.1: In each of the 4 files, add `import { useNavigation } from '@react-navigation/native';` (if not already imported). Add `const navigation = useNavigation();` inside the component (if not already present).
- [x] 4.2: In each file, add a back button row as the first child inside the ScrollView (before the title): `<TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: spacing[2], marginBottom: spacing[2] }} activeOpacity={0.7}><Text style={{ color: colors.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium }}>← Back</Text></TouchableOpacity>`. Import TouchableOpacity if not already imported.
- [x] 4.3: Run `getDiagnostics` on all 4 files. Zero errors.

Risk: `useNavigation` may not have a screen to go back to if user deep-links. Mitigation: Wrap `goBack()` in try-catch or check `navigation.canGoBack()`.
Rollback: Remove the back button TouchableOpacity from each file.

### Task 5: Date-Aware Logging — Fix All Modals [frontend, 0 deps]
Files: `app/components/modals/AddNutritionModal.tsx`, `app/components/modals/AddTrainingModal.tsx`, `app/components/modals/AddBodyweightModal.tsx`

- [x] 5.1: In `AddNutritionModal.tsx`, add `const selectedDate = useStore((s) => s.selectedDate);` at the top of the component. Find every occurrence of `new Date().toISOString().split('T')[0]` in `handleSubmit` and `handleLogRecipe` and replace with `selectedDate`. There are exactly 2 occurrences: one in `handleSubmit` (`entry_date: new Date()...`) and one in `handleLogRecipe` (`entry_date: new Date()...`). Do NOT change the `useStore` import — it's already imported.
- [x] 5.2: In `AddTrainingModal.tsx`, add `const selectedDate = useStore((s) => s.selectedDate);` at the top of the component. Replace `session_date: new Date().toISOString().split('T')[0]` in `handleSubmit` with `session_date: selectedDate`.
- [x] 5.3: In `AddBodyweightModal.tsx`, add `const selectedDate = useStore((s) => s.selectedDate);` at the top of the component. Replace `recorded_date: new Date().toISOString().split('T')[0]` in `handleSubmit` with `recorded_date: selectedDate`.
- [x] 5.4: Verify `DashboardScreen.tsx` passes `selectedDate` to `QuickAddModal` via the `targetDate` prop. Grep for `<QuickAddModal` and confirm `targetDate={selectedDate}` is present. If not, add it.
- [x] 5.5: Verify `MealBuilder.tsx` already reads `selectedDate` from the store (it does: `const selectedDate = useStore((s) => s.selectedDate);`). No change needed — just confirm.
- [x] 5.6: Run `getDiagnostics` on all 3 modified modal files. Zero errors.

Risk: If `selectedDate` is stale (user opened app yesterday, never changed date), entries go to yesterday. Mitigation: The store initializes `selectedDate` to `new Date().toISOString().split('T')[0]` on app start, and `clearAuth` doesn't reset it — but app restart does. This is acceptable behavior; the DateScroller makes the selected date visible.
Rollback: Revert each file's `selectedDate` usage back to `new Date().toISOString().split('T')[0]`.

### Task 6: Move Quick Actions Above the Fold [frontend, 0 deps]
Files: `app/screens/dashboard/DashboardScreen.tsx`

- [x] 6.1: In `DashboardScreen.tsx`, change the staggered entrance indices to: `headerAnim(0)`, `dateScrollerAnim(1)`, `dayBadgeAnim(2)`, `quickActionsAnim(3)`, `ringsAnim(4)`, `budgetAnim(5)`, `mealSlotAnim(6)`, `summaryAnim(7)`, `featuredAnim(8)`. Update the 9 `useStaggeredEntrance` calls accordingly.
- [x] 6.2: In the JSX return, move the entire Quick Actions `<Animated.View style={quickActionsAnim}>...</Animated.View>` block (including the `<SectionHeader title="Quick Log" />` and the 5 QuickActionButtons) to render immediately after the `<DayIndicator>` component and the `<ReadinessGauge>` component, and BEFORE the Macro Rings `<Animated.View style={ringsAnim}>` block.
- [x] 6.3: Run `getDiagnostics` on DashboardScreen.tsx. Zero errors.

Risk: Moving a large JSX block may introduce copy-paste errors. Mitigation: Cut-paste the exact block; verify the closing `</Animated.View>` tag count matches.
Rollback: Move the Quick Actions block back to its original position (after summary section) and restore original stagger indices.

### Task 8: Forgot Password Backend [backend, 0 deps]
Files: `src/modules/auth/schemas.py`, `src/modules/auth/service.py`, `src/modules/auth/router.py`, `tests/test_forgot_password.py` (NEW)

- [x] 8.1: In `src/modules/auth/schemas.py`, add two new Pydantic models (use `from __future__ import annotations` at top if not present): `class ForgotPasswordRequest(BaseModel): email: str` and `class ResetPasswordRequest(BaseModel): token: str; new_password: str = Field(min_length=8)`. Import `Field` from pydantic if not already imported.
- [x] 8.2: In `src/modules/auth/service.py`, add a module-level dict `_reset_tokens: dict[str, tuple[str, float]] = {}` (maps token → (user_email, expiry_timestamp)). Add method `async def generate_reset_token(self, email: str) -> Optional[str]` to `AuthService`: look up user by email via `_get_user_by_email`; if not found, return None (don't reveal); generate `token = str(uuid.uuid4())`; store in `_reset_tokens` with expiry `time.time() + 3600`; return token. Add method `async def reset_password(self, token: str, new_password: str) -> bool`: look up token in `_reset_tokens`; if not found or expired, return False; get email, look up user, update `user.hashed_password = _hash_password(new_password)`; commit; delete token from dict; return True. Import `uuid`, `time`, `Optional` from typing.
- [x] 8.3: In `src/modules/auth/router.py`, add `POST /forgot-password` endpoint: accepts `ForgotPasswordRequest`, calls `auth_service.generate_reset_token(body.email)`, always returns `{"message": "If an account exists with that email, a reset link has been sent"}` with 200 (never reveal whether email exists). In dev mode (`settings.debug` or env var), include `"dev_token": token` in response if token was generated.
- [x] 8.4: Add `POST /reset-password` endpoint: accepts `ResetPasswordRequest`, calls `auth_service.reset_password(body.token, body.new_password)`, returns `{"message": "Password has been reset"}` on success, raises `HTTPException(400, "Invalid or expired reset token")` on failure.
- [x] 8.5: Create `tests/test_forgot_password.py` with these test cases using the existing async test client pattern from conftest.py:
  - `test_forgot_password_returns_200_for_existing_email`: register a user, call POST /auth/forgot-password with that email, assert 200 and message field present.
  - `test_forgot_password_returns_200_for_nonexistent_email`: call with random email, assert 200 (no information leak).
  - `test_reset_password_with_valid_token`: register user, call forgot-password (extract dev_token from response), call reset-password with token + new password, assert 200. Then login with new password — assert 200.
  - `test_reset_password_with_invalid_token`: call reset-password with garbage token, assert 400.
  - `test_reset_password_with_expired_token`: register, generate token, manually set expiry to past in `_reset_tokens`, call reset-password, assert 400.
  - `test_reset_password_token_single_use`: use token once (success), use same token again (400).
  - `test_reset_password_validates_min_length`: call with token + 3-char password, assert 422 (Pydantic validation).
- [x] 8.6: Run `source .venv/bin/activate && python -m pytest tests/test_forgot_password.py -v` — all 7 tests must pass.

Risk: In-memory `_reset_tokens` dict is lost on server restart and doesn't work in multi-process deployments. Mitigation: Acceptable for v1/dev; document that production needs Redis or DB-backed token storage. Add a `# TODO: Replace with Redis/DB storage for production` comment.
Rollback: Remove the 2 new endpoints from router, remove the 2 new methods from service, remove the 2 new schemas, delete test file.

---

## ═══ CHECKPOINT A ═══
Gate criteria before proceeding to Batch B:
- [ ] `cd app && npx jest __tests__/utils/validation.test.ts` — PASS
- [ ] `getDiagnostics` on App.tsx, ErrorBoundary.tsx — zero errors
- [ ] `getDiagnostics` on all 4 secondary screens (coaching, community, health, founder) — zero errors
- [ ] `getDiagnostics` on all 3 modal files + DashboardScreen.tsx — zero errors
- [ ] `source .venv/bin/activate && python -m pytest tests/test_forgot_password.py -v` — all 7 PASS
- [ ] `source .venv/bin/activate && python -m pytest tests/ -x --timeout=60` — existing test suite still passes (no regressions)

---

## BATCH B — Dependent Tasks

### Task 7: Auth Screens — Email Validation + ToS + Forgot Password Link [frontend, depends on Task 1]
Files: `app/screens/auth/LoginScreen.tsx`, `app/screens/auth/RegisterScreen.tsx`

- [x] 7.1: In `LoginScreen.tsx`: import `{ isValidEmail, trimEmail }` from `../../utils/validation`. In `handleLogin`, after `setError('')`, add: `const cleanEmail = trimEmail(email);` then `if (cleanEmail && !isValidEmail(cleanEmail)) { setError('Please enter a valid email address'); return; }`. Use `cleanEmail` in the API call instead of raw `email`. Add `emailError` state for inline display below the email input (separate from the top-level `error`).
- [x] 7.2: In `LoginScreen.tsx`: add `onNavigateForgotPassword?: () => void` to the `LoginScreenProps` interface. Add a "Forgot Password?" TouchableOpacity between the password input and the Sign In button: `<TouchableOpacity onPress={onNavigateForgotPassword} style={{ alignItems: 'flex-end', marginBottom: spacing[3] }}><Text style={{ color: colors.accent.primary, fontSize: typography.size.sm }}>Forgot Password?</Text></TouchableOpacity>`. Only render if `onNavigateForgotPassword` is provided.
- [x] 7.3: In `RegisterScreen.tsx`: import `{ isValidEmail, trimEmail }` from `../../utils/validation`. Add email validation in `handleRegister` (same pattern as 7.1). Add `tosAccepted` state (boolean, default false). Add checkbox row before the Register button: `<TouchableOpacity onPress={() => setTosAccepted(!tosAccepted)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3], gap: spacing[2] }}><View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: tosAccepted ? colors.accent.primary : colors.border.default, backgroundColor: tosAccepted ? colors.accent.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{tosAccepted && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}</View><Text style={{ color: colors.text.secondary, fontSize: typography.size.sm, flex: 1 }}>I agree to the Terms of Service and Privacy Policy</Text></TouchableOpacity>`. Add validation in `handleRegister`: if `!tosAccepted`, set error "Please accept the Terms of Service" and return. Disable Register button when `!tosAccepted`: add `disabled={!tosAccepted || loading}` to the Button.
- [x] 7.4: Run `getDiagnostics` on both auth screen files. Zero errors.

Risk: Adding `onNavigateForgotPassword` as optional prop means existing callers don't break. The link just won't render until Task 9 wires it.
Rollback: Remove validation imports, remove forgot password link, remove ToS checkbox and state.

### Task 9: Forgot Password Screen + Navigation Wiring [frontend, depends on Tasks 7 + 8]
Files: `app/screens/auth/ForgotPasswordScreen.tsx` (NEW), `app/App.tsx`

- [x] 9.1: Create `app/screens/auth/ForgotPasswordScreen.tsx`. Component accepts `{ onNavigateBack: () => void }` props. State: `email` (string), `error` (string), `loading` (boolean), `submitted` (boolean). UI: KeyboardAvoidingView + ScrollView (same pattern as LoginScreen). Title: "Reset Password". Subtitle: "Enter your email and we'll send a reset link." Email TextInput with `testID="forgot-email-input"`. Submit Button "Send Reset Link" with `testID="forgot-submit-button"`. On submit: validate email with `isValidEmail(trimEmail(email))`, call `api.post('auth/forgot-password', { email: trimEmail(email) })`, on success set `submitted = true`. Success state: show "If an account with that email exists, we've sent a reset link." with a "Back to Sign In" link. Error state: show error message. Back link at bottom: "← Back to Sign In" calling `onNavigateBack`.
- [x] 9.2: In `app/App.tsx`, add `ForgotPassword` to `AuthStackParamList`: `ForgotPassword: undefined`. Add `<AuthStack.Screen name="ForgotPassword">` rendering `<ForgotPasswordScreen onNavigateBack={() => navigation.goBack()} />`. Import `ForgotPasswordScreen`.
- [x] 9.3: In `app/App.tsx`, update the Login screen render to pass `onNavigateForgotPassword={() => navigation.navigate('ForgotPassword')}` to `LoginScreen`.
- [x] 9.4: Run `getDiagnostics` on ForgotPasswordScreen.tsx and App.tsx. Zero errors.

Risk: Navigation type safety — `AuthStackParamList` must include `ForgotPassword`. Mitigation: Add it to the type definition.
Rollback: Remove ForgotPasswordScreen.tsx, remove the AuthStack.Screen entry, remove the `onNavigateForgotPassword` prop from LoginScreen render in App.tsx.

### Task 10: Analytics Screen Tabs [frontend, 0 deps but placed in Batch B for sequencing]
Files: `app/screens/analytics/AnalyticsScreen.tsx`

- [x] 10.1: Add `type AnalyticsTab = 'nutrition' | 'training' | 'body';` and `const [selectedTab, setSelectedTab] = useState<AnalyticsTab>('nutrition');` at the top of the component.
- [x] 10.2: Add a tab pill row immediately after the `<Text style={styles.title}>Analytics</Text>`: three TouchableOpacity pills ("Nutrition", "Training", "Body") using the same styling pattern as LogsScreen's tab switcher (background `colors.bg.surface`, active `colors.accent.primaryMuted`, rounded). Add styles `analyticsTabRow`, `analyticsTab`, `analyticsTabActive`, `analyticsTabText`, `analyticsTabTextActive` to the StyleSheet.
- [x] 10.3: Keep the Weekly Report link and TimeRangeSelector visible on ALL tabs (render them outside the conditional blocks, after the tab pills).
- [x] 10.4: Wrap Nutrition-related sections in `{selectedTab === 'nutrition' && (<>...</>)}`: Nutrition Report link, Calorie Trend, Weekly Summary, Protein Trend, Target vs Actual, Dietary Gaps.
- [x] 10.5: Wrap Training-related sections in `{selectedTab === 'training' && (<>...</>)}`: Training Volume, Muscle Volume Heat Map, Muscle Fatigue, Strength Progression, e1RM Trend, Strength Standards, Strength Leaderboard.
- [x] 10.6: Wrap Body-related sections in `{selectedTab === 'body' && (<>...</>)}`: Periodization Calendar, Readiness Trend, Bodyweight Trend, Expenditure Trend (TDEE).
- [x] 10.7: Run `getDiagnostics` on AnalyticsScreen.tsx. Zero errors.

Risk: Large file (~500 lines) — wrapping sections in conditionals may break JSX nesting. Mitigation: Use Fragment wrappers `<>...</>` for each tab's content. Verify closing tags carefully.
Rollback: Remove the tab state, tab pills, and conditional wrappers — restore flat rendering.

### Task 11: Learn Section Discoverability [frontend, 0 deps but placed in Batch B for sequencing]
Files: `app/navigation/BottomTabNavigator.tsx`, `app/screens/dashboard/DashboardScreen.tsx`

- [x] 11.1: In `BottomTabNavigator.tsx`, add `Learn: undefined` to `DashboardStackParamList`. Add `<DashboardStack.Screen name="Learn" component={LearnScreen} />` to `DashboardStackScreen` (LearnScreen is already imported).
- [x] 11.2: In `DashboardScreen.tsx`, in the Featured Articles section (inside `<Animated.View style={featuredAnim}>`), add a "See All →" TouchableOpacity after the horizontal ScrollView of article cards: `<TouchableOpacity onPress={() => navigation.navigate('Learn')} style={{ alignItems: 'flex-end', paddingVertical: spacing[2] }}><Text style={{ color: colors.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium }}>See All Articles →</Text></TouchableOpacity>`. This should render regardless of whether articles exist (it's a navigation shortcut).
- [x] 11.3: Run `getDiagnostics` on both files. Zero errors.

Risk: Adding `Learn` to DashboardStack means the Learn screen renders inside the Home tab's stack, not the Profile tab's stack. This is intentional — it makes Learn accessible from Dashboard. The Profile stack's Learn route still works independently.
Rollback: Remove the `Learn` route from DashboardStackParamList and DashboardStackScreen. Remove the "See All →" link.

---

## ═══ CHECKPOINT B ═══
Gate criteria before proceeding to Batch C:
- [ ] `getDiagnostics` on LoginScreen.tsx, RegisterScreen.tsx — zero errors
- [ ] `getDiagnostics` on ForgotPasswordScreen.tsx, App.tsx — zero errors
- [ ] `getDiagnostics` on AnalyticsScreen.tsx — zero errors
- [ ] `getDiagnostics` on BottomTabNavigator.tsx, DashboardScreen.tsx — zero errors
- [ ] `source .venv/bin/activate && python -m pytest tests/ -x --timeout=60` — full backend suite passes
- [ ] Manual verification: app loads, login screen shows "Forgot Password?" link, register screen shows ToS checkbox, analytics has 3 tabs

---

## BATCH C — End-to-End Test Coverage

### Task 12: E2E Tests for All New Workflows [frontend, depends on ALL above]
Files: `app/e2e/auth-validation.spec.ts` (NEW), `app/e2e/date-aware-logging.spec.ts` (NEW), `app/e2e/analytics-tabs.spec.ts` (NEW)

- [x] 12.1: Create `app/e2e/auth-validation.spec.ts` with tests:
  - `shows forgot password link on login screen`: verify `[data-testid="forgot-password-link"]` or text "Forgot Password?" is visible
  - `shows email validation error for invalid email`: type "notanemail" in login email, submit, verify error message visible
  - `shows ToS checkbox on register screen`: navigate to register, verify checkbox text visible
  - `register button disabled without ToS`: verify register button is disabled before checking ToS
  - `forgot password screen loads`: tap forgot password link, verify forgot password screen renders
- [x] 12.2: Create `app/e2e/date-aware-logging.spec.ts` with tests:
  - `quick actions visible above macro rings`: verify `[data-testid="dashboard-log-food-button"]` appears before `[data-testid="macro-rings-row"]` in DOM order
  - `dashboard shows see all articles link`: verify "See All" text is visible in featured section
- [x] 12.3: Create `app/e2e/analytics-tabs.spec.ts` with tests:
  - `analytics screen shows tab pills`: navigate to Analytics, verify "Nutrition", "Training", "Body" text visible
  - `can switch to training tab`: tap "Training" pill, verify training-specific content appears
  - `can switch to body tab`: tap "Body" pill, verify body-specific content appears
  - `time range selector visible on all tabs`: verify time range selector visible after switching tabs
- [x] 12.4: Add `testID="forgot-password-link"` to the Forgot Password TouchableOpacity in LoginScreen (if not already added in Task 7.2).
- [x] 12.5: Run `cd app && npx playwright test e2e/auth-validation.spec.ts e2e/date-aware-logging.spec.ts e2e/analytics-tabs.spec.ts --reporter=list` — all tests pass.
- [x] 12.6: Run full E2E suite: `cd app && npx playwright test --reporter=list` — all 67 existing + new tests pass (no regressions).

Risk: E2E tests depend on both servers running. Mitigation: Document prerequisite in test file comments. Tests use `ensureLoggedIn` helper which handles auth.
Rollback: Delete the 3 new test files.

---

## ═══ FINAL CHECKPOINT ═══
Gate criteria for completion:
- [ ] All `getDiagnostics` clean across all modified files
- [ ] `cd app && npx jest --passWithNoTests` — all frontend unit tests pass
- [ ] `source .venv/bin/activate && python -m pytest tests/ -x --timeout=60` — all backend tests pass (including new test_forgot_password.py)
- [ ] `cd app && npx playwright test --reporter=list` — full E2E suite passes
- [ ] Manual smoke test: open app → see splash → login screen has "Forgot Password?" → register has ToS → dashboard quick actions above fold → date scroller changes date → log food modal uses selected date → analytics has 3 tabs → secondary screens have back buttons → error boundary catches thrown errors

---

## Monitoring (Post-Launch)

1. Track `POST /auth/forgot-password` call volume — spike indicates password UX issues or abuse
2. Track `POST /auth/reset-password` success vs failure rate — high failure rate indicates token expiry too short
3. Track analytics tab switch events — which tab is most used? Informs future default
4. Track "See All Articles" tap rate — measures Learn discoverability improvement
5. Track error boundary trigger count — any non-zero value indicates a crash to investigate
6. Monitor `selectedDate` drift — if users frequently log to non-today dates, the date-aware fix is working as intended

---

## Rollback Plan Summary

| Task | Rollback Action |
|------|----------------|
| 1 | Delete validation.ts + test file |
| 2 | Remove ErrorBoundary wrapper from App.tsx, delete component |
| 3 | Revert App.tsx loading state to `return null` |
| 4 | Remove back button TouchableOpacity from 4 screens |
| 5 | Revert 3 modals to `new Date().toISOString().split('T')[0]` |
| 6 | Move Quick Actions back below summary, restore stagger indices |
| 7 | Remove validation imports, forgot password link, ToS checkbox from auth screens |
| 8 | Remove 2 endpoints, 2 service methods, 2 schemas, delete test file |
| 9 | Delete ForgotPasswordScreen.tsx, remove from AuthStack |
| 10 | Remove tab state and conditional wrappers from AnalyticsScreen |
| 11 | Remove Learn route from DashboardStack, remove "See All" link |
| 12 | Delete 3 new E2E test files |

Each task is independently rollbackable. No task creates irreversible state (no DB migrations, no schema changes to existing tables).
