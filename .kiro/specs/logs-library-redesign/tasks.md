# Log Screen Redesign — Revised Implementation Plan

## Pre-flight Checks

### Step 0: Verify baseline
- [-] 0.1: Run `npx jest --passWithNoTests` in `app/` — all existing frontend tests pass (expect 889+)
- [-] 0.2: Run `source .venv/bin/activate && python -m pytest tests/ -x -q` — all backend tests pass (expect 921+)
- [~] 0.3: Verify backend is running: `curl http://localhost:8000/api/v1/health` returns `{"status":"ok"}`
- [~] 0.4: Verify these API endpoints return 200 (with valid JWT): `GET /api/v1/meals/favorites`, `GET /api/v1/training/user-templates`, `GET /api/v1/training/templates`
- [~] 0.5: Git commit current state as baseline: `git add -A && git commit -m "baseline before log-screen-redesign"`

**Risk:** Backend not running or DB not seeded. **Mitigation:** Run `pkill -9 -f uvicorn && source .venv/bin/activate && python -m uvicorn src.main:app --host 0.0.0.0 --port 8000` to restart.

**Rollback:** N/A — this is the baseline.

---

## Phase 1: Pure Logic (no UI dependencies, no imports from React Native)

### Step 1: Create `app/utils/quickRelogLogic.ts`

Create the pure scoring function. Zero React Native imports. Zero API calls.

- [~] 1.1: Define and export `QuickRelogItem` type:
  ```typescript
  export interface QuickRelogItem {
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }
  ```
- [~] 1.2: Define and export `computeQuickRelogItems(recentEntries: NutritionEntry[], favorites: MealFavorite[], maxItems?: number): QuickRelogItem[]`
  - Import `NutritionEntry` from `../utils/mealSlotLogic` (already exists, verified)
  - Define `MealFavorite` interface inline: `{ id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; }`
  - Group entries by `meal_name` (case-insensitive), count frequency per unique name
  - For each unique meal: `score = count × recencyWeight` where `recencyWeight = Math.max(0, 1 - (daysSinceLastLog × 0.07))`
  - Sort by score descending, take top `maxItems` (default 5)
  - If fewer than 3 behavioral items, backfill from `favorites` (skip duplicates by name)
  - Return empty array if both inputs are empty
- [~] 1.3: Handle edge cases: empty arrays, entries with empty `meal_name`, entries with identical names but different macros (keep highest-calorie variant)

**Dependencies:** `app/utils/mealSlotLogic.ts` (exists, verified — exports `NutritionEntry` type)

**Risk:** `NutritionEntry.created_at` is `string | null` — need to parse dates safely. **Mitigation:** Use `entry_date` field (always present, format `YYYY-MM-DD`) for recency calculation instead of `created_at`.

**Rollback:** Delete `app/utils/quickRelogLogic.ts`.

### Step 2: Write tests for `quickRelogLogic`

Create `app/__tests__/utils/quickRelogLogic.test.ts`. Follow the property-based testing pattern from `app/__tests__/utils/mealSlotLogic.test.ts`.

- [~] 2.1: Test: `computeQuickRelogItems([],[], 5)` returns `[]`
- [~] 2.2: Test: With 10 entries for "Oats" and 2 for "Rice", "Oats" ranks first
- [~] 2.3: Test: Entries from 15+ days ago score near zero (recency decay)
- [~] 2.4: Test: When <3 behavioral items, favorites backfill to reach 3 (if available)
- [~] 2.5: Test: Duplicate names between entries and favorites don't produce duplicate items
- [~] 2.6: Test: `maxItems` parameter is respected — never returns more than `maxItems`
- [~] 2.7: Property test (fast-check): output length ≤ maxItems for any input
- [~] 2.8: Property test (fast-check): all returned items have `calories >= 0` and non-empty `name`
- [~] 2.9: Test: Entries with empty `meal_name` are excluded from results

**Dependencies:** Step 1 complete.

**Risk:** fast-check not installed. **Mitigation:** Already in devDependencies (used by `mealSlotLogic.test.ts`).

**Rollback:** Delete `app/__tests__/utils/quickRelogLogic.test.ts`.

---

## ── CHECKPOINT 1 ──
- [ ] Run `npx jest app/__tests__/utils/quickRelogLogic.test.ts` — all tests pass
- [ ] Run `npx jest --passWithNoTests` — full suite still passes (no regressions)
- [ ] **Gate:** Do NOT proceed to Phase 2 until all Step 2 tests are green.

---

## Phase 2: UI Components (independent, parallel-safe — each creates a new file)

### Step 3: Create `app/components/log/CollapsibleSection.tsx`

- [~] 3.1: Props interface:
  ```typescript
  interface CollapsibleSectionProps {
    title: string;
    icon?: React.ReactNode;
    defaultExpanded?: boolean;  // default: true
    children: React.ReactNode;
  }
  ```
- [~] 3.2: Internal state: `const [expanded, setExpanded] = useState(defaultExpanded ?? true)`
- [~] 3.3: Header: `TouchableOpacity` with title, optional icon, chevron text (`▾` when expanded, `▸` when collapsed)
- [~] 3.4: Body: conditionally render `children` when `expanded === true`
- [~] 3.5: Use `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` before `setExpanded` toggle
- [~] 3.6: Style with `colors`, `spacing`, `typography`, `radius` from `../../theme/tokens`

**Dependencies:** None (new file, only imports theme tokens).

**Risk:** `LayoutAnimation` requires `UIManager.setLayoutAnimationEnabledExperimental(true)` on Android. **Mitigation:** This is a web-first app (Expo web). LayoutAnimation works on web. Add Android guard only if needed later.

**Rollback:** Delete `app/components/log/CollapsibleSection.tsx`.

### Step 4: Create `app/components/log/QuickRelogRow.tsx`

- [~] 4.1: Props interface:
  ```typescript
  interface QuickRelogRowProps {
    items: QuickRelogItem[];  // from '../../utils/quickRelogLogic'
    onTapItem: (item: QuickRelogItem) => void;
    loading?: boolean;
  }
  ```
- [~] 4.2: If `items.length === 0 && !loading`, return `null` (hidden entirely — Req 1 AC7)
- [~] 4.3: If `loading`, render 3 `Skeleton` components (width 100, height 44, borderRadius 8)
- [~] 4.4: Section label: `Text` with "⚡ Quick Re-log" styled as section header
- [~] 4.5: Horizontal `ScrollView` with `horizontal={true}`, `showsHorizontalScrollIndicator={false}`
- [~] 4.6: Each chip: `TouchableOpacity` with food name (truncated to 12 chars via `name.slice(0, 12)`) and calorie badge (`Math.round(item.calories) + ' cal'`)
- [~] 4.7: Chip styling: `backgroundColor: colors.bg.surfaceRaised`, `borderRadius: radius.sm`, `paddingHorizontal: spacing[3]`, `paddingVertical: spacing[2]`

**Dependencies:** Step 1 (`QuickRelogItem` type), `Skeleton` component (exists at `app/components/common/Skeleton.tsx`).

**Risk:** `QuickRelogItem` type not exported correctly. **Mitigation:** Step 1 explicitly exports it.

**Rollback:** Delete `app/components/log/QuickRelogRow.tsx`.

### Step 5: Create `app/components/log/StartWorkoutCard.tsx`

- [~] 5.1: Props interface:
  ```typescript
  interface StartWorkoutCardProps {
    userTemplates: WorkoutTemplateResponse[];  // from '../../types/training'
    staticTemplates: Array<{ id: string; name: string; description: string; exercises: any[] }>;
    onStartEmpty: () => void;
    onStartTemplate: (templateId: string) => void;
  }
  ```
- [~] 5.2: Main card with accent background, "🏋️ Start Workout" title
- [ ] 5.3: Two buttons side by side: "Empty Workout" (calls `onStartEmpty`) and "From Template" (toggles template picker)
- [ ] 5.4: Template picker: `useState<boolean>` toggle. When open, show vertical list of user templates first (with "My Templates" subheader), then static templates (with "Pre-built" subheader). Each row: template name + exercise count + tap handler calling `onStartTemplate(template.id)`
- [ ] 5.5: If `userTemplates.length === 0 && staticTemplates.length === 0`, hide "From Template" button entirely — show only "Start Workout" as single full-width button
- [ ] 5.6: Close template picker when a template is selected

**Dependencies:** `WorkoutTemplateResponse` from `app/types/training.ts` (exists, verified — has `id`, `name`, `exercises` fields).

**Risk:** Static templates from `GET /training/templates` return `{ id, name, description, exercises }` (not `WorkoutTemplateResponse` — they lack `user_id`, `is_system`, etc.). **Mitigation:** Use separate type for static templates in props (already done in 5.1 with `Array<{ id: string; name: string; ... }>`).

**Rollback:** Delete `app/components/log/StartWorkoutCard.tsx`.

### Step 6: Create `app/components/log/TemplateRow.tsx`

- [ ] 6.1: Props interface:
  ```typescript
  interface TemplateRowProps {
    name: string;
    exerciseCount: number;
    onStart: () => void;
  }
  ```
- [ ] 6.2: Horizontal row: template name (flex 1), exercise count badge (e.g., "5 exercises"), "Start" button
- [ ] 6.3: "Start" button: `TouchableOpacity` with accent color, calls `onStart`
- [ ] 6.4: Card styling consistent with `app/components/common/Card.tsx` pattern

**Dependencies:** None (new file, only imports theme tokens).

**Rollback:** Delete `app/components/log/TemplateRow.tsx`.

### Step 7: Write tests for new UI components

Create `app/__tests__/components/LogComponents.test.ts` — data-assertion tests (no React rendering, matching the pattern in `BottomTabNavigator.test.tsx`).

- [ ] 7.1: Test `CollapsibleSection` props interface: verify `defaultExpanded` defaults to `true`
- [ ] 7.2: Test `QuickRelogRow` hides when items is empty (verify the component contract)
- [ ] 7.3: Test `StartWorkoutCard` hides "From Template" when both template arrays are empty
- [ ] 7.4: Test `TemplateRow` renders exercise count correctly
- [ ] 7.5: Test that `QuickRelogItem` type matches the shape returned by `computeQuickRelogItems`

**Dependencies:** Steps 3–6 complete.

**Risk:** Cannot render React Native components in Jest without mocking. **Mitigation:** Use data-assertion tests (verify prop shapes, type contracts, logic branches) — same pattern as existing `BottomTabNavigator.test.tsx`.

**Rollback:** Delete `app/__tests__/components/LogComponents.test.ts`.

---

## ── CHECKPOINT 2 ──
- [ ] Run `npx jest app/__tests__/components/LogComponents.test.ts` — all tests pass
- [ ] Run `npx jest --passWithNoTests` — full suite still passes
- [ ] Verify no TypeScript errors: `npx tsc --noEmit` (or use getDiagnostics on new files)
- [ ] **Gate:** Do NOT proceed to Phase 3 until all new component files compile and tests pass.

---

## Phase 3: LogsScreen Rewrite (sequential — single file modification)

### Step 8: Rewrite LogsScreen — Nutrition tab

Rewrite `app/screens/logs/LogsScreen.tsx`. This is the highest-risk step. The file goes from ~350 lines to ~450 lines.

- [ ] 8.1: Add new imports at top of file:
  ```typescript
  import { QuickRelogRow } from '../../components/log/QuickRelogRow';
  import { CollapsibleSection } from '../../components/log/CollapsibleSection';
  import { computeQuickRelogItems, QuickRelogItem } from '../../utils/quickRelogLogic';
  import { groupEntriesBySlot } from '../../utils/mealSlotLogic';
  import { MealSlotGroup } from '../../components/dashboard/MealSlotGroup';
  ```
- [ ] 8.2: Add new state variables:
  ```typescript
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<NutritionEntry[]>([]);
  const [quickRelogItems, setQuickRelogItems] = useState<QuickRelogItem[]>([]);
  const [quickRelogLoading, setQuickRelogLoading] = useState(true);
  ```
- [ ] 8.3: Add data fetching for favorites and 14-day entries in `loadData`:
  ```typescript
  // Inside loadData callback:
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const recentStart = fourteenDaysAgo.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [nutritionRes, trainingRes, favoritesRes, recentRes] = await Promise.allSettled([
    loadNutritionData(),
    loadTrainingPage(1, true),
    api.get('meals/favorites', { params: { limit: 10 } }),
    api.get('nutrition/entries', { params: { start_date: recentStart, end_date: today, limit: 200 } }),
  ]);

  if (favoritesRes.status === 'fulfilled') setFavorites(favoritesRes.value.data.items ?? []);
  if (recentRes.status === 'fulfilled') setRecentEntries(recentRes.value.data.items ?? []);
  ```
- [ ] 8.4: Compute Quick Re-log items after data loads:
  ```typescript
  useEffect(() => {
    const items = computeQuickRelogItems(recentEntries, favorites, 5);
    setQuickRelogItems(items);
    setQuickRelogLoading(false);
  }, [recentEntries, favorites]);
  ```
- [ ] 8.5: Replace nutrition tab content. Remove the flat `groupedNutrition` rendering. Replace with:
  1. `QuickRelogRow` at top (items from state, onTapItem opens AddNutritionModal pre-filled)
  2. `BudgetBar` (unchanged)
  3. `groupEntriesBySlot(todayEntries)` → map to `MealSlotGroup` components
  4. `CollapsibleSection` wrapping favorites list (collapsed if quickRelogItems.length >= 3)
  5. `CopyMealsBar` at bottom (moved from top)
- [ ] 8.6: Wire `MealSlotGroup.onAddToSlot`: when user taps "+" on a slot, set a `prefilledMealName` state to the slot name (e.g., "Breakfast"), then open `AddNutritionModal` with `prefilledMealName` prop
- [ ] 8.7: Wire `QuickRelogRow.onTapItem`: set `prefilledMealName` to `item.name`, open `AddNutritionModal`
- [ ] 8.8: Verify `AddNutritionModal` accepts `prefilledMealName?: string` prop (confirmed — it does)
- [ ] 8.9: Preserve: date navigator, FAB button, swipe-to-delete (SwipeableRow on entries inside MealSlotGroup), pull-to-refresh, loading skeletons
- [ ] 8.10: Preserve: `todayEntries` computation for BudgetBar consumed totals

**Dependencies:** Steps 1, 3, 4 complete. `MealSlotGroup` exists at `app/components/dashboard/MealSlotGroup.tsx` (verified — props: `slot: MealSlotData`, `onAddToSlot: (slotName: MealSlotName) => void`). `groupEntriesBySlot` exists in `app/utils/mealSlotLogic.ts` (verified).

**Critical Risk:** `MealSlotGroup` currently renders entries with `entry.meal_name` and `entry.created_at` but does NOT have swipe-to-delete. Swipe-to-delete is currently in `LogsScreen` via `SwipeableRow` wrapping each entry card. **Mitigation:** Either (a) add `onDeleteEntry` prop to `MealSlotGroup` and wrap entries in `SwipeableRow` inside it, or (b) don't reuse `MealSlotGroup` and instead inline the meal-slot rendering in `LogsScreen` with `SwipeableRow`. Option (b) is safer for v1 — avoids modifying a component used by Dashboard.

**Decision:** Use option (b) — inline meal-slot rendering in LogsScreen. Do NOT modify `MealSlotGroup` to avoid Dashboard regression risk.

**Rollback:** `git checkout -- app/screens/logs/LogsScreen.tsx` to restore previous version.

### Step 9: Rewrite LogsScreen — Training tab

Continue modifying `app/screens/logs/LogsScreen.tsx`.

- [ ] 9.1: Add new imports:
  ```typescript
  import { StartWorkoutCard } from '../../components/log/StartWorkoutCard';
  import { TemplateRow } from '../../components/log/TemplateRow';
  import type { WorkoutTemplateResponse } from '../../types/training';
  ```
- [ ] 9.2: Add new state variables:
  ```typescript
  const [userTemplates, setUserTemplates] = useState<WorkoutTemplateResponse[]>([]);
  const [staticTemplates, setStaticTemplates] = useState<any[]>([]);
  ```
- [ ] 9.3: Add data fetching in `loadData`:
  ```typescript
  const [userTemplatesRes, staticTemplatesRes] = await Promise.allSettled([
    api.get('training/user-templates'),
    api.get('training/templates'),
  ]);
  if (userTemplatesRes.status === 'fulfilled') setUserTemplates(userTemplatesRes.value.data ?? []);
  if (staticTemplatesRes.status === 'fulfilled') setStaticTemplates(staticTemplatesRes.value.data ?? []);
  ```
- [ ] 9.4: Replace training tab content. New layout (top to bottom):
  1. `StartWorkoutCard` — `onStartEmpty` navigates to `ActiveWorkout { mode: 'new' }` (or opens `AddTrainingModal` if feature flag off), `onStartTemplate` navigates to `ActiveWorkout { mode: 'template', templateId }`
  2. `CollapsibleSection "My Templates"` — hidden if `userTemplates.length === 0`. Inside: `TemplateRow` for each user template. "Browse all templates →" text link at bottom.
  3. Existing session history `FlatList` — preserve `groupedTraining`, `renderTrainingGroup`, `loadMoreTraining`, `trainingListFooter`, swipe-to-delete, PR stars, SessionDetail navigation
- [ ] 9.5: Wire `StartWorkoutCard.onStartEmpty`:
  ```typescript
  if (isTrainingLogV2Enabled()) {
    navigation.push('ActiveWorkout', { mode: 'new' });
  } else {
    setShowTrainingModal(true);
  }
  ```
- [ ] 9.6: Wire `StartWorkoutCard.onStartTemplate`:
  ```typescript
  navigation.push('ActiveWorkout', { mode: 'template', templateId });
  ```
- [ ] 9.7: Preserve: infinite scroll pagination, swipe-to-delete on sessions, PR star indicators, SessionDetail navigation on tap, FAB button

**Dependencies:** Steps 5, 6 complete. `ActiveWorkoutScreenParams` supports `mode: 'template'` and `templateId` (verified in `app/types/training.ts`).

**Risk:** `GET /training/user-templates` returns `UserWorkoutTemplateResponse[]` (different from `WorkoutTemplateResponse`). **Mitigation:** Check the actual response shape. The `UserWorkoutTemplateResponse` schema in `src/modules/training/schemas.py` likely has the same fields. Use `any[]` for user templates if types diverge, or define a union type.

**Rollback:** `git checkout -- app/screens/logs/LogsScreen.tsx` to restore previous version.

### Step 10: Write integration tests for LogsScreen

Create `app/__tests__/screens/LogsScreen.test.tsx` — data-assertion and contract tests.

- [ ] 10.1: Test: `computeQuickRelogItems` integration — given mock nutrition entries and favorites, verify correct items are computed
- [ ] 10.2: Test: `groupEntriesBySlot` integration — given mock entries with "Breakfast oats" and "Lunch chicken", verify they land in correct slots
- [ ] 10.3: Test: Quick Re-log → AddNutritionModal contract — verify `QuickRelogItem` shape is compatible with `AddNutritionModal.prefilledMealName` prop
- [ ] 10.4: Test: StartWorkoutCard → ActiveWorkout contract — verify `{ mode: 'template', templateId: string }` matches `ActiveWorkoutScreenParams`
- [ ] 10.5: Test: Feature flag behavior — when `isTrainingLogV2Enabled()` returns false, "Start Workout" should trigger modal (not navigation)
- [ ] 10.6: Test: Empty state — when no entries, no favorites, no templates, verify Quick Re-log is hidden, meal slots show "+" prompts, templates section is hidden

**Dependencies:** Steps 8, 9 complete.

**Rollback:** Delete `app/__tests__/screens/LogsScreen.test.tsx`.

---

## ── CHECKPOINT 3 (FINAL) ──
- [ ] Run `npx jest app/__tests__/utils/quickRelogLogic.test.ts` — pass
- [ ] Run `npx jest app/__tests__/components/LogComponents.test.ts` — pass
- [ ] Run `npx jest app/__tests__/screens/LogsScreen.test.tsx` — pass
- [ ] Run `npx jest --passWithNoTests` — full suite passes, no regressions
- [ ] Run `source .venv/bin/activate && python -m pytest tests/ -x -q` — backend tests pass (no backend changes, but verify no breakage)
- [ ] Manual verification on `http://localhost:8081`:
  - [ ] Nutrition tab: Quick Re-log row visible (if user has history), BudgetBar, 4 meal slots, Favorites section, CopyMealsBar at bottom
  - [ ] Training tab: Start Workout card at top, My Templates (if any), session history with infinite scroll
  - [ ] Date navigator works (‹ ›)
  - [ ] FAB (+) button works on both tabs
  - [ ] Swipe-to-delete works on nutrition entries and training sessions
  - [ ] "Start Workout" → ActiveWorkout navigation works
  - [ ] Template → ActiveWorkout navigation works
- [ ] **Gate:** Do NOT ship until all automated tests pass AND manual verification complete.

---

## Post-Ship

### Step 11: Git commit and push

- [ ] 11.1: `git add -A && git commit -m "feat: redesign Log screen — Quick Re-log, meal slots, Start Workout hero"`
- [ ] 11.2: `git push origin main`

---

## Monitoring (Post-Launch)

| Signal | What to Watch | Alert Threshold |
|--------|--------------|-----------------|
| API errors | `GET /meals/favorites` and `GET /training/user-templates` 4xx/5xx rates | >5% error rate over 5 min |
| Render crashes | JavaScript errors on LogsScreen mount | Any unhandled exception |
| Quick Re-log empty | % of users seeing empty Quick Re-log row | >80% after 7 days (means algorithm isn't surfacing items) |
| Nutrition logging rate | Daily nutrition entries per active user | Drop >10% week-over-week |
| Workout start rate | Workouts started from Log tab per active user | Drop >10% week-over-week |
| API latency | P99 latency for the 4 API calls on screen mount | >2s P99 |

---

## Rollback Plan

| If this fails... | Do this... |
|-------------------|-----------|
| Step 1 (quickRelogLogic) | Delete `app/utils/quickRelogLogic.ts` |
| Steps 3–6 (new components) | Delete `app/components/log/` directory |
| Steps 8–9 (LogsScreen rewrite) | `git checkout -- app/screens/logs/LogsScreen.tsx` |
| Full rollback | `git revert HEAD` (reverts the commit from Step 11) |
| Partial rollback (keep components, revert screen) | `git checkout HEAD~1 -- app/screens/logs/LogsScreen.tsx` |

---

## Dependency Graph

```
Step 0 (baseline)
  │
  ├── Step 1 (quickRelogLogic.ts) ──→ Step 2 (tests)
  │                                        │
  │   ┌── Step 3 (CollapsibleSection) ─────┤
  │   ├── Step 4 (QuickRelogRow) ──────────┤  (depends on Step 1 for type)
  │   ├── Step 5 (StartWorkoutCard) ───────┤
  │   └── Step 6 (TemplateRow) ────────────┤
  │                                        │
  │                              Step 7 (component tests)
  │                                        │
  │                              ── CHECKPOINT 2 ──
  │                                        │
  │                              Step 8 (Nutrition tab rewrite)
  │                                        │
  │                              Step 9 (Training tab rewrite)
  │                                        │
  │                              Step 10 (integration tests)
  │                                        │
  │                              ── CHECKPOINT 3 ──
  │                                        │
  └──────────────────────────────Step 11 (commit + push)
```

Steps 3, 5, 6 are fully parallel (no shared dependencies).
Step 4 depends on Step 1 (imports `QuickRelogItem` type).
Steps 8–9 are sequential (same file).
Step 10 depends on Steps 8–9.

No circular dependencies detected.

---

## What Was Cut (and Why)

| Original Item | Why Cut |
|--------------|---------|
| Tab rename "Log" → "Library" | Competitive analysis showed every competitor uses "Log"/"Diary". Renaming breaks muscle memory. |
| BottomTabNavigator.tsx changes | No tab rename = no nav changes needed. Eliminates risk of breaking 4+ test files. |
| Separate "Recent Workouts" section | Redundant with session history. Same data, arbitrary cutoff. Cut to reduce sections from 4 to 3 on training tab. |
| "Browse all templates" full screen | Premature for v1. Template picker inside StartWorkoutCard is sufficient. Can add later. |
| Reusing `MealSlotGroup` from Dashboard | MealSlotGroup lacks swipe-to-delete. Modifying it risks Dashboard regression. Inline meal-slot rendering is safer for v1. |
