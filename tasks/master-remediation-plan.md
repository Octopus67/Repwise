# Repwise Master Remediation Plan
**Created:** 2026-04-07 | **Source:** UI Audit + Backend Audit Reports
**Total Issues:** 83 (8 Critical, 22 High, 32 Medium, 21 Low)

---

## Phase Overview

| Phase | Focus | Issues | Est. Effort |
|-------|-------|--------|-------------|
| 1 | Critical Fixes (Security + Stability) | 8 | 2-3 days |
| 2 | High Priority (UX Bugs + Backend Hardening) | 22 | 4-5 days |
| 3 | Medium Priority (Polish + Scalability) | 32 | 5-7 days |
| 4 | Low Priority (Nice-to-haves + Future-proofing) | 21 | 3-4 days |

---

## PHASE 1: CRITICAL FIXES (Security + Stability)

> **Goal:** Eliminate all issues that cause crashes, data exposure, broken features, or accessibility violations that block app store approval.

### Task 1.1 — [BE] Fix sync Redis blocking async event loop
- **Report ref:** Backend 1.1
- **Risk:** Every login/register/password-reset blocks the entire event loop during Redis I/O
- **Files:** `src/middleware/rate_limiter.py`, `src/modules/auth/router.py`
- **Steps:**
  1. In `rate_limiter.py`, wrap all sync Redis calls (`check_rate_limit`, `check_lockout`, `check_login_ip_rate_limit`, `record_attempt`, `reset_attempts`) with `asyncio.to_thread()`
  2. Create async wrapper functions: `async def async_check_rate_limit(...)` → `await asyncio.to_thread(check_rate_limit, ...)`
  3. Update `auth/router.py` to `await` the async wrappers instead of calling sync functions directly
  4. Alternatively: migrate `rate_limiter.py` to use `redis.asyncio.Redis` natively (cleaner long-term)
- **Verify:** Run `python -m pytest tests/ -k "auth or rate_limit"` — all pass. Load test login endpoint to confirm no event loop blocking.

### Task 1.2 — [BE] Fix raw exception leak in recomp endpoint
- **Report ref:** Backend 2.2
- **Risk:** Internal error messages (DB schema, logic details) exposed to client
- **Files:** `src/modules/recomp/router.py`
- **Steps:**
  1. Replace `raise HTTPException(status_code=400, detail=str(exc))` at line 61 with `raise ValidationError(message="Invalid recomp calculation input")`
  2. Add `logger.exception("Recomp calculation failed")` before the raise
  3. Scan for all other `HTTPException(detail=str(exc))` patterns across the codebase and fix similarly
- **Verify:** `pytest tests/ -k "recomp"` passes. Manually trigger a ValueError and confirm generic message returned.

### Task 1.3 — [BE] Add timeouts to all background jobs
- **Report ref:** Backend 6.1, 8.1
- **Risk:** Hanging job blocks entire scheduler; unbounded queries OOM at scale
- **Files:** `src/config/scheduler.py`, all files in `src/jobs/`
- **Steps:**
  1. In `scheduler.py`, create a wrapper: `async def run_with_timeout(coro, timeout=300)`  using `asyncio.wait_for()`
  2. Wrap each job registration: `run_with_timeout(permanent_deletion, timeout=600)`
  3. In each job file, add `.limit(1000)` to all `.all()` queries and process in batches
  4. Specifically fix `refresh_leaderboards.py`: batch by 1000 users, use `session.add_all()` instead of loop inserts
- **Verify:** `pytest tests/ -k "job or scheduler"` passes. Add a test that verifies timeout fires.

### Task 1.4 — [FE] Fix light mode gradients
- **Report ref:** UI 1.1
- **Risk:** Macro rings, charts, premium CTAs render incorrectly in light mode
- **Files:** `app/theme/lightColors.ts`
- **Steps:**
  1. Add `gradientArrays` object to `lightColors.ts` matching the structure in `tokens.ts`
  2. Use appropriate light-mode hues: calories `['#0891B2', '#0E7490']`, protein `['#16A34A', '#15803D']`, carbs `['#D97706', '#B45309']`, fat `['#DC2626', '#B91C1C']`
  3. Fix `premiumCta` to use two distinct stops: `['#0369A1', '#075985']`
  4. Add `primary` and `premium` gradient arrays
- **Verify:** Toggle to light mode, verify macro rings show gradients. Run `npx jest --testPathPattern="theme"`.

### Task 1.5 — [FE] Add screen reader support to all charts
- **Report ref:** UI 2.1
- **Risk:** App store rejection for accessibility non-compliance; excludes visually impaired users
- **Files:** `app/components/charts/TrendLineChart.tsx`, `app/components/analytics/BodySilhouette.tsx`, `app/components/analytics/FatigueHeatMapOverlay.tsx`, `app/components/analytics/BodyHeatMap.tsx`
- **Steps:**
  1. In `TrendLineChart.tsx`: wrap the `<Svg>` in a `<View accessibilityRole="image" accessibilityLabel={computedLabel}>` where `computedLabel` summarizes the data (e.g., "Weight trend: 75.4kg to 75.6kg over 14 days, increasing")
  2. Create a `computeChartA11yLabel(data, suffix)` utility in `app/utils/chartAccessibility.ts`
  3. In `BodySilhouette.tsx`: add `accessibilityLabel` to each muscle region Path (e.g., "Chest: 12 hypertrophy units, optimal")
  4. In `FatigueHeatMapOverlay.tsx`: add `accessibilityLabel` to each cell (e.g., "Chest fatigue: 45, moderate")
  5. In `BodyHeatMap.tsx`: add `accessibilityRole="image"` with summary label
- **Verify:** Enable VoiceOver/TalkBack, navigate to analytics — all charts announce data summaries.

### Task 1.6 — [FE] Gate all common component animations behind useReduceMotion
- **Report ref:** UI 2.2
- **Risk:** Accessibility violation — users with motion sensitivity get no relief
- **Files:** `app/components/common/ModalContainer.tsx`, `app/components/common/Skeleton.tsx`, `app/components/common/Toast.tsx`, `app/components/common/FilterPill.tsx`, `app/components/common/EmptyState.tsx`, `app/components/common/AnimatedTabIndicator.tsx`
- **Steps:**
  1. In each file: import `useReduceMotion` from `../../hooks/useReduceMotion`
  2. Add `const reduceMotion = useReduceMotion();`
  3. When `reduceMotion` is true: skip `withTiming`/`withSpring` animations, set values instantly
  4. ModalContainer: skip slide-up animation, show immediately
  5. Skeleton: skip shimmer, show static opacity
  6. Toast: skip slide animation, show immediately
- **Verify:** Enable "Reduce Motion" in OS settings. Verify no animations play in modals, skeletons, toasts.

### Task 1.7 — [FE] Build follow/unfollow UI for social
- **Report ref:** UI 7.1
- **Risk:** Core social feature is broken — feed says "Follow friends" but no way to do it
- **Files:** New: `app/screens/social/DiscoverScreen.tsx`, `app/components/social/UserRow.tsx`. Modify: `app/screens/social/FeedScreen.tsx`, `app/navigation/BottomTabNavigator.tsx`
- **Steps:**
  1. Create `UserRow.tsx` — avatar, display name, follow/unfollow button with optimistic toggle
  2. Create `DiscoverScreen.tsx` — search users via `GET /social/users/search` (if exists) or list suggested users
  3. Add a "Find Friends" button to FeedScreen empty state and header
  4. Wire follow/unfollow to existing backend endpoints: `POST /social/follow/{user_id}`, `DELETE /social/follow/{user_id}`
  5. Add followers/following counts to profile or social tab
  6. If backend search endpoint doesn't exist, create `GET /social/users/search?q=` endpoint
- **Verify:** Create a second test user, follow them, verify their posts appear in feed.

### Task 1.8 — [BE] Fix silent error swallowing + add logging
- **Report ref:** Backend 5.1
- **Risk:** Errors disappear silently, impossible to debug production issues
- **Files:** `src/modules/dietary_analysis/router.py`, `src/modules/reports/service.py`
- **Steps:**
  1. In `dietary_analysis/router.py:55`: replace `except Exception: return []` with `except Exception: logger.exception("Dietary analysis failed"); return []`
  2. In `reports/service.py:53`: replace `except Exception: prev_sets = {}` with `except Exception: logger.exception("Failed to load previous sets"); prev_sets = {}`
  3. Both now log the full traceback to Sentry while still gracefully degrading
- **Verify:** `pytest tests/ -k "dietary or report"` passes.

---

## PHASE 2: HIGH PRIORITY (UX Bugs + Backend Hardening)

> **Goal:** Fix all user-visible bugs, backend security gaps, and data integrity issues.

### Task 2.1 — [FE] Fix dashboard skeleton mismatch (3 circles → 4)
- **Report ref:** UI 3.1
- **File:** `app/screens/dashboard/DashboardScreen.tsx:254`
- **Steps:** Add a 4th `<Skeleton width={96} height={96} variant="circle" />` to match the 4 macro rings
- **Verify:** Reload dashboard — skeleton shows 4 circles.

### Task 2.2 — [FE] Fix QuickActionButton badge visibility
- **Report ref:** UI 3.2
- **File:** `app/components/dashboard/QuickActionButton.tsx:52-54`
- **Steps:** Change `<Icon name="check" size={12} color={c.semantic.positive} />` to `color="#FFFFFF"`
- **Verify:** Complete a meal log, verify green badge shows white checkmark.

### Task 2.3 — [FE] Fix HeatMapCard dark theme loading overlay
- **Report ref:** UI 4.1
- **File:** `app/components/analytics/HeatMapCard.tsx:155`
- **Steps:** Replace `rgba(255, 255, 255, 0.7)` with `c.bg.overlay` theme token
- **Verify:** Switch to dark mode, navigate to heatmap, trigger loading — overlay should be dark-tinted.

### Task 2.4 — [FE] Color-code fatigue breakdown bars by severity
- **Report ref:** UI 4.2
- **File:** `app/components/analytics/FatigueBreakdownModal.tsx:121`
- **Steps:**
  1. Replace static `c.accent.primary` with dynamic color based on bar value
  2. Use `getFatigueColor(value)` — ≤30 green, ≤60 yellow, >60 red
- **Verify:** Open fatigue breakdown — bars show different colors based on severity.

### Task 2.5 — [FE] Add KeyboardAvoidingView to ActiveWorkoutScreen
- **Report ref:** UI 6.1
- **File:** `app/screens/training/ActiveWorkoutScreen.tsx`
- **Steps:**
  1. Import `KeyboardAvoidingView` from `react-native`
  2. Wrap the main ScrollView content in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>`
- **Verify:** Start a workout, scroll to bottom exercise, tap weight input — keyboard doesn't obscure it.

### Task 2.6 — [FE] Add input field chaining in ManualEntryForm
- **Report ref:** UI 5.1
- **File:** `app/components/nutrition/ManualEntryForm.tsx`
- **Steps:**
  1. Create refs: `const proteinRef = useRef<TextInput>(null)` etc. for each field
  2. Add `returnKeyType="next"` and `onSubmitEditing={() => proteinRef.current?.focus()}` to calories input
  3. Chain: calories → protein → carbs → fat → fibre → water
  4. Last field: `returnKeyType="done"` with `onSubmitEditing={handleSubmit}`
- **Verify:** Open manual entry, type calories, press "Next" — focus moves to protein field.

### Task 2.7 — [FE] Add accessibility roles to 12+ common components
- **Report ref:** UI 2.3
- **Files:** Card, Toast, ProgressBar, FilterPill, Tooltip, SetupBanner, SectionHeader, Icon, SwipeableRow, GradientButton, EditableField, BrandedLoader (all in `app/components/common/`)
- **Steps:** For each component:
  1. Card (pressable): add `accessibilityRole="button"` when `onPress` is provided
  2. Toast: add `accessibilityRole="alert"` and `accessibilityLiveRegion="assertive"`
  3. ProgressBar: add `accessibilityRole="progressbar"` with `accessibilityValue`
  4. FilterPill: add `accessibilityRole="button"` and `accessibilityState={{ selected: active }}`
  5. Tooltip: add `accessibilityRole="tooltip"`
  6. GradientButton: add `accessibilityRole="button"`
  7. Others: add appropriate `accessibilityLabel` describing the component's purpose
- **Verify:** Enable screen reader, navigate through each component — all announce correctly.

### Task 2.8 — [FE] Fix color-blind safety with text labels
- **Report ref:** UI 2.5
- **Files:** `app/components/analytics/BodySilhouette.tsx`, `app/components/analytics/HeatMapLegend.tsx`, `app/components/analytics/FatigueHeatMapOverlay.tsx`
- **Steps:**
  1. In HeatMapLegend: already has text labels alongside color dots — verify they're visible
  2. In BodySilhouette: on tap, the DrillDownModal shows text status — sufficient
  3. In FatigueHeatMapOverlay: each cell already shows numeric score + text label — sufficient
  4. In macro rings: the center text shows the value — sufficient
  5. Main gap: the body silhouette regions themselves have no text overlay. Add small text labels on the most active regions (top 3 by HU)
- **Verify:** Enable color-blind simulation in iOS/Android dev tools — all data is readable without color.

### Task 2.9 — [FE] Load avatar images in FeedCard
- **Report ref:** UI 7.2
- **File:** `app/components/social/FeedCard.tsx`
- **Steps:**
  1. Import `Image` from `react-native`
  2. When `event.user.avatar_url` is non-null, render `<Image source={{ uri: avatar_url }} style={styles.avatar} />`
  3. Keep initials as fallback when `avatar_url` is null or image fails to load (use `onError`)
- **Verify:** Seed a user with an avatar URL, verify image loads in feed.

### Task 2.10 — [FE] Fix leaderboard: add refresh + time period + remove emojis
- **Report ref:** UI 7.3, 7.5
- **File:** `app/screens/social/LeaderboardScreen.tsx`, `app/components/social/LeaderboardRow.tsx`
- **Steps:**
  1. Add `RefreshControl` to the FlatList/ScrollView
  2. Add time period tabs: Weekly / Monthly / All-Time
  3. In `LeaderboardRow.tsx`: replace `{ 1: '🥇', 2: '🥈', 3: '🥉' }` with styled View badges (gold/silver/bronze circles with rank number)
- **Verify:** Pull to refresh works. Switch between time periods. No emojis visible.

### Task 2.11 — [FE] Add landscape support for charts
- **Report ref:** UI 10.1
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:**
  1. Import `useWindowDimensions` (already used)
  2. Detect orientation: `const isLandscape = width > height`
  3. When landscape: increase chart height to fill available space, hide surrounding UI
  4. Add `onLayout` handler to recalculate dimensions on rotation
- **Verify:** Rotate device to landscape — chart expands to fill width and height.

### Task 2.12 — [FE] Fix border radius tokens (lg ≠ xl)
- **Report ref:** UI 1.2
- **File:** `app/theme/tokens.ts`
- **Steps:** Change `xl: 16` to `xl: 20`
- **Verify:** Search codebase for `radius.xl` usage — verify no visual regressions.

### Task 2.13 — [FE] Add `info` semantic color
- **Report ref:** UI 1.3
- **Files:** `app/theme/tokens.ts`, `app/theme/lightColors.ts`
- **Steps:** Add `info: '#0EA5E9'`, `infoSubtle: 'rgba(14,165,233,0.10)'` to both dark and light color objects
- **Verify:** TypeScript compiles. Grep for places using `accent.primary` as info — consider migrating.

### Task 2.14 — [BE] Add liveness probe + enhance health check
- **Report ref:** Backend 1.2
- **File:** `src/main.py`
- **Steps:**
  1. Add `GET /healthz` — returns `{"status": "ok"}` with no DB/Redis dependency
  2. Enhance `GET /api/v1/health` to also call `redis_health_check()` and report Redis status
  3. Return `{"db": "ok", "redis": "ok"|"unavailable"}` with 200 if DB is up, 503 if DB is down
- **Verify:** Stop DB — `/healthz` returns 200, `/api/v1/health` returns 503.

### Task 2.15 — [BE] Move OAuth state to Redis
- **Report ref:** Backend 1.3
- **File:** `src/modules/auth/oauth_state.py`
- **Steps:**
  1. Replace in-memory dict with Redis SET/GET with 5-minute TTL
  2. Use `asyncio.to_thread()` for Redis calls (or async Redis if migrated in Task 1.1)
  3. Fallback to in-memory if Redis unavailable
- **Verify:** `pytest tests/ -k "oauth"` passes. Test with 2 Gunicorn workers — state validates across workers.

### Task 2.16 — [BE] Add FK constraint to payment_transactions
- **Report ref:** Backend 3.1
- **File:** `src/modules/payments/models.py`, new Alembic migration
- **Steps:**
  1. Add `ForeignKey('subscriptions.id', ondelete='SET NULL')` to `subscription_id` column
  2. Generate Alembic migration: `alembic revision --autogenerate -m "add_fk_payment_transactions_subscription"`
  3. Apply migration: `alembic upgrade head`
- **Verify:** Try inserting a payment_transaction with non-existent subscription_id — should fail.

### Task 2.17 — [BE] Add pagination to 13 unbounded list endpoints
- **Report ref:** Backend 4.1
- **Files:** Routers for: custom exercises, volume-trend, strength-progression, muscle-frequency, e1rm-history, followers, following, readiness scores, periodization blocks, export history, recomp measurements, measurements trend, achievements
- **Steps:**
  1. For each endpoint: add `limit: int = Query(default=50, ge=1, le=200)` and `offset: int = Query(default=0, ge=0)`
  2. Add `.limit(limit).offset(offset)` to the SQLAlchemy query
  3. Return `{"items": [...], "total": count, "limit": limit, "offset": offset}`
- **Verify:** Call each endpoint with `?limit=5` — returns exactly 5 items.

### Task 2.18 — [BE] Standardize error format (replace 15 HTTPExceptions)
- **Report ref:** Backend 4.2
- **Files:** `src/modules/recomp/router.py` (7), `src/modules/import_data/router.py` (3), `src/modules/reports/router.py` (2), `src/modules/training/analytics_router.py` (1), `src/modules/training/wns_volume_service.py` (1)
- **Steps:**
  1. Replace each `raise HTTPException(status_code=X, detail="msg")` with the appropriate `ApiError` subclass
  2. 400 → `ValidationError`, 404 → `NotFoundError`, 403 → `ForbiddenError`, 409 → `ConflictError`
  3. Never pass `str(exc)` as the message — use generic user-facing messages
- **Verify:** `pytest tests/` — all pass. Check error response format is consistent `{status, code, message}`.

### Task 2.19 — [BE] Add XSS sanitization
- **Report ref:** Backend 2.3
- **Files:** New: `src/shared/sanitize.py`. Modify: social schemas, coaching schemas, exercise schemas
- **Steps:**
  1. `pip install bleach` and add to requirements
  2. Create `sanitize.py` with `def clean_text(value: str) -> str: return bleach.clean(value, tags=[], strip=True)`
  3. Add `field_validator` to `PostCreate.content`, coaching note schemas, custom exercise name/description
  4. Apply `clean_text()` in each validator
- **Verify:** Submit a post with `<script>alert('xss')</script>` — stored as plain text with tags stripped.

### Task 2.20 — [BE] Add dead-man's-switch monitoring for jobs
- **Report ref:** Backend 6.2
- **Files:** All files in `src/jobs/`, `src/config/scheduler.py`
- **Steps:**
  1. Create `src/utils/monitoring.py` with `async def ping_healthcheck(job_name: str)` that POSTs to a monitoring URL
  2. At the end of each job's success path, call `await ping_healthcheck("job_name")`
  3. Configure monitoring URLs via env var `HEALTHCHECK_URLS` (JSON map of job_name → URL)
  4. If no URL configured, skip silently (dev mode)
- **Verify:** Run a job manually — verify ping is sent (or logged in dev mode).

### Task 2.21 — [BE] Add unbounded query limits to jobs/services
- **Report ref:** Backend 8.1
- **Files:** `src/jobs/refresh_leaderboards.py`, `src/jobs/export_worker.py`, `src/jobs/trial_expiration.py`, `src/modules/achievements/service.py`, `src/modules/achievements/engine.py`
- **Steps:**
  1. Replace all `.all()` with `.limit(1000)` and process in batches with offset
  2. In `refresh_leaderboards.py`: use `session.add_all(entries)` instead of loop inserts
  3. In `achievements/engine.py`: paginate user queries
- **Verify:** `pytest tests/ -k "achievement or leaderboard or export"` passes.

### Task 2.22 — [BE] Fix raw exception leak across all modules
- **Report ref:** Backend 2.2 (expanded)
- **Files:** All 15 `HTTPException` locations identified in Task 2.18
- **Steps:** Same as Task 2.18 — this is the security-focused view of the same fix
- **Verify:** No `str(exc)` appears in any `HTTPException` or `ApiError` raise statement.

---

## PHASE 3: MEDIUM PRIORITY (Polish + Scalability)

> **Goal:** Improve UX polish, data validation, performance, and bring the app closer to industry benchmarks.

### Task 3.1 — [FE] Replace InfoBanner chevron with Icon component
- **Report ref:** UI 3.3
- **File:** `app/screens/dashboard/DashboardScreen.tsx`
- **Steps:** Replace raw `›` character with `<Icon name="chevron-right" size={16} color={c.text.muted} />`

### Task 3.2 — [FE] Position chart tooltip near selected point
- **Report ref:** UI 3.4
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:** Calculate the (x, y) position of the selected point and render tooltip as an absolute-positioned overlay near it, with arrow pointing to the point.

### Task 3.3 — [FE] Add drag/scrub interaction to charts
- **Report ref:** UI 3.5
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:** Replace `TouchableWithoutFeedback` with `Gesture.Pan()` from react-native-gesture-handler. On pan, find nearest data point to finger X position and select it.

### Task 3.4 — [FE] Virtualize dashboard ScrollView
- **Report ref:** UI 3.6
- **File:** `app/screens/dashboard/DashboardScreen.tsx`
- **Steps:** Convert from `ScrollView` to `FlashList` or `SectionList` with section-based rendering for the 20+ dashboard sections.

### Task 3.5 — [FE] Add chart legend for dual-series bodyweight chart
- **Report ref:** UI 4.3
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:** When `secondaryData` or `primaryAsDots` is provided, render a small legend row below the chart: `● Raw` and `— Trend` with matching colors.

### Task 3.6 — [FE] Add fatigue empty state
- **Report ref:** UI 4.4
- **File:** `app/screens/analytics/TrainingTabContent.tsx`
- **Steps:** When `fatigueScores.length === 0`, show `<EmptyState icon="activity" title="No fatigue data yet" description="Log 2+ weeks of training to see fatigue analysis" />`

### Task 3.7 — [FE] Add animated transitions between chart data sets
- **Report ref:** UI 4.5
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:** When data changes (time range switch), animate data point positions with `withTiming` instead of instant re-render. Use shared values for each point's Y position.

### Task 3.8 — [FE] Add inline validation feedback to ManualEntryForm
- **Report ref:** UI 5.2
- **File:** `app/components/nutrition/ManualEntryForm.tsx`
- **Steps:** Add `borderColor` state per field. On invalid input (negative, exceeds max), set border to `c.semantic.negative`. Clear on valid input.

### Task 3.9 — [FE] Add macro donut chart
- **Report ref:** UI 5.3
- **Files:** New: `app/components/nutrition/MacroDonutChart.tsx`
- **Steps:** Create a simple SVG donut chart showing protein/carbs/fat proportions. Use `react-native-svg` arcs. Add to nutrition tab in analytics or dashboard below macro rings.

### Task 3.10 — [FE] Surface TDEE post-onboarding
- **Report ref:** UI 5.4
- **File:** `app/screens/analytics/AnalyticsScreen.tsx` (nutrition tab)
- **Steps:** Add a small TDEE display card showing current estimated TDEE from adaptive targets. Reuse the stacked bar visualization from `TDEERevealStep.tsx`.

### Task 3.11 — [FE] Add drag-and-drop exercise reordering
- **Report ref:** UI 6.2
- **File:** `app/screens/training/ActiveWorkoutBody.tsx`
- **Steps:** Install `react-native-draggable-flatlist`. Replace exercise list with `DraggableFlatList`. Keep ▲/▼ buttons as fallback for accessibility.

### Task 3.12 — [FE] Add PR markers on exercise history chart
- **Report ref:** UI 6.3
- **File:** `app/screens/training/ExerciseHistoryScreen.tsx`
- **Steps:** Identify PR data points (where e1RM is highest so far). Render a small star/trophy SVG marker at those points on the chart.

### Task 3.13 — [FE] Add optimistic insert for compose posts
- **Report ref:** UI 7.4
- **File:** `app/screens/social/FeedScreen.tsx`
- **Steps:** In `postMutation.onMutate`: cancel feed queries, snapshot cache, prepend optimistic post to feed data. In `onError`: rollback to snapshot. In `onSettled`: invalidate.

### Task 3.14 — [FE] Add badge indicators to tab bar
- **Report ref:** UI 9.1
- **File:** `app/navigation/BottomTabNavigator.tsx`
- **Steps:** Create a badge dot component. Show on Social tab when there are unread feed items. Show on Analytics tab when weekly report is available. Use a simple zustand store for badge state.

### Task 3.15 — [FE] Add shared element transitions
- **Report ref:** UI 9.2
- **Files:** Navigation config, exercise picker, feed cards
- **Steps:** Install `react-navigation-shared-element`. Add shared element tags to exercise images/names between picker and detail screens.

### Task 3.16 — [FE] Add multi-series legend to TrendLineChart
- **Report ref:** UI 10.3
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:** Add optional `legend?: Array<{color: string, label: string}>` prop. When provided, render a row of color dot + label pairs below the chart.

### Task 3.17 — [FE] Add save confirmation toast to preferences
- **Report ref:** UI 8.1
- **File:** `app/components/profile/PreferencesSection.tsx`
- **Steps:** After successful API save, show `<Toast message="Saved" variant="success" />` for 2 seconds.

### Task 3.18 — [FE] Add pinch-to-zoom on charts
- **Report ref:** UI 10.2
- **File:** `app/components/charts/TrendLineChart.tsx`
- **Steps:** Add `Gesture.Pinch()` handler. On pinch, scale the visible data range (zoom into a subset of data points). Add reset-zoom button.

### Task 3.19 — [FE] Add `4xl` typography size + `xs`/`xl` elevation
- **Report ref:** UI 1.4, 1.5
- **File:** `app/theme/tokens.ts`
- **Steps:** Add `'4xl': 48` to typography.size. Add `xs` (elevation 1) and `xl` (elevation 12) to shadow definitions.

### Task 3.20 — [BE] Fix request ID inconsistency
- **Report ref:** Backend 1.4
- **Files:** `src/middleware/logging_middleware.py`, `src/main.py` (exception handler)
- **Steps:** Use a single full UUID generated in logging middleware. Store in `contextvars.ContextVar`. Read from context in exception handler instead of generating a new one.

### Task 3.21 — [BE] Set scheduler timezone to UTC
- **Report ref:** Backend 6.3
- **File:** `src/config/scheduler.py`
- **Steps:** Change `AsyncIOScheduler()` to `AsyncIOScheduler(timezone="UTC")`

### Task 3.22 — [BE] Batch refresh_leaderboards queries
- **Report ref:** Backend 6.4, 6.5
- **File:** `src/jobs/refresh_leaderboards.py`
- **Steps:** Process users in batches of 1000. Use `session.add_all()` for bulk inserts.

### Task 3.23 — [BE] Add partial indexes to 6 soft-delete models
- **Report ref:** Backend 3.2
- **Files:** Models for user_achievements, food_items, coaching_requests, coaching_sessions, body_measurements, progress_photos, recomp_measurements
- **Steps:** Add `Index('ix_<table>_not_deleted', 'id', postgresql_where=text('deleted_at IS NULL'))` to each model's `__table_args__`. Generate Alembic migration.

### Task 3.24 — [BE] Verify/add indexes on 15+ FK columns
- **Report ref:** Backend 3.4
- **Files:** Multiple model files
- **Steps:** For each FK column listed, check if an index exists in migrations. If not, add `index=True` to the column definition and generate migration.

### Task 3.25 — [BE] Add rate limits to write endpoints
- **Report ref:** Backend 4.3
- **Files:** Training, nutrition, social, coaching routers
- **Steps:** Add `Depends(RateLimit(60, 60))` (60 requests/minute) to POST endpoints. Add `Depends(RateLimit(30, 60))` to PUT/DELETE endpoints.

### Task 3.26 — [BE] Add future-date validation
- **Report ref:** Backend 7.2
- **Files:** Training, health_reports, bodyweight schemas
- **Steps:** Add `field_validator` that rejects dates more than 1 day in the future: `if value > date.today() + timedelta(days=1): raise ValueError("Date cannot be in the future")`

### Task 3.27 — [BE] Add upper bounds to food_database macros
- **Report ref:** Backend 7.1
- **File:** `src/modules/food_database/schemas.py`
- **Steps:** Add `le=50000` for calories, `le=5000` for protein/carbs/fat fields.

### Task 3.28 — [BE] Add health_reports marker value bounds
- **Report ref:** Backend 7.3
- **File:** `src/modules/health_reports/schemas.py`
- **Steps:** Add `field_validator` for markers dict: each value must be `0 <= v <= 100000`.

### Task 3.29 — [BE] Add Redis caching for hot read paths
- **Report ref:** Backend 8.2
- **Files:** New: `src/utils/cache.py`. Modify: user service, nutrition service, dashboard endpoint
- **Steps:** Create a `@cached(ttl=60)` decorator that checks Redis before hitting DB. Apply to: user profile fetch, daily nutrition summary, dashboard data aggregation.

### Task 3.30 — [BE] Fix sharing/models.py legacy patterns
- **Report ref:** Backend 3.3
- **File:** `src/modules/sharing/models.py`
- **Steps:** Migrate `Column()` to `mapped_column()`. Add `updated_at` column. Add `server_default=func.now()` to `created_at`.

### Task 3.31 — [BE] Add PII scrubbing to access logs
- **Report ref:** Backend 2.5
- **File:** `src/middleware/logging_middleware.py`
- **Steps:** Before logging the path, strip sensitive query params: `token`, `code`, `email`, `password`. Replace with `[REDACTED]`.

### Task 3.32 — [BE] Add JWT audience/issuer validation
- **Report ref:** Backend 2.6
- **Files:** `src/middleware/authenticate.py`, `src/modules/auth/service.py`
- **Steps:** Add `issuer="repwise"` and `audience="repwise-api"` to `jwt.encode()`. Add `issuer` and `audience` params to `jwt.decode()`.

---

## PHASE 4: LOW PRIORITY (Nice-to-haves + Future-proofing)

> **Goal:** Final polish, developer experience improvements, and long-term maintainability.

### Task 4.1 — [FE] Fix spacing comment in tokens.ts
- **Report ref:** UI 1.6
- **File:** `app/theme/tokens.ts`
- **Steps:** Change "8px grid" comment to "4px grid"

### Task 4.2 — [FE] Add shadows to dashboard cards
- **Report ref:** UI 3.7
- **File:** `app/screens/dashboard/DashboardScreen.tsx`
- **Steps:** Add `shadow="sm"` prop to QuickActionButton cards and key interactive banners.

### Task 4.3 — [FE] Fix hardcoded borderRadius in skeleton
- **Report ref:** UI 3.8
- **File:** `app/screens/dashboard/DashboardScreen.tsx:244`
- **Steps:** Replace `borderRadius={12}` with `borderRadius={radius.md}`

### Task 4.4 — [FE] Add skeleton placeholders for e1RM/Standards/Leaderboard
- **Report ref:** UI 4.6
- **File:** `app/screens/analytics/TrainingTabContent.tsx`
- **Steps:** Add `<Skeleton>` placeholders for these sections while `isLoading` is true.

### Task 4.5 — [FE] Add favorites swipe-to-delete hint
- **Report ref:** UI 5.5
- **File:** Food favorites component
- **Steps:** Add swipe-to-delete via `SwipeableRow` or add a visible trash icon on each favorite.

### Task 4.6 — [FE] Add haptic on rest timer completion
- **Report ref:** UI 6.4
- **File:** `app/components/training/RestTimerV2.tsx`
- **Steps:** Add `haptic.notification('success')` when timer reaches 0.

### Task 4.7 — [FE] Generate shareable card from workout summary
- **Report ref:** UI 6.5
- **File:** `app/screens/training/WorkoutSummaryScreen.tsx`
- **Steps:** Use `react-native-view-shot` to capture the summary stats as an image. Share via `Share.share({ url: imageUri })`.

### Task 4.8 — [FE] Add comment/reply to feed cards (Phase 2 feature)
- **Report ref:** UI 7.6
- **Scope:** Backend: add comments table + endpoints. Frontend: add comment thread UI below FeedCard.
- **Steps:** Design comment schema, create `POST /social/feed/{event_id}/comments`, add CommentThread component.

### Task 4.9 — [FE] Add deep links for WeeklyReport, Measurements, ProgressPhotos
- **Report ref:** UI 8.2
- **File:** `app/navigation/linking.ts`
- **Steps:** Add routes: `weekly-report`, `measurements`, `progress-photos` with appropriate screen mappings.

### Task 4.10 — [FE] Convert key modals to navigation screens
- **Report ref:** UI 9.3
- **Scope:** Long-term refactor. Convert AddNutritionModal, AddTrainingModal to stack screens for deep linking and navigation history.

### Task 4.11 — [FE] Add RTL support
- **Report ref:** UI 2.4
- **Scope:** App-wide refactor
- **Steps:** Use `I18nManager.isRTL` for directional styles. Flip chevron icons. Use `start`/`end` instead of `left`/`right` in styles. Test with Arabic locale.

### Task 4.12 — [BE] Add explicit SIGTERM handler
- **Report ref:** Backend 1.6
- **File:** `src/main.py`
- **Steps:** Add `signal.signal(signal.SIGTERM, graceful_shutdown)` that sets a flag to stop accepting new requests and waits for in-flight requests to complete.

### Task 4.13 — [BE] Explicitly set bcrypt rounds
- **Report ref:** Backend 2.8
- **File:** `src/modules/auth/service.py`
- **Steps:** Change `bcrypt.gensalt()` to `bcrypt.gensalt(rounds=12)`

### Task 4.14 — [BE] Replace print() with logger in seed scripts
- **Report ref:** Backend 5.3
- **Files:** `src/modules/feature_flags/seed_*.py`, `src/modules/measurements/seed_flag.py`
- **Steps:** Replace all `print()` calls with `logger.info()`

### Task 4.15 — [BE] Add streaming body size enforcement
- **Report ref:** Backend 8.4
- **File:** `src/middleware/body_size_limit.py`
- **Steps:** In addition to Content-Length header check, track bytes read from the request body stream and abort if exceeding limit.

### Task 4.16 — [BE] Add concurrency tests
- **Report ref:** Backend 9.1
- **Files:** New test files in `tests/`
- **Steps:** Add tests using `asyncio.gather()` to simulate concurrent writes to: social reactions, training session updates, payment webhooks. Verify no race conditions.

### Task 4.17 — [BE] Add session security tests
- **Report ref:** Backend 9.2
- **Files:** New test file `tests/test_session_security.py`
- **Steps:** Test: token rejected after password change, blacklisted token rejected on replay, expired refresh token rejected.

### Task 4.18 — [BE] Add database migration tests
- **Report ref:** Backend 9.3
- **Files:** New test file `tests/test_migrations.py`
- **Steps:** Test that `alembic upgrade head` succeeds on a fresh database. Test that `alembic downgrade -1` then `upgrade head` succeeds.

### Task 4.19 — [BE] Fix _recalculate_attempts memory leak
- **Report ref:** Backend 8.3
- **File:** `src/modules/user/service.py`
- **Steps:** Add maxsize (1000 entries) with LRU eviction, or use TTL-based dict that auto-expires entries after 1 hour.

### Task 4.20 — [BE] Add timezone enforcement to datetime schemas
- **Report ref:** Backend 7.4
- **Files:** All Pydantic schemas using `datetime`
- **Steps:** Replace `datetime` with `AwareDatetime` from Pydantic v2, or add `field_validator` that rejects naive datetimes.

### Task 4.21 — [BE] Migrate manual session management in jobs
- **Report ref:** Backend 6.6
- **Files:** `src/jobs/trial_expiration.py`, `src/jobs/export_worker.py`, `src/jobs/cleanup_exports.py`, `src/jobs/workout_reminders.py`
- **Steps:** Replace `session = async_session_factory()` + try/finally/close with `async with async_session_factory() as session:` context manager.

---

## Execution Rules

1. **Phase order is strict** — complete Phase N before starting Phase N+1
2. **Each task gets an audit** — after implementing, review as if you didn't write it
3. **Tests must pass** — run full test suite after each task; fix regressions immediately
4. **No scope creep** — implement exactly what's described, nothing more
5. **Track progress** — mark tasks complete in this file as you go

---

## Summary Statistics

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Frontend | 5 | 12 | 18 | 11 | 46 |
| Backend | 3 | 10 | 14 | 10 | 37 |
| **Total** | **8** | **22** | **32** | **21** | **83** |

| Phase | Tasks | Est. Days |
|-------|-------|-----------|
| Phase 1 (Critical) | 8 | 2-3 |
| Phase 2 (High) | 22 | 4-5 |
| Phase 3 (Medium) | 32 | 5-7 |
| Phase 4 (Low) | 21 | 3-4 |
| **Total** | **83** | **14-19** |
