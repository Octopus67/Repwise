# Frontend Bug Bash & Test Gap Analysis

**Date:** 2026-03-25
**Scope:** `/Users/manavmht/Documents/HOS/app` — Repwise React Native (Expo) frontend

---

## 1. Inventory

| Category | Count |
|----------|-------|
| Source files (.ts/.tsx) | 377 |
| Test files | 142 |
| Screens | 50 |
| Components | 180 |
| Utils | 93 |
| Hooks | 26+ |
| Services | 12 |

---

## 2. Contract Mismatches (10 Frontend Fixes Needed)

From `tasks/contract-mismatches.md` — 3 backend fixes already applied, 10 remain:

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **Nutrition log date format** — sends ISO string, backend expects `YYYY-MM-DD` | 🔴 High | Nutrition logging screens |
| 2 | **Training session exercises shape** — nested exercise objects with wrong key names | 🔴 High | Training session submission |
| 3 | **Bodyweight log field naming** — sends `weight`, backend expects `weight_kg` | 🔴 High | `types/measurements.ts:26`, measurement screens |
| 4 | **Profile update sends full object** — backend expects PATCH semantics (changed fields only) | 🟡 Medium | `screens/profile/ProfileScreen.tsx:115` |
| 5 | **Achievement unlock response not handled** — `unlocked_achievements` array ignored in workout completion | 🟡 Medium | Workout completion flow |
| 6 | **Imperial units sent without conversion** — backend expects metric | 🔴 High | Multiple screens (utils/weightStepper.ts has conversion, but not all paths use it) |
| 7 | **Snapshot missing `training_load_score`** — required field omitted | 🔴 High | Snapshot request builder |
| 11 | **Template sharing expects `share_url`** — backend returns `share_code` | 🟡 Medium | `components/sharing/WorkoutShareCard.tsx:52` |
| 12 | **Reaction toggle optimistic update mismatch** — doesn't match backend response shape | 🟡 Medium | `components/social/ReactionButton.tsx:29` |
| 13 | **Follow/unfollow 204 No Content** — frontend expects JSON body on unfollow | 🟡 Medium | Social follow/unfollow flow |

---

## 3. Bug Patterns Found

### 3a. Unchecked `.data.` Access (No Optional Chaining) — 15 instances

These access `.data.` properties without `?.` — will crash if API returns undefined/null:

| File | Line | Code |
|------|------|------|
| `screens/settings/ImportDataScreen.tsx` | 131-132 | `executeMut.data.sessions_imported` / `exercises_created` |
| `screens/training/ExerciseHistoryScreen.tsx` | 68, 72 | `e1rmRes.value.data` / `strengthRes.value.data` |
| `screens/logs/LogsScreen.tsx` | 119, 135-136, 173-174 | `res.data.items`, `res.data.total_count` |
| `screens/coaching/CoachingScreen.tsx` | 58-59 | `reqRes.value.data.items`, `sesRes.value.data.items` |
| `screens/dashboard/DashboardScreen.tsx` | 252 | `data.calories`, `data.protein`, etc. |

### 3b. `as any` Type Escapes — 3 instances

| File | Line | Context |
|------|------|---------|
| `screens/settings/ImportDataScreen.tsx` | 46, 60 | FormData file append (RN limitation — acceptable) |
| `components/common/ModalContainer.tsx` | 113 | `cursor: 'pointer'` style (web compat — acceptable) |

### 3c. Empty Catch Blocks — 10 instances (all intentionally commented)

All empty catches have `// Intentional:` comments explaining why (audio, haptics, photo delete, analytics). These are acceptable fire-and-forget patterns.

### 3d. Console Statements in Production Code

| Area | Count | Severity |
|------|-------|----------|
| Screens | 17 | 🟡 `console.warn` for error logging — acceptable if Sentry is primary |
| Components | 20 | 🟡 Same pattern — `console.warn` for degraded states |
| ErrorBoundary | 3 | ✅ Expected — `console.error` in error boundary |

**Note:** All are `console.warn`/`console.error` (not `console.log`), used for degraded-state logging. No debug `console.log` left in production code. ✅

### 3e. Hardcoded Localhost

| File | Line | Code |
|------|------|------|
| `services/api.ts` | 4 | `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'` |

**Verdict:** Acceptable — env var with dev fallback. ✅

### 3f. Missing Loading States — 5 screens

| Screen | Issue |
|--------|-------|
| `training/WorkoutSummaryScreen.tsx` | No loading indicator |
| `onboarding/steps/TDEERevealStep.tsx` | No loading indicator |
| `onboarding/steps/DietStyleStep.tsx` | No loading indicator |
| `onboarding/steps/BodyMeasurementsStep.tsx` | No loading indicator |
| `onboarding/steps/BodyBasicsStep.tsx` | No loading indicator |

### 3g. Missing Error States — 2 screens

| Screen | Issue |
|--------|-------|
| `onboarding/steps/TDEERevealStep.tsx` | No error handling UI |
| `onboarding/steps/DietStyleStep.tsx` | No error handling UI |

---

## 4. Test Coverage Gaps

### 4a. Coverage Summary

| Layer | Total | Tested | Coverage | Gap |
|-------|-------|--------|----------|-----|
| Screens | 50 | 10* | ~20% | 🔴 40 untested |
| Components | 180 | 37 | ~21% | 🔴 143 untested |
| Utils | 93 | 64 | ~69% | 🟡 29 untested |
| Hooks | 26 | 3 | ~12% | 🔴 23 untested |
| Services | 12 | 1 | ~8% | 🔴 11 untested |
| Store | 6 | 2 | ~33% | 🟡 4 untested |

*Screen tests exist for: ActiveWorkoutUxPolish, DashboardScreen, DataExportScreen, LearnScreen, LogsScreen (x2), NotificationSettingsScreen, ProfileScreen, SessionDetailScreen, WorkoutSummaryScreen

### 4b. Critical Untested Screens

| Screen | Risk | Why |
|--------|------|-----|
| `auth/LoginScreen` | 🔴 | Auth flow — user-facing, security-critical |
| `auth/RegisterScreen` | 🔴 | Auth flow — user-facing, security-critical |
| `training/ActiveWorkoutScreen` | 🔴 | Core feature — most complex screen |
| `nutrition/RecipeBuilderScreen` | 🔴 | Complex form with multi-step flow |
| `onboarding/OnboardingWizard` | 🔴 | First-run experience — 10 sub-steps |
| `social/FeedScreen` | 🟡 | Social feature — pagination, reactions |
| `social/LeaderboardScreen` | 🟡 | Social feature — data enrichment |
| `analytics/AnalyticsScreen` | 🟡 | Complex data visualization |
| `coaching/CoachingScreen` | 🟡 | API-heavy screen |

### 4c. Critical Untested Hooks

| Hook | Risk |
|------|------|
| `useDashboardData` | 🔴 Core data hook — tested indirectly only |
| `useWorkoutSave` | 🔴 Workout persistence — data loss risk |
| `useHealthData` | 🟡 Health integration |
| `useTrial` | 🟡 Premium/trial logic |
| `useRecoveryScore` | 🟡 Coaching feature |

### 4d. Critical Untested Services

| Service | Risk |
|---------|------|
| `api` | 🔴 Core API client — interceptors, auth, retry |
| `networkManager` | 🔴 Offline/online handling |
| `purchases` | 🔴 Revenue — IAP logic |
| `sharing` | 🟡 Share sheet integration |
| `socialAuth` | 🟡 OAuth flows |
| `imageUpload` / `photoUpload` | 🟡 File upload logic |

---

## 5. Priority Recommendations

### P0 — Fix Now (Contract Mismatches Causing API Failures)
1. Fix date format in nutrition logging (Issue #1)
2. Fix training session exercise shape (Issue #2)
3. Fix `weight` → `weight_kg` field naming (Issue #3)
4. Fix imperial → metric conversion on all API paths (Issue #6)
5. Add `training_load_score` to snapshot requests (Issue #7)

### P1 — Fix Soon (Data Integrity / UX)
6. Handle `unlocked_achievements` in workout completion (Issue #5)
7. Fix `share_url` → `share_code` in template sharing (Issue #11)
8. Fix reaction toggle optimistic update shape (Issue #12)
9. Handle 204 No Content on unfollow (Issue #13)
10. Switch profile update to PATCH semantics (Issue #4)

### P2 — Add Safety (Crash Prevention)
11. Add optional chaining to all `.data.` accesses in screens (15 instances)
12. Add loading states to 5 screens missing them
13. Add error states to 2 onboarding steps missing them

### P3 — Test Coverage (Reduce Regression Risk)
14. Add tests for auth screens (Login, Register)
15. Add tests for ActiveWorkoutScreen (core feature)
16. Add tests for `api` service (interceptors, retry, auth refresh)
17. Add tests for `useWorkoutSave` hook
18. Add tests for `networkManager` service
19. Add tests for `purchases` service

---

## 6. Overall Health Assessment

| Metric | Rating | Notes |
|--------|--------|-------|
| Type safety | ✅ Good | Only 3 `as any` (all justified), no `@ts-ignore` |
| Error handling | 🟡 Fair | Most API calls have try/catch, but some screens lack error UI |
| Console hygiene | ✅ Good | No debug `console.log`, only `warn`/`error` for degraded states |
| Test coverage | 🔴 Poor | 20% screens, 21% components, 8% services |
| Contract alignment | 🔴 Poor | 10 mismatches causing silent API failures |
| Loading states | 🟡 Fair | 5 screens missing loading indicators |
| Code quality | ✅ Good | Clean patterns, no TODOs/FIXMEs, intentional catch comments |
