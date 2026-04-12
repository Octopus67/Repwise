# Repwise Remediation Plan — Exhaustive Bug & Issue Fix

> Generated: 2026-04-11 | Based on full backend + frontend + cross-cutting audit
> Status: PLAN ONLY — do not implement until approved

---

## Issue Registry (17 Issues Total)

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| B1 | 🔴 CRITICAL | Backend | Unawaited async coroutine in recalculate cooldown — Redis rate limit completely broken |
| B2 | 🟠 HIGH | Backend | Non-atomic Redis lock release/renewal — race condition in scheduler |
| B3 | 🟠 HIGH | Backend | Unbounded query in `get_flags()` — no LIMIT |
| B4 | 🟠 HIGH | Backend | Unbounded query in `FounderContent` — full table scan |
| F1 | 🟠 HIGH | Frontend | 3 failing API service tests — wrong interceptor index |
| C1 | 🔴 CRITICAL | Cross-cutting | Missing `.secrets.baseline` — pre-commit secrets detection broken |
| C2 | 🟠 HIGH | Cross-cutting | Dead code: `redis_rate_limiter.py` — unused module |
| F2 | 🟡 MEDIUM | Frontend | No ESLint config — no lint enforcement |
| F3 | 🟡 MEDIUM | Frontend | 34/36 screens missing ErrorBoundary |
| F4 | 🟡 MEDIUM | Frontend | ~95% touchables lack accessibilityLabel |
| B5 | 🟡 MEDIUM | Backend | Missing error handling on 20+ async DB operations |
| B6 | 🟡 MEDIUM | Backend | Unused import: `SQLAlchemyError` in database.py |
| C3 | 🟡 MEDIUM | Cross-cutting | No `.env.example` template |
| F5 | ⚪ LOW | Frontend | 2 unguarded console.logs in production code |
| F6 | ⚪ LOW | Frontend | Unused dependency: `expo-tracking-transparency` |
| B7 | ⚪ LOW | Backend | Deprecated `datetime.utcnow()` in test code |
| C4 | ⚪ LOW | Cross-cutting | Pytest collection warning for `test_session_factory` |

---

## PHASE 1: Critical & Blocking Fixes

> These are live bugs or broken infrastructure. Fix immediately.

### Task 1.1: Fix unawaited async coroutine in recalculate cooldown [B1]

**Root Cause:** `_check_recalculate_cooldown()` in `src/modules/user/service.py` is a sync function that calls `get_redis()` which is `async def`. The call `redis = get_redis()` returns a coroutine object (always truthy), so `redis.set()` and `redis.ttl()` are called on the coroutine — not on a Redis client. The cooldown is never enforced.

**Impact:** Any user can spam the `/recalculate` endpoint without rate limiting in multi-worker deployments. The in-memory fallback only works per-process.

**Fix Approach:**
1. Make `_check_recalculate_cooldown()` an `async def`
2. Add `await` before `get_redis()`
3. Add `await` before `redis.set()` and `redis.ttl()`
4. Update the caller (line ~295) to `await _check_recalculate_cooldown(...)`
5. Verify the caller is already in an async context (it should be — it's in an async route handler)

**Affected Files:**
- `src/modules/user/service.py` — lines ~54-80 (function definition) and ~295 (call site)

**Ripple Effects:** None. This function is only called from one place.

**Testing:**
- Existing tests should still pass (they likely mock Redis or don't test this path)
- Add a new test: call recalculate twice within cooldown window → second call should raise 429
- Manual verification: check that `RuntimeWarning: coroutine 'get_redis' was never awaited` disappears from test output

**Regression Risk:** LOW — isolated function, single call site.

---

### Task 1.2: Generate `.secrets.baseline` [C1]

**Root Cause:** `.pre-commit-config.yaml` configures `detect-secrets` with `--baseline .secrets.baseline`, but the file was never created. Every `git commit` triggers a pre-commit failure on the secrets hook.

**Impact:** Developers must use `--no-verify` on every commit, bypassing ALL pre-commit hooks (including ruff lint/format).

**Fix Approach:**
1. Run `detect-secrets scan > .secrets.baseline`
2. Review the baseline for any actual secrets that shouldn't be committed
3. Add `.secrets.baseline` to git
4. Verify `pre-commit run detect-secrets` passes

**Affected Files:**
- `.secrets.baseline` (new file)

**Ripple Effects:** None. This enables the existing hook to work.

**Testing:** Run `pre-commit run --all-files` and verify detect-secrets passes.

**Regression Risk:** NONE.

---

### Task 1.3: Fix 3 failing frontend tests [F1]

**Root Cause:** `__tests__/services/apiService.test.ts` grabs `interceptors.response.handlers[0].err` to test the 401 refresh logic. But `api.ts` registers TWO response interceptors:
- `handlers[0]` = transient retry interceptor (429/500/503)
- `handlers[1]` = 401 refresh interceptor

The test is testing the wrong interceptor. All 3 failures stem from this single index bug.

**Impact:** 3 tests fail on every run. CI would be red if enforced.

**Fix Approach:**
1. In `getResponseErrorHandler()` helper, change `handlers[0]` → `handlers[1]`
2. OR better: find the handler dynamically by checking for 401 logic (more resilient to future interceptor reordering)

**Affected Files:**
- `app/__tests__/services/apiService.test.ts` — the `getResponseErrorHandler()` helper function

**Ripple Effects:** None. Test-only change.

**Testing:** Run `npx jest apiService` — all 3 tests should pass.

**Regression Risk:** NONE — test-only fix.

---

## PHASE 2: High-Severity Fixes

> Race conditions, unbounded queries, dead code.

### Task 2.1: Fix non-atomic Redis lock operations in scheduler [B2]

**Root Cause:** Two race conditions in `src/config/scheduler.py`:
1. **Lock release** (line ~170): `val = await r.get(LOCK_KEY)` then `await r.delete(LOCK_KEY)` — between GET and DELETE, another worker could acquire the lock, and this worker deletes the new lock.
2. **Lock renewal** (line ~75): `val = await r.get(LOCK_KEY)` then `await r.expire(LOCK_KEY, TTL)` — same race: another worker could steal the lock between GET and EXPIRE.

**Impact:** In multi-worker deployments, workers can accidentally delete each other's locks, causing either duplicate schedulers or no scheduler running.

**Fix Approach:** Use Lua scripts for atomic check-and-operate:

```python
# Atomic release: only delete if we still own the lock
RELEASE_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

# Atomic renewal: only expire if we still own the lock
RENEW_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end"
```

Replace the GET+DELETE/EXPIRE patterns with `await r.eval(SCRIPT, 1, LOCK_KEY, _worker_id)` and `await r.eval(SCRIPT, 1, LOCK_KEY, _worker_id, LOCK_TTL)`.

**Affected Files:**
- `src/config/scheduler.py` — `stop_scheduler()` (release) and `_renew_lock_loop()` (renewal)

**Ripple Effects:** None. The scheduler is self-contained.

**Testing:**
- Existing scheduler tests should still pass
- Manual verification: run 2 workers, verify only one holds the lock, stop the leader, verify the other takes over cleanly

**Regression Risk:** MEDIUM — touches scheduler lock logic. Test thoroughly in multi-worker setup.

---

### Task 2.2: Add LIMIT to unbounded queries [B3, B4]

**Root Cause:** Two queries return all rows without pagination:
1. `src/modules/feature_flags/service.py:150` — `get_flags()` returns ALL feature flags
2. `src/modules/founder/service.py:32` — `FounderContent` query with no LIMIT when `section_key` is None

**Impact:** If these tables grow, response times degrade and memory usage spikes. Feature flags table is admin-only but founder content could be user-facing.

**Fix Approach:**
1. `get_flags()`: Add `.limit(100)` (feature flags should never exceed this)
2. `FounderContent`: Add `.limit(50)` and pagination support if needed

**Affected Files:**
- `src/modules/feature_flags/service.py` — `get_flags()` method
- `src/modules/founder/service.py` — the query method

**Ripple Effects:** None. Adding LIMIT to existing queries is safe.

**Testing:** Existing tests should pass. No new tests needed (these are simple LIMIT additions).

**Regression Risk:** LOW.

---

### Task 2.3: Remove dead code — `redis_rate_limiter.py` [C2]

**Root Cause:** `src/middleware/redis_rate_limiter.py` contains a complete `RedisRateLimiter` implementation with its own sync Redis client. It is imported by ZERO files in the codebase. The actual rate limiting is handled by `src/middleware/rate_limiter.py` (async) and `src/middleware/global_rate_limiter.py`.

**Impact:** Dead code adds confusion. A developer might accidentally import from the wrong module and get sync Redis calls in an async context.

**Fix Approach:**
1. Verify zero imports: `grep -rn 'redis_rate_limiter' src/ tests/ --include='*.py' | grep -v __pycache__ | grep -v redis_rate_limiter.py`
2. Delete `src/middleware/redis_rate_limiter.py`

**Affected Files:**
- `src/middleware/redis_rate_limiter.py` (DELETE)

**Ripple Effects:** None — no imports exist.

**Testing:** Run full test suite to confirm nothing breaks.

**Regression Risk:** LOW — verified unused.

---

## PHASE 3: Medium-Severity Fixes

> Code quality, error handling, developer experience.

### Task 3.1: Add navigation-level ErrorBoundary [F3]

**Root Cause:** 34 of 36 screens have no ErrorBoundary. If any screen throws during render, the entire app crashes with a white screen.

**Impact:** Poor user experience on crashes. Especially dangerous on `ActiveWorkoutScreen` where a crash means losing in-progress workout data.

**Fix Approach:** Instead of adding ErrorBoundary to each screen individually, wrap the navigation container:

```tsx
// In App.tsx or BottomTabNavigator.tsx
<ErrorBoundary fallback={<CrashRecoveryScreen />}>
  <NavigationContainer>
    {/* ... */}
  </NavigationContainer>
</ErrorBoundary>
```

Also add a dedicated ErrorBoundary around `ActiveWorkoutScreen` that auto-saves workout state before showing the error UI.

**Affected Files:**
- `app/App.tsx` — wrap NavigationContainer
- `app/screens/training/ActiveWorkoutScreen.tsx` — add workout-specific ErrorBoundary
- `app/components/common/CrashRecoveryScreen.tsx` (new) — user-friendly crash UI with "Restart" button

**Ripple Effects:** None. ErrorBoundary is additive.

**Testing:** Manual — trigger a render error in a screen and verify the fallback UI appears instead of a white screen.

**Regression Risk:** LOW — additive wrapper.

---

### Task 3.2: Add ESLint configuration [F2]

**Root Cause:** No `.eslintrc` or `eslint.config.*` exists in `app/`. No lint enforcement.

**Fix Approach:**
1. Create `app/.eslintrc.js` with `@react-native/eslint-config` or `expo/eslint-config`
2. Add rules for: no-console (warn), no-unused-vars (error), react-hooks/exhaustive-deps (warn)
3. Add `lint` script to `package.json`
4. Do NOT auto-fix existing violations in this PR — just establish the config

**Affected Files:**
- `app/.eslintrc.js` (new)
- `app/package.json` — add `lint` script

**Ripple Effects:** May surface existing lint violations. Do NOT fix them in this phase — just establish the config.

**Testing:** Run `npx eslint . --ext .ts,.tsx` and verify it runs without config errors.

**Regression Risk:** NONE — config-only.

---

### Task 3.3: Add missing error handling on async DB operations [B5]

**Root Cause:** 20+ `await session.execute()` / `await session.flush()` calls in service files lack try/except. If the DB connection drops, these raise unhandled `SQLAlchemyError`.

**Impact:** Unhandled exceptions in route handlers return 500 with a stack trace (information leak in production).

**Fix Approach:** The app has a global exception handler middleware (`src/middleware/logging_middleware.py`). Verify it catches `SQLAlchemyError` and returns a clean 500. If it does, these are MEDIUM not HIGH. If it doesn't, add catch blocks to the most critical paths:
1. Check `logging_middleware.py` for global exception handling
2. If global handler exists and catches SQLAlchemy errors → mark as LOW, no action needed
3. If not → add try/except to the 5 most critical service methods (payments, auth, nutrition)

**Affected Files:**
- `src/middleware/logging_middleware.py` — verify global handler
- Potentially: `src/modules/payments/service.py`, `src/modules/auth/service.py`

**Testing:** Existing tests should pass. Add a test that simulates DB disconnect if no global handler exists.

**Regression Risk:** LOW.

---

### Task 3.4: Clean up unused imports [B6]

**Root Cause:** `SQLAlchemyError` imported but unused in `src/config/database.py`.

**Fix Approach:** Remove the unused import.

**Affected Files:**
- `src/config/database.py` — line 9

**Testing:** Run `ruff check src/config/database.py`.

**Regression Risk:** NONE.

---

### Task 3.5: Create `.env.example` [C3]

**Root Cause:** No `.env.example` exists for the frontend. 7+ `EXPO_PUBLIC_*` env vars are referenced but undocumented.

**Fix Approach:** Create `app/.env.example`:
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_RC_IOS_KEY=
EXPO_PUBLIC_RC_ANDROID_KEY=
```

**Affected Files:**
- `app/.env.example` (new)

**Regression Risk:** NONE.

---

## PHASE 4: Low-Severity Fixes

> Polish, warnings, cleanup.

### Task 4.1: Remove unguarded console.logs [F5]

**Root Cause:** 2 `console.log` calls in `app/hooks/useOfflineWorkoutQueue.ts` are not wrapped in `if (__DEV__)`.

**Fix Approach:** Wrap both in `if (__DEV__)` guards.

**Affected Files:**
- `app/hooks/useOfflineWorkoutQueue.ts` — lines 31, 48

**Regression Risk:** NONE.

---

### Task 4.2: Evaluate `expo-tracking-transparency` [F6]

**Root Cause:** Package is installed in `package.json` but the import was added to `App.tsx` in our Phase 4 work. Need to verify it's actually being used.

**Fix Approach:**
1. Check if `requestTrackingPermissionsAsync` is imported in `App.tsx`
2. If yes → keep the package (it IS used)
3. If no → remove from `package.json`

**Affected Files:**
- `app/App.tsx` — verify import exists
- `app/package.json` — remove if unused

**Regression Risk:** NONE.

---

### Task 4.3: Fix deprecated `datetime.utcnow()` in tests [B7]

**Root Cause:** `tests/test_gtm_properties.py:174` uses `datetime.datetime.utcnow()` which is deprecated in Python 3.12+.

**Fix Approach:** Replace with `datetime.datetime.now(datetime.UTC)`.

**Affected Files:**
- `tests/test_gtm_properties.py` — line 174

**Regression Risk:** NONE.

---

### Task 4.4: Suppress pytest collection warning [C4]

**Root Cause:** `PytestCollectionWarning: cannot collect 'test_session_factory'` from SQLAlchemy's async session factory.

**Fix Approach:** Add to `pyproject.toml` under `[tool.pytest.ini_options]`:
```toml
filterwarnings = [
    "ignore::pytest.PytestCollectionWarning:sqlalchemy",
]
```

Or rename the fixture if it's in conftest.

**Affected Files:**
- `pyproject.toml` — pytest config section

**Regression Risk:** NONE.

---

## EXECUTION SUMMARY

| Phase | Tasks | Issues Fixed | Estimated Scope |
|-------|-------|-------------|-----------------|
| Phase 1 | 3 tasks | B1, C1, F1 | 3 files modified, 1 file created |
| Phase 2 | 3 tasks | B2, B3, B4, C2 | 3 files modified, 1 file deleted |
| Phase 3 | 5 tasks | F2, F3, B5, B6, C3 | 4 files modified, 3 files created |
| Phase 4 | 4 tasks | F5, F6, B7, C4 | 4 files modified |
| **Total** | **15 tasks** | **17 issues** | **~14 files modified, 4 created, 1 deleted** |

## DEPENDENCY ORDER

```
Phase 1 (all independent, can run in parallel):
  ├── Task 1.1 (B1 — async cooldown)
  ├── Task 1.2 (C1 — secrets baseline)
  └── Task 1.3 (F1 — test fix)

Phase 2 (all independent, can run in parallel):
  ├── Task 2.1 (B2 — atomic Redis locks)
  ├── Task 2.2 (B3, B4 — query limits)
  └── Task 2.3 (C2 — delete dead code)

Phase 3 (mostly independent):
  ├── Task 3.1 (F3 — ErrorBoundary)
  ├── Task 3.2 (F2 — ESLint config)
  ├── Task 3.3 (B5 — error handling) — depends on checking middleware first
  ├── Task 3.4 (B6 — unused import)
  └── Task 3.5 (C3 — .env.example)

Phase 4 (all independent):
  ├── Task 4.1 (F5 — console.logs)
  ├── Task 4.2 (F6 — tracking transparency)
  ├── Task 4.3 (B7 — datetime deprecation)
  └── Task 4.4 (C4 — pytest warning)
```

## RISK MATRIX

| Task | Regression Risk | Touches Shared Code? | Needs Manual Testing? |
|------|----------------|---------------------|----------------------|
| 1.1 (async cooldown) | LOW | No | Yes — verify cooldown works |
| 1.2 (secrets baseline) | NONE | No | Yes — verify pre-commit |
| 1.3 (test fix) | NONE | No | No — automated |
| 2.1 (atomic locks) | **MEDIUM** | **Yes — scheduler** | **Yes — multi-worker** |
| 2.2 (query limits) | LOW | No | No — automated |
| 2.3 (delete dead code) | LOW | No | No — automated |
| 3.1 (ErrorBoundary) | LOW | Yes — App.tsx | Yes — trigger crash |
| 3.2 (ESLint) | NONE | No | No — config only |
| 3.3 (error handling) | LOW | Depends | Depends |
| 3.4 (unused import) | NONE | No | No — automated |
| 3.5 (.env.example) | NONE | No | No |
| 4.1-4.4 | NONE | No | No |


---

## APPENDIX: UI Edge Cases & AI Agent Pitfall Prevention

> Added after deep UI audit. These are the bugs AI agents historically miss during implementation.
> 47 additional issues found across modals, inputs, loading states, navigation, and layout.

---

## PHASE 5: Input Validation (CRITICAL — Used Every Workout)

### Task 5.1: Add set validation before save [NEW-CRITICAL]

**Root Cause:** `activeExercisesToPayload()` in `app/utils/sessionEditConversion.ts` converts raw strings to numbers with `|| 0` fallback but NO range validation. Users can save:
- 0-rep sets (meaningless data)
- 0-weight sets (silently saved)
- 999999kg weights (no upper bound)
- Negative weights on Android with external keyboards
- RPE of 99 or -5 (no clamping)

**Impact:** Garbage data pollutes training history, breaks progressive overload calculations, corrupts analytics.

**Fix Approach:**
1. In `sessionEditConversion.ts`, add validation after parsing:
   ```
   reps: clamp(parseInt(s.reps, 10) || 0, 0, 999)
   weight_kg: clamp(parseFloat(s.weight) || 0, 0, 9999)
   rpe: s.rpe ? clamp(parseFloat(s.rpe), 1, 10) : null
   rir: s.rir ? clamp(parseInt(s.rir, 10), 0, 5) : null
   ```
2. Filter out sets where reps === 0 AND weight === 0 (empty sets)
3. Show a toast if any sets were filtered: "2 empty sets removed"

**Affected Files:**
- `app/utils/sessionEditConversion.ts` — add range clamping
- `app/components/training/SetRowPremium.tsx` — add `onBlur` validation that clamps RPE to 1-10

**Regression Risk:** MEDIUM — touches the save path for every workout. Test thoroughly.

**Testing:** Add unit tests for edge cases: empty string, NaN, negative, overflow, decimal reps.

---

### Task 5.2: Fix NaN in AddTrainingModal [NEW-CRITICAL]

**Root Cause:** `app/components/modals/AddTrainingModal.tsx:312` uses `Number(s.reps)` which returns `NaN` for non-numeric strings. The validation at line 287 only checks for empty strings, not invalid numbers.

**Fix Approach:**
1. Replace `Number(s.reps)` with `parseInt(s.reps, 10) || 0`
2. Add `isNaN` guard before API call
3. Add range validation matching Task 5.1

**Affected Files:**
- `app/components/modals/AddTrainingModal.tsx` — lines 287-314

**Regression Risk:** LOW — isolated modal.

---

### Task 5.3: Clamp RPE/RIR on blur [NEW-MEDIUM]

**Root Cause:** `SetRowPremium.tsx` allows free-text RPE/RIR entry via TextInput with no validation. `rpeToRir()` in `rpeConversion.ts` does `10 - rpe` with no clamping — RPE of 99 produces RIR of -89.

**Fix Approach:**
1. Add `onBlur` handler to RPE TextInput: clamp to 1-10, round to nearest 0.5
2. Add `onBlur` handler to RIR TextInput: clamp to 0-5
3. Add clamping in `rpeToRir()`: `Math.max(0, Math.min(5, 10 - rpe))`

**Affected Files:**
- `app/components/training/SetRowPremium.tsx` — add onBlur handlers
- `app/utils/rpeConversion.ts` — add clamping

**Regression Risk:** LOW.

---

## PHASE 6: Modal & Sheet Fixes

### Task 6.1: Fix stale state on swipe-dismiss [NEW-CRITICAL]

**Root Cause:** `AddBodyweightModal` and `AddTrainingModal` only call `reset()` in their `handleClose` function. But `ModalContainer`'s swipe-to-dismiss gesture calls `onClose` directly, bypassing `handleClose`. Result: reopening the modal shows stale data from the previous session.

**Fix Approach:** Add `useEffect` that resets state when visibility changes:
```tsx
useEffect(() => { if (visible) reset(); }, [visible]);
```

**Affected Files:**
- `app/components/modals/AddBodyweightModal.tsx`
- `app/components/modals/AddTrainingModal.tsx`

**Regression Risk:** LOW — additive effect hook.

---

### Task 6.2: Add safe area insets to 12 raw modals [NEW-HIGH]

**Root Cause:** 12 modal/sheet components use raw `<Modal>` without `useSafeAreaInsets`. Content renders behind the notch and home indicator on modern iPhones.

**Affected Components:**
- `TrialExpirationModal.tsx`, `UpgradeModal.tsx`, `ExerciseDetailSheet.tsx`, `RPEPicker.tsx`
- `RestTimer.tsx`, `RestTimerV2.tsx`, `RestTimerOverlay.tsx`, `ConfirmationSheet.tsx`
- `PoseSelector.tsx`, `LightingReminder.tsx`, `FatigueBreakdownModal.tsx`, `QuickAddModal.tsx`

**Fix Approach:** For each, add:
```tsx
const insets = useSafeAreaInsets();
// Apply paddingTop: insets.top and paddingBottom: insets.bottom to content container
```

**Regression Risk:** LOW — additive padding. But verify visually on iPhone with notch.

---

### Task 6.3: Fix ExerciseContextMenu back button [NEW-HIGH]

**Root Cause:** `ExerciseContextMenu.tsx` is a positioned overlay (not a `<Modal>`), so Android back button navigates away instead of dismissing the menu.

**Fix Approach:** Wrap in `<Modal transparent>` or add `BackHandler.addEventListener` that calls `onClose`.

**Affected Files:**
- `app/components/training/ExerciseContextMenu.tsx`

**Regression Risk:** LOW.

---

### Task 6.4: Add double-tap protection to FinishConfirmationSheet [NEW-MEDIUM]

**Root Cause:** "Confirm" and "Save as Template" buttons in `FinishConfirmationSheet.tsx` have no `disabled={loading}` state. User can tap twice rapidly, triggering duplicate workout saves.

**Fix Approach:** Add `isSubmitting` state, set to true on first tap, disable buttons while true.

**Affected Files:**
- `app/components/training/FinishConfirmationSheet.tsx`

**Regression Risk:** LOW.

---

### Task 6.5: Fix ExerciseDetailSheet visibility desync [NEW-MEDIUM]

**Root Cause:** Uses both `visible` prop and `internalVisible` state. When parent sets `visible=false`, there's no `useEffect` branch to trigger the close animation — the sheet stays visible until manually dismissed.

**Fix Approach:** Add `else` branch in the `useEffect` for `!visible` that triggers close animation.

**Affected Files:**
- `app/components/training/ExerciseDetailSheet.tsx`

**Regression Risk:** MEDIUM — animation timing. Test open/close/reopen cycle.

---

## PHASE 7: Navigation & Layout Fixes

### Task 7.1: Add SafeAreaView to 7 missing screens [NEW-CRITICAL]

**Root Cause:** 7 standalone screens have no SafeAreaView at all. Content overlaps notch and home indicator.

**Affected Screens:**
- `meal-prep/MealPlanScreen.tsx`
- `meal-prep/PrepSundayFlow.tsx`
- `meal-prep/ShoppingListView.tsx`
- `nutrition/AddIngredientsStep.tsx`
- `nutrition/MicronutrientDashboardScreen.tsx`
- `nutrition/RecipeBuilderScreen.tsx`
- `analytics/TrainingTabContent.tsx`

**Fix Approach:** Wrap each screen's root View in `<SafeAreaView style={{flex: 1}}>` or use `useSafeAreaInsets()` for more control.

**Regression Risk:** LOW — additive wrapper. Verify no double-inset with parent navigators.

---

### Task 7.2: Add KeyboardAvoidingView to 3 critical screens [NEW-HIGH]

**Root Cause:** 3 screens with text inputs at the bottom of the screen lack KeyboardAvoidingView. Keyboard covers the input.

**Critical:**
- `coaching/CoachingScreen.tsx` — chat input at bottom, keyboard covers it entirely
- `nutrition/AddIngredientsStep.tsx` — 3 inputs, lower ones hidden by keyboard

**Medium:**
- `onboarding/steps/GoalStep.tsx` — target weight input

**Fix Approach:** Wrap content in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`.

**Regression Risk:** LOW — but test on both iOS and Android. `behavior` differs by platform.

---

### Task 7.3: Lock orientation to portrait [NEW-HIGH]

**Root Cause:** No orientation lock configured. If device rotates to landscape, all layouts break — they're designed for portrait only.

**Fix Approach:** Add to `app/app.json`:
```json
{ "expo": { "orientation": "portrait" } }
```

**Regression Risk:** NONE.

---

### Task 7.4: Fix deep link auth screens [NEW-MEDIUM]

**Root Cause:** `linking={ready && isAuthenticated ? linking : undefined}` disables ALL deep links when logged out. This means `repwise://login` and `repwise://reset-password/:email` are unreachable when the user is logged out — exactly when they're needed.

**Fix Approach:** Split linking config into auth and non-auth routes:
```tsx
const authLinking = { prefixes: [...], config: { screens: { Login: 'login', ResetPassword: 'reset-password/:email' } } };
const appLinking = { prefixes: [...], config: { screens: { /* all app screens */ } } };
linking={ready ? (isAuthenticated ? appLinking : authLinking) : undefined}
```

**Affected Files:**
- `app/navigation/linking.ts` — split config
- `app/App.tsx` — conditional linking

**Regression Risk:** MEDIUM — touches navigation. Test all deep links in both auth states.

---

### Task 7.5: Add navigation stack reset on logout [NEW-MEDIUM]

**Root Cause:** No `navigation.reset()` on logout. After logging out, pressing back from the login screen could return to authenticated screens showing stale data.

**Fix Approach:** In the logout handler, reset the navigation state:
```tsx
navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
```

**Affected Files:** Wherever logout is handled (likely auth service or profile screen).

**Regression Risk:** LOW.

---

## PHASE 8: Loading, Empty & Error States

### Task 8.1: Add TanStack Query focusManager [NEW-CRITICAL]

**Root Cause:** TanStack Query's `refetchOnWindowFocus` requires `focusManager.setEventListener` wired to React Native's `AppState`. This is NOT configured. Queries NEVER refetch when the user navigates back to a screen or returns from background. The Dashboard comment "TanStack Query auto-refetches stale data" is incorrect without this setup.

**Impact:** Stale data across the entire app after any navigation or app backgrounding.

**Fix Approach:** Add to `App.tsx` or `queryClient.ts`:
```tsx
import { focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => sub.remove();
});
```

**Affected Files:**
- `app/services/queryClient.ts` or `app/App.tsx`

**Regression Risk:** MEDIUM — will cause more API calls (refetches on every focus). Verify staleTime (currently 5min) is appropriate.

---

### Task 8.2: Add empty states to 3 screens [NEW-HIGH]

**Root Cause:** ShoppingListView, AnalyticsScreen FlatLists, and WeeklyReportScreen FlatList show blank areas when data is empty.

**Fix Approach:** Add `ListEmptyComponent` to each FlatList:
```tsx
ListEmptyComponent={<EmptyState icon="..." message="No data yet" />}
```

**Affected Files:**
- `app/screens/meal-prep/ShoppingListView.tsx`
- `app/screens/analytics/AnalyticsScreen.tsx`
- `app/screens/reports/WeeklyReportScreen.tsx`

**Regression Risk:** NONE — additive prop.

---

### Task 8.3: Add pull-to-refresh to 2 critical screens [NEW-HIGH]

**Root Cause:** ExerciseHistoryScreen and PRHistoryScreen show stale data after completing a workout and have no way to refresh.

**Fix Approach:** Add `onRefresh` and `refreshing` props to the FlatList, wired to the query's `refetch()`.

**Affected Files:**
- `app/screens/training/ExerciseHistoryScreen.tsx`
- `app/screens/training/PRHistoryScreen.tsx`

**Regression Risk:** NONE — additive props.

---

### Task 8.4: Add global offline banner [NEW-MEDIUM]

**Root Cause:** Only FoodSearchPanel shows an offline indicator. All other screens show stale data or loading spinners with no explanation when offline.

**Fix Approach:** Create a global `OfflineBanner` component that listens to `NetInfo` and renders a persistent banner at the top of the screen when offline. Mount it in `App.tsx` above the NavigationContainer.

**Affected Files:**
- `app/components/common/OfflineBanner.tsx` (new)
- `app/App.tsx` — mount the banner

**Regression Risk:** LOW — additive component.

---

### Task 8.5: Add image error fallback to OptimizedImage and AlignedComparison [NEW-LOW]

**Root Cause:** `OptimizedImage.tsx` has no `onError` handler — stuck on placeholder forever if image fails. `AlignedComparison.tsx` uses raw `<Image>` with no fallback.

**Fix Approach:**
1. Add `onError` to OptimizedImage that shows a broken-image icon
2. Replace raw `<Image>` in AlignedComparison with `FallbackImage`

**Regression Risk:** NONE.

---

## AI AGENT PITFALL CHECKLIST

> Things AI agents consistently get wrong when implementing these fixes. Review before each task.

### Modal Fixes
- [ ] **Don't forget ModalContainer's swipe gesture** — it calls `onClose` directly, not `handleClose`. Any state cleanup must be in a `useEffect([visible])`, not just in `handleClose`.
- [ ] **Test the reopen cycle** — open modal → enter data → swipe dismiss → reopen. State must be fresh.
- [ ] **Safe area insets go on the CONTENT container**, not the Modal itself. `<Modal>` doesn't accept padding.
- [ ] **Don't add SafeAreaView inside ModalContainer-based modals** — ModalContainer already handles safe area. Only raw `<Modal>` components need it.

### Input Validation
- [ ] **`parseFloat('')` returns `NaN`, not 0.** Always use `|| 0` or explicit `isNaN` check.
- [ ] **`parseInt('3.5', 10)` returns `3`, not NaN.** This is correct for reps but surprising.
- [ ] **`Number('') === 0` but `Number(' ') === 0` too.** Use `parseInt`/`parseFloat` instead of `Number()`.
- [ ] **Android external keyboards CAN type minus signs** even with `keyboardType="number-pad"`. Always validate server-side too.
- [ ] **Don't show validation errors on every keystroke** — only on blur or submit. Keystroke validation is annoying.

### Navigation
- [ ] **`navigation.goBack()` crashes if there's nothing to go back to.** Always check `navigation.canGoBack()` first, or use `navigation.navigate('Home')` as fallback.
- [ ] **Deep link testing requires testing BOTH auth states** — logged in AND logged out.
- [ ] **Orientation lock in app.json requires a rebuild** — `expo start --clear` won't pick it up. Need `eas build` or `npx expo prebuild`.

### Loading/Empty States
- [ ] **`ListEmptyComponent` only renders when `data.length === 0`**, not during loading. Don't show "No data" while the query is still loading — check `isLoading` first.
- [ ] **`focusManager` will increase API calls.** Make sure `staleTime` is set appropriately (current 5min is fine).
- [ ] **Pull-to-refresh `refreshing` prop must be a boolean**, not the query's `isFetching` (which is true on initial load too). Use `isRefetching` instead.

### Layout
- [ ] **Don't double-wrap SafeAreaView** — if a screen is inside a navigator that already provides safe area (like a Stack with `headerShown: true`), adding SafeAreaView creates double padding.
- [ ] **KeyboardAvoidingView `behavior` differs by platform** — use `'padding'` on iOS, `'height'` on Android. Always use `Platform.OS` check.
- [ ] **KeyboardAvoidingView needs `keyboardVerticalOffset`** if there's a header. The offset should equal the header height.

---

## UPDATED EXECUTION SUMMARY

| Phase | Tasks | Issues | Scope |
|-------|-------|--------|-------|
| Phase 1 (Critical backend + infra) | 3 | B1, C1, F1 | 3 files |
| Phase 2 (High backend) | 3 | B2, B3, B4, C2 | 4 files |
| Phase 3 (Medium quality) | 5 | F2, F3, B5, B6, C3 | 7 files |
| Phase 4 (Low polish) | 4 | F5, F6, B7, C4 | 4 files |
| **Phase 5 (Input validation)** | **3** | **3 new** | **4 files** |
| **Phase 6 (Modal/sheet fixes)** | **5** | **7 new** | **14 files** |
| **Phase 7 (Navigation/layout)** | **5** | **5 new** | **12 files** |
| **Phase 8 (Loading/empty/error)** | **5** | **6 new** | **8 files** |
| **TOTAL** | **33 tasks** | **38 issues** | **~56 files** |


---

## APPENDIX B: Independent Judge Corrections

> Final verification pass. Every claim in the plan was checked against actual code.

### CORRECTIONS TO THE PLAN

| Task | Original Claim | Actual Finding | Action |
|------|---------------|----------------|--------|
| **6.1** (stale state on swipe) | "ModalContainer's swipe calls `onClose` directly, bypassing `handleClose`" | **WRONG.** ModalContainer calls whatever is passed as `onClose` — which IS `handleClose` in both AddBodyweightModal and AddTrainingModal. Swipe DOES trigger the unsaved-data Alert. | **Rewrite root cause.** The real bug is a race condition: swipe animation completes (modal slides away) BEFORE the Alert resolves. If user taps "Keep Editing", the modal is already visually gone. The `useEffect([visible])` safety net fix is still valid. |
| **7.3** (orientation lock) | "No orientation lock configured" | **WRONG.** `app.json` already has `"orientation": "portrait"`. | **REMOVE this task.** Already implemented. |
| **5.1** (set validation) | "RPE uses `parseFloat(s.rpe)` with `|| 0` fallback" | **WRONG — RPE has NO `|| 0` fallback.** Code is `rpe: s.rpe ? parseFloat(s.rpe) : null`. If `s.rpe` is a non-empty non-numeric string like "abc", `parseFloat("abc")` = `NaN` is sent to the API. | **Increase severity.** RPE/RIR NaN risk is worse than originally described. Fix must add explicit `isNaN` guard. |

### CONFIRMED CORRECT (No Changes Needed)

| Task | Verified Against |
|------|-----------------|
| 1.1 (async cooldown) | ✅ `_check_recalculate_cooldown` is sync, `get_redis()` returns coroutine. Critical bug confirmed. |
| 1.3 (test handler index) | ✅ `handlers[0]` is transient retry, tests need `handlers[1]` for 401 logic. |
| 5.2 (NaN in AddTrainingModal) | ✅ `Number(s.reps)` used, validation only checks empty strings. |
| 6.5 (ExerciseDetailSheet desync) | ✅ `useEffect` only handles `visible=true`, no `else` branch. `internalVisible` never synced to `false`. |
| 7.4 (deep link auth) | ✅ `linking={ready && isAuthenticated ? linking : undefined}` disables all deep links when logged out. |
| 8.1 (focusManager) | ✅ Zero matches for `focusManager` in entire app. Queries never refetch on focus. |

### ADDITIONAL FINDINGS FROM JUDGE

**1. ModalContainer swipe + Alert race condition (NEW — affects AddBodyweightModal, AddTrainingModal)**
When user swipes to dismiss and has unsaved data:
1. Swipe animation starts (modal slides down)
2. `handleClose` fires → shows Alert ("Discard Entry?")
3. Animation completes (modal is visually gone)
4. Alert is still showing over a dismissed modal
5. If user taps "Keep Editing" → modal is gone but `visible` is still `true` → UX glitch

**Fix:** In ModalContainer, don't complete the dismiss animation until `onClose` returns. Or: in the parent modals, prevent the swipe gesture when `hasUnsavedData()` is true.

**2. AddTrainingModal has a formStateRef restoration pattern (NOT a bug)**
The `useEffect([visible])` in AddTrainingModal restores form state from a ref — this is intentional for the exercise picker navigation flow. The plan should NOT add a `reset()` call here — it would break the form restoration.

**3. RPE/RIR NaN propagation path (WORSE than plan describes)**
```
User types "abc" in RPE field
→ s.rpe = "abc" (truthy)
→ parseFloat("abc") = NaN
→ rpe: NaN sent to API
→ Backend receives NaN → potential DB corruption or 500 error
```
The fix MUST add: `rpe: s.rpe ? (isNaN(parseFloat(s.rpe)) ? null : parseFloat(s.rpe)) : null`

**4. FinishConfirmationSheet double-tap (CONFIRMED — no loading state)**
```tsx
<TouchableOpacity onPress={onConfirm} ...>
  <Text>Confirm</Text>
</TouchableOpacity>
```
No `disabled`, no `loading`, no guard. User can tap multiple times → multiple workout saves.

**5. Navigation reset on logout (LOWER severity than plan claims)**
The app uses conditional rendering (`isAuthenticated ? <MainApp /> : <AuthNavigator />`), which unmounts the entire main navigation tree on logout. This effectively resets the stack. The plan's concern about "back button returns to authenticated screens" is **not a real issue** because the main stack is unmounted. However, there's a brief moment during the state transition where both navigators could be mounted — this is a React rendering edge case, not a navigation bug.

### REVISED TASK COUNT

| Change | Effect |
|--------|--------|
| Remove Task 7.3 (orientation lock) | -1 task |
| Downgrade Task 7.5 (nav reset on logout) from MEDIUM to LOW | Severity change only |
| Add swipe+Alert race condition fix to Task 6.1 | Scope increase |
| Increase Task 5.1 RPE/RIR severity | Severity change only |
| **Net change** | **32 tasks (was 33)** |

### FINAL TASK COUNT: 32 tasks across 8 phases covering 37 issues in ~55 files
