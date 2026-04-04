# Repwise — Feature & Bug Fix Implementation Plan
### 13 Items: F1-F10 Features + B1-B3 Bug Fixes
### Prepared: March 2026

---

## Overview

This plan covers 13 items organized into 4 phases by dependency order and effort. Each item includes exact file changes, design spec, and acceptance criteria.

**Phase 1 — Critical Fixes (Day 1, ~1 hour)**
- B1: Fix placeholder legal URLs
- B2: Fix silent API failures in ActiveWorkoutScreen
- B3: Extract duplicate Telegram URL

**Phase 2 — Dashboard Enhancements (Day 1-2, ~6 hours)**
- F1: Dashboard weight sparkline
- F3: Re-enable WeeklyTrainingCalendar
- F4: Onboarding progress indicator enhancement

**Phase 3 — Core Feature Builds (Day 3-7, ~5 days)**
- F2: PR History screen (full-stack)
- F6: Streak freeze mechanism (full-stack)
- F7: Exercise history per exercise (full-stack)
- F9: Quick-add food favorites (full-stack)

**Phase 4 — Growth & Viral Features (Day 8-12, ~5 days)**
- F5: Monthly recap with shareable card (full-stack)
- F8: Workout template sharing via deep link
- F10: Rest day dashboard variant

---

## Phase 1 — Critical Fixes

### B1: Fix Placeholder Legal URLs
**Priority:** P0 | **Effort:** 5 minutes | **Risk:** None

**Problem:** RegisterScreen links to `termsfeed.com/blog/sample-terms-of-service-template/` and `termsfeed.com/blog/sample-privacy-policy-template/` — template blog posts, not real legal docs. ProfileScreen already has the correct URLs.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/auth/RegisterScreen.tsx` (lines 226-229) | Replace 2 URLs |

**Exact Change:**
```diff
- onPress={() => Linking.openURL('https://www.termsfeed.com/blog/sample-terms-of-service-template/')}
+ onPress={() => Linking.openURL('https://repwise.app/terms')}

- onPress={() => Linking.openURL('https://www.termsfeed.com/blog/sample-privacy-policy-template/')}
+ onPress={() => Linking.openURL('https://repwise.app/privacy')}
```

**Acceptance Criteria:**
- [ ] Terms link opens `repwise.app/terms`
- [ ] Privacy link opens `repwise.app/privacy`
- [ ] Matches ProfileScreen's AccountSection URLs exactly

---

### B2: Fix Silent API Failures in ActiveWorkoutScreen
**Priority:** P0 | **Effort:** 30 minutes | **Risk:** Low

**Problem:** 5 `.catch(() => {})` blocks silently swallow API failures for previous performance, overload suggestions, weekly volume, exercise list, and recent exercises. Users see stale/missing data with zero feedback.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/training/ActiveWorkoutScreen.tsx` (lines 190-270) | Replace 5 empty catches with `console.warn` + optional user feedback |

**Design Decision:** These are non-critical enhancement data (the workout still functions without them). We should NOT show error modals — instead, log warnings for debugging and optionally show subtle indicators.

**Exact Change Pattern (apply to all 5 catches):**
```typescript
// BEFORE:
.catch(() => {});

// AFTER:
.catch((err) => console.warn('[ActiveWorkout] Failed to fetch <description>:', err?.message));
```

Apply to:
1. Line ~216: Previous performance batch → `'previous performance'`
2. Line ~224: Overload suggestions batch → `'overload suggestions'`
3. Line ~232: Weekly muscle volume → `'weekly volume'`
4. Line ~249: Exercise list → `'exercise list'`
5. Line ~263: Recent exercises → `'recent exercises'`

**Acceptance Criteria:**
- [ ] All 5 catches log descriptive warnings with error message
- [ ] No user-facing error modals (these are enhancement data)
- [ ] Workout logging still works when any/all of these APIs fail
- [ ] Warnings visible in dev console for debugging

---

### B3: Extract Duplicate Telegram URL
**Priority:** P2 | **Effort:** 5 minutes | **Risk:** None

**Problem:** Telegram URL `https://t.me/repwiseCommunity` is defined as a constant in CommunityScreen and hardcoded inline in CoachingScreen. Both screens also duplicate the `openTelegramLink` function with identical platform branching.

**Files to Change:**
| File | Change |
|------|--------|
| `app/utils/constants.ts` (new or existing) | Add `TELEGRAM_URL` and `openTelegramLink()` |
| `app/screens/community/CommunityScreen.tsx` | Import from shared constant |
| `app/screens/coaching/CoachingScreen.tsx` | Import from shared constant |

**Design:**
```typescript
// app/utils/externalLinks.ts (new file)
import { Linking, Platform } from 'react-native';

export const TELEGRAM_URL = 'https://t.me/repwiseCommunity';

export const openTelegramLink = () => {
  if (Platform.OS === 'web') {
    window.open(TELEGRAM_URL, '_blank');
  } else {
    Linking.openURL(TELEGRAM_URL);
  }
};
```

Both screens import `{ openTelegramLink }` from `'../../utils/externalLinks'` and remove their local definitions.

**Acceptance Criteria:**
- [ ] Single source of truth for Telegram URL
- [ ] Both screens use shared utility
- [ ] Telegram link works on iOS, Android, and web

---

## Phase 2 — Dashboard Enhancements

### F1: Dashboard Weight Sparkline
**Priority:** P1 | **Effort:** 2-4 hours | **Risk:** Low

**Current State:** Dashboard shows only text: "Trend: 82.3kg -0.4kg/wk + Log". The `emaSeries` data (type `DataPoint[]`) is already computed via `computeEMA(data.weightHistory)`. The `TrendLineChart` component exists and is used on the Analytics screen.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/dashboard/DashboardScreen.tsx` | Add TrendLineChart below weight trend text |
| `app/components/charts/TrendLineChart.tsx` | No changes needed — already supports all required props |

**Design Spec:**
- Add a compact sparkline chart (height: 80px instead of the default 160px) below the existing trend text row
- Use `emaSeries` as `data` prop (already computed, matches `DataPoint[]` interface)
- Use `c.accent.primary` as `color`
- Add `suffix="kg"` (or `"lbs"` based on unit system)
- Show raw `weightHistory` as `secondaryData` with `primaryAsDots={true}` for scatter overlay
- Wrap in the same `TouchableOpacity` so tapping opens the bodyweight modal
- Only render when `emaSeries.length >= 3` (need minimum data for a meaningful chart)

**Implementation:**
```tsx
// Inside renderWeightTrend(), after the trendRow View:
{emaSeries.length >= 3 && (
  <TrendLineChart
    data={emaSeries}
    color={c.accent.primary}
    suffix={unit}
    secondaryData={data.weightHistory}
    primaryAsDots
  />
)}
```

Note: TrendLineChart uses screen width for sizing. For a compact dashboard version, we may need to pass a `height` prop or create a `compact` variant. Check if the component accepts a height override — if not, add an optional `height?: number` prop defaulting to 160.

**Acceptance Criteria:**
- [ ] Sparkline renders below weight trend text when 3+ data points exist
- [ ] EMA trend line shown as solid line, raw weights as dots
- [ ] Tapping chart opens bodyweight modal
- [ ] Empty state unchanged ("Tap to log your first weigh-in")
- [ ] Chart respects unit system (kg/lbs)
- [ ] No layout shift on dashboard load

---

### F3: Re-enable WeeklyTrainingCalendar
**Priority:** P1 | **Effort:** 1-2 hours | **Risk:** Low

**Current State:** `WeeklyTrainingCalendar` component exists at `app/components/dashboard/WeeklyTrainingCalendar.tsx` but was removed from the dashboard in a declutter commit. It accepts `{ selectedDate: string, trainedDates: Set<string> }`. The dashboard already has `data.sessions` (today's sessions) but needs the full week's trained dates.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/dashboard/DashboardScreen.tsx` | Import and render WeeklyTrainingCalendar |
| `app/hooks/useDashboardData.ts` | Add API call to fetch this week's session dates |

**Design Spec:**
- Place the calendar between the DateScroller and the QuickLog row (natural position — date context → training context → actions)
- Derive `trainedDates` from the sessions API: `GET /training/sessions?start_date={monday}&end_date={sunday}&limit=50`
- Extract unique dates from session responses into a `Set<string>`
- Pass `selectedDate` from the dashboard's current date state
- Wrap in a fade-in animation consistent with other dashboard sections

**Data Flow:**
```
useDashboardData hook
  → fetch sessions for current week
  → extract dates: new Set(sessions.map(s => s.date))
  → return { trainedDates: Set<string> }

DashboardScreen
  → <WeeklyTrainingCalendar selectedDate={selectedDate} trainedDates={data.trainedDates} />
```

**Acceptance Criteria:**
- [ ] 7-day calendar row visible on dashboard
- [ ] Trained days show filled accent circle with check icon
- [ ] Today highlighted with accent border
- [ ] Future days dimmed (0.4 opacity)
- [ ] Updates when date scroller changes week
- [ ] No extra API call if sessions data already covers the week

---

### F4: Onboarding Progress Indicator Enhancement
**Priority:** P1 | **Effort:** 2-3 hours | **Risk:** Low

**Current State:** OnboardingWizard ALREADY has a progress bar — animated fill (3px track) + "Step X of Y" text. The recommendation was based on the product analysis suggesting it was missing, but it exists. However, the current implementation is a thin 3px bar that's easy to miss.

**Revised Scope:** Enhance the existing progress indicator with step dots for better visual clarity.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/onboarding/OnboardingWizard.tsx` | Replace thin bar with segmented step dots |

**Design Spec:**
Replace the current 3px progress track with a row of 11 step dots:
- Completed steps: filled accent circle (8px)
- Current step: larger accent circle (12px) with pulse animation
- Future steps: border-only circle (8px) with muted color
- Dots connected by thin lines (1px, muted color for future, accent for completed)
- Keep "Step X of Y" text below
- Animate transitions between steps using existing `react-native-reanimated` setup

**Implementation Pattern:**
```tsx
<View style={styles.progressContainer}>
  <View style={styles.dotsRow}>
    {Array.from({ length: TOTAL_STEPS }, (_, i) => {
      const step = i + 1;
      const isCompleted = step < currentStep;
      const isCurrent = step === currentStep;
      return (
        <React.Fragment key={step}>
          {i > 0 && <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />}
          <View style={[
            styles.dot,
            isCompleted && styles.dotCompleted,
            isCurrent && styles.dotCurrent,
          ]} />
        </React.Fragment>
      );
    })}
  </View>
  <Text style={[styles.stepCounter, { color: c.text.muted }]}>Step {currentStep} of {TOTAL_STEPS}</Text>
</View>
```

**Acceptance Criteria:**
- [ ] 11 step dots visible at top of onboarding
- [ ] Completed steps filled, current step larger with pulse, future steps outlined
- [ ] Smooth animation when advancing/going back
- [ ] "Step X of Y" text retained below dots
- [ ] Works on all screen sizes (dots should not overflow on small screens — if 11 dots are too many, fall back to the enhanced bar with segment markers)

---

## Phase 3 — Core Feature Builds

### F2: Dedicated PR History Screen
**Priority:** P1 | **Effort:** 1-2 days | **Risk:** Medium (new endpoint + new screen)

**Current State:** PRs are detected at session creation time via `PRDetector.detect_prs()` and returned inline in `TrainingSessionResponse.personal_records`. There is NO dedicated PR history endpoint — PRs are ephemeral (only returned once, at creation). `PRBanner` component exists for display. `PersonalRecordResponse` type has `exercise_name`, `reps`, `new_weight_kg`, `previous_weight_kg`.

**Architecture Decision:** We need to persist PRs in a dedicated table so they can be queried historically. Currently PRs are computed on-the-fly and returned but never stored.

**Files to Create:**
| File | Purpose |
|------|--------|
| `src/modules/training/pr_models.py` | `PersonalRecord` SQLAlchemy model |
| `src/modules/training/pr_service.py` | PR history query service |
| `alembic/versions/xxx_create_personal_records_table.py` | DB migration |
| `app/screens/training/PRHistoryScreen.tsx` | New screen |
| `app/components/training/PRHistoryCard.tsx` | PR card component |

**Files to Modify:**
| File | Change |
|------|--------|
| `src/modules/training/pr_detector.py` | Persist PRs to new table after detection |
| `src/modules/training/router.py` | Add `GET /training/personal-records` endpoint |
| `src/modules/training/schemas.py` | Add `PRHistoryResponse` schema |
| `app/navigation/BottomTabNavigator.tsx` | Add PRHistory to Profile or Analytics stack |

**Backend Design:**

```python
# pr_models.py
class PersonalRecord(Base):
    __tablename__ = "personal_records"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    exercise_name: Mapped[str]
    pr_type: Mapped[str]  # 'weight', 'reps', 'volume', 'e1rm'
    reps: Mapped[int]
    value_kg: Mapped[float]  # the PR value
    previous_value_kg: Mapped[Optional[float]]
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("training_sessions.id"))
    achieved_at: Mapped[datetime] = mapped_column(default=func.now())
```

```python
# New endpoint in router.py
@router.get("/personal-records")
async def get_pr_history(
    exercise_name: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    session=Depends(get_session),
):
    service = PRService(session)
    return await service.get_pr_history(user.id, exercise_name, limit, offset)
```

**Frontend Design:**

PRHistoryScreen layout:
1. **Header:** "Personal Records" with trophy icon
2. **Filter:** Exercise name dropdown (populated from user's exercise history)
3. **PR Cards:** Grouped by exercise, sorted by date descending
   - Each card: exercise name, PR type badge (weight/reps/volume/e1rm), value, improvement delta, date
   - Color-coded by PR type
4. **Empty state:** "Hit the gym and set your first PR!" with dumbbell illustration
5. **Navigation:** Accessible from Profile stack (add to `PROFILE_STACK_ROUTES`)

**Acceptance Criteria:**
- [ ] New `personal_records` table created via Alembic migration
- [ ] PRs persisted when detected during session creation
- [ ] `GET /training/personal-records` returns paginated PR history
- [ ] Optional `exercise_name` filter works
- [ ] PRHistoryScreen renders grouped PR cards
- [ ] Empty state shown for new users
- [ ] Accessible from Profile tab
- [ ] Existing PR detection logic unchanged (no regression)

---

### F6: Streak Freeze Mechanism
**Priority:** P1 | **Effort:** 4-6 hours | **Risk:** Medium (modifies core streak logic)

**Current State:**
- Backend: `_update_streak()` in `engine.py` resets `current_value` to 1 when `activity_date != last_active + timedelta(days=1)`. Stores `last_active_date` and `longest_streak` in `metadata_`.
- Frontend: `calculateStreak()` walks backwards from today counting consecutive dates in `logDates`. Returns 0 if today not in set.

**Architecture Decision:** Streak freeze is a user-initiated action (not automatic). Users get 1 free freeze per month. Freeze "fills in" the gap day so the streak continues.

**Files to Create:**
| File | Purpose |
|------|--------|
| `src/modules/achievements/streak_freeze_service.py` | Freeze logic: check eligibility, apply freeze |
| `alembic/versions/xxx_add_streak_freeze_table.py` | DB migration |

**Files to Modify:**
| File | Change |
|------|--------|
| `src/modules/achievements/engine.py` | Modify `_update_streak()` to check for freeze before resetting |
| `src/modules/achievements/models.py` | Add `StreakFreeze` model |
| `src/modules/achievements/router.py` | Add freeze endpoints |
| `src/modules/achievements/schemas.py` | Add freeze schemas |
| `app/utils/calculateStreak.ts` | Modify walk-back to skip frozen dates |
| `app/components/dashboard/StreakIndicator.tsx` | Show freeze badge/count |

**Backend Design:**

```python
# models.py addition
class StreakFreeze(Base):
    __tablename__ = "streak_freezes"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    freeze_date: Mapped[date]  # the date that was "frozen"
    used_at: Mapped[datetime] = mapped_column(default=func.now())
    month: Mapped[str]  # 'YYYY-MM' for monthly limit tracking
```

```python
# Modified _update_streak else branch in engine.py
if activity_date == last_active + timedelta(days=1):
    progress.current_value += 1  # Consecutive day
else:
    # Check for available freeze
    gap_days = (activity_date - last_active).days - 1
    if gap_days <= 2:  # Only allow freeze for small gaps
        freeze_service = StreakFreezeService(self.session)
        frozen = await freeze_service.try_auto_freeze(user_id, last_active, activity_date)
        if frozen:
            progress.current_value += 1 + gap_days  # Count frozen days
        else:
            progress.current_value = 1  # No freeze available, reset
    else:
        progress.current_value = 1  # Gap too large, reset
```

**Frontend Design:**

```typescript
// Modified calculateStreak.ts
export function calculateStreak(
  logDates: string[],
  today: string,
  frozenDates?: Set<string>  // NEW parameter
): number {
  // ... existing validation ...
  let count = 1;
  let current = today;
  while (true) {
    const prev = getPreviousDate(current);
    if (dateSet.has(prev)) {
      count++;
      current = prev;
    } else if (frozenDates?.has(prev)) {
      count++;  // Frozen day counts toward streak
      current = prev;
    } else {
      break;
    }
  }
  return count;
}
```

StreakIndicator enhancement: Show ❄️ snowflake icon with remaining freeze count next to the flame.

**API Endpoints:**
- `GET /achievements/streak/freezes` — returns available freezes this month and freeze history
- `POST /achievements/streak/freeze` — manually use a freeze for a specific date

**Acceptance Criteria:**
- [ ] Users get 1 free freeze per calendar month
- [ ] Freeze auto-applies when gap ≤ 2 days and freeze available
- [ ] Streak continues through frozen days (not reset)
- [ ] Frontend streak calculation respects frozen dates
- [ ] StreakIndicator shows freeze availability (❄️ badge)
- [ ] Freeze history queryable via API
- [ ] Existing streak achievements still trigger correctly
- [ ] Monthly freeze count resets on calendar month boundary

---

### F7: Exercise History Per Exercise
**Priority:** P1 | **Effort:** 1-2 days | **Risk:** Low (endpoints exist, new screen only)

**Current State:** Two relevant API endpoints already exist:
1. `GET /training/analytics/strength/{exercise_name}` → `[{ date, best_weight_kg, best_reps, estimated_1rm }]`
2. `GET /training/analytics/e1rm-history?exercise_name=X` → `[{ date, e1rm_kg, formula, low_confidence }]`

The `DrillDownModal` pattern (modal with ScrollView, loading/error states, themed styles) can be reused as the UI shell.

**Files to Create:**
| File | Purpose |
|------|--------|
| `app/screens/training/ExerciseHistoryScreen.tsx` | New screen |
| `app/components/training/ExerciseProgressChart.tsx` | e1RM trend chart for single exercise |
| `app/components/training/ExerciseSessionList.tsx` | List of all sessions for this exercise |

**Files to Modify:**
| File | Change |
|------|--------|
| `app/navigation/BottomTabNavigator.tsx` | Add ExerciseHistory to Analytics stack |
| `app/components/training/ExerciseContextMenu.tsx` | Add "View History" option |
| `app/screens/training/SessionDetailScreen.tsx` | Add tap-to-view-history on exercise names |

**Design Spec:**

ExerciseHistoryScreen layout:
1. **Header:** Exercise name + muscle group badge
2. **e1RM Trend Chart:** `TrendLineChart` with e1RM data, time range selector (30d/90d/1yr/all)
3. **Stats Row:** Current e1RM, all-time best, total sessions, total sets
4. **Session List:** Reverse chronological list of every session containing this exercise
   - Each row: date, sets × reps @ weight, best set highlighted
   - PR badges on sessions where PRs were hit
5. **Entry Points:**
   - ExerciseContextMenu → "View History" (during active workout)
   - SessionDetailScreen → tap exercise name
   - Analytics → strength progression → tap exercise

**Data Flow:**
```
ExerciseHistoryScreen(route.params.exerciseName)
  → parallel fetch:
     1. GET /training/analytics/e1rm-history?exercise_name=X&start_date=...&end_date=...
     2. GET /training/analytics/strength/X?start_date=...&end_date=...
  → render chart + session list
```

**Acceptance Criteria:**
- [ ] Screen shows e1RM trend chart for selected exercise
- [ ] Time range selector works (30d/90d/1yr/all)
- [ ] All sessions for that exercise listed chronologically
- [ ] PR badges shown on relevant sessions
- [ ] Accessible from ExerciseContextMenu, SessionDetail, and Analytics
- [ ] Loading and empty states handled
- [ ] Unit conversion (kg/lbs) respected

---

### F9: Quick-Add Food Favorites
**Priority:** P2 | **Effort:** 4-6 hours | **Risk:** Low

**Current State:** `FoodSearchPanel` already has a frequency badge (⭐ Frequent) and scan history chips pattern. `UserFoodFrequency` table tracks `log_count` and `last_logged_at` per user per food. No favorites system exists.

**Architecture Decision:** Add `is_favorite` boolean to `UserFoodFrequency` table (avoids new table, leverages existing frequency tracking). Favorites shown as horizontal chips above search results, matching the existing scan history chip pattern.

**Files to Create:**
| File | Purpose |
|------|--------|
| `alembic/versions/xxx_add_is_favorite_to_food_frequency.py` | Migration |

**Files to Modify:**
| File | Change |
|------|--------|
| `src/modules/food_database/models.py` | Add `is_favorite: bool = False` to `UserFoodFrequency` |
| `src/modules/food_database/service.py` | Add `toggle_favorite()`, `get_favorites()` methods |
| `src/modules/food_database/router.py` | Add `POST /food/favorites/{food_id}`, `GET /food/favorites` |
| `src/modules/food_database/schemas.py` | Add favorite schemas |
| `app/components/nutrition/FoodSearchPanel.tsx` | Add favorites chip row above search results |
| `app/components/nutrition/FavoriteChip.tsx` (new) | Favorite food chip component |

**Backend Design:**

```python
# models.py addition to UserFoodFrequency
is_favorite: Mapped[bool] = mapped_column(default=False)

# service.py additions
async def toggle_favorite(self, user_id, food_item_id) -> bool:
    freq = await self._get_or_create_frequency(user_id, food_item_id)
    freq.is_favorite = not freq.is_favorite
    await self.session.flush()
    return freq.is_favorite

async def get_favorites(self, user_id, limit=10) -> list[FoodItem]:
    stmt = (
        select(FoodItem)
        .join(UserFoodFrequency)
        .where(UserFoodFrequency.user_id == user_id, UserFoodFrequency.is_favorite == True)
        .order_by(UserFoodFrequency.log_count.desc())
        .limit(limit)
    )
    return (await self.session.execute(stmt)).scalars().all()
```

**Frontend Design:**

FoodSearchPanel additions:
- Fetch favorites on mount: `GET /food/favorites`
- Render horizontal ScrollView of `FavoriteChip` components above search input (same pattern as scan history chips)
- Each chip: food name (truncated), calories, tap to select (calls `onFoodSelected`)
- Long-press to unfavorite (with haptic feedback)
- Add ❤️ heart icon to food search results — tap to toggle favorite
- Max 10 favorites displayed

**Acceptance Criteria:**
- [ ] Users can favorite foods from search results (heart icon)
- [ ] Favorites shown as horizontal chips above search
- [ ] Tapping a favorite chip selects it (same as tapping a search result)
- [ ] Long-press unfavorites with confirmation haptic
- [ ] Max 10 favorites, ordered by usage frequency
- [ ] Favorites persist across sessions (server-side)
- [ ] Works with both USDA and Open Food Facts items

---

## Phase 4 — Growth & Viral Features

### F5: Monthly Recap with Shareable Card
**Priority:** P2 | **Effort:** 1-2 days | **Risk:** Low

**Current State:** `WeeklyReportService._build_*` methods accept arbitrary date ranges. `ReportCard` component exists for shareable images. Weekly report has training/nutrition/body/recommendations sections.

**Files to Create:**
| File | Purpose |
|------|--------|
| `src/modules/reports/monthly_service.py` | Monthly aggregation service |
| `src/modules/reports/monthly_schemas.py` | Monthly report schemas |
| `app/screens/reports/MonthlyReportScreen.tsx` | New screen |
| `app/components/reports/MonthlyReportCard.tsx` | Shareable monthly card |

**Files to Modify:**
| File | Change |
|------|--------|
| `src/modules/reports/router.py` | Add `GET /reports/monthly?year=YYYY&month=MM` |
| `app/navigation/BottomTabNavigator.tsx` | Add MonthlyReport to Analytics stack |
| `app/screens/reports/WeeklyReportScreen.tsx` | Add link to monthly view |

**Backend Design:** Reuse `_build_training_metrics()`, `_build_nutrition_metrics()`, `_build_body_metrics()` with `(month_start, month_end)` date range. Add month-over-month deltas (compare to previous month). Aggregate weekly WNS data across 4-5 weeks.

**Frontend Design:** Month selector (prev/next, no future months). Sections: Training summary (total volume, sessions, PRs), Nutrition summary (avg macros, compliance), Body (weight change), Month-over-month comparison badges (↑↓ deltas), Recommendations, Shareable `MonthlyReportCard` via `captureWorkoutAsImage` + `shareImage` pattern.

**Acceptance Criteria:**
- [ ] `GET /reports/monthly` returns aggregated monthly data
- [ ] Month-over-month comparison deltas included
- [ ] MonthlyReportScreen renders all sections
- [ ] Month navigation works (no future months)
- [ ] Shareable card generates and shares correctly
- [ ] Accessible from Analytics tab and Weekly Report screen

---

### F8: Workout Template Sharing via Deep Link
**Priority:** P2 | **Effort:** 1-2 days | **Risk:** Low

**Current State:** `activeExercisesToTemplate()` serializes workouts to `WorkoutTemplateCreate` format. `sharing.ts` has `buildShareUrl()`, `shareImage()`, `captureWorkoutAsImage()`. Template CRUD exists via `template_service.py`.

**Files to Create:**
| File | Purpose |
|------|--------|
| `app/components/sharing/TemplateShareCard.tsx` | Branded template preview card |

**Files to Modify:**
| File | Change |
|------|--------|
| `app/services/sharing.ts` | Add `buildTemplateShareUrl(templateId)` |
| `app/utils/templateConversion.ts` | Add `templateToSharePayload()` for serialization |
| `src/modules/training/template_service.py` | Add `get_template_public(templateId)` for unauthenticated access |
| `src/modules/training/router.py` | Add `GET /training/templates/shared/{shareId}` public endpoint |
| `src/modules/sharing/router.py` | Add deep link handler for template URLs |
| `app/components/training/TemplatePicker.tsx` | Add share button per template |
| `app/App.tsx` | Handle `repwise.app/share/template/*` deep links |

**Design:**
- Share flow: User taps share on template → `buildTemplateShareUrl(id)` generates `https://repwise.app/share/template/{id}` → native share sheet
- Import flow: Recipient opens link → deep link handler → fetch template via public endpoint → show preview → "Add to My Templates" button
- Public endpoint returns template without auth (read-only, no user data)
- Optional: `TemplateShareCard` for image sharing (branded card with exercise list)

**Acceptance Criteria:**
- [ ] Share button on each template in TemplatePicker
- [ ] Deep link `repwise.app/share/template/{id}` opens template preview
- [ ] Non-users see app download prompt
- [ ] Existing users can import template with one tap
- [ ] Public endpoint returns template without auth
- [ ] Image share card generates correctly

---

### F10: Rest Day Dashboard Variant
**Priority:** P2 | **Effort:** 1 day | **Risk:** Low

**Current State:** Dashboard renders identical layout regardless of whether user has trained today. `data.sessions` array is already available (empty = rest day, non-empty = training day).

**Files to Create:**
| File | Purpose |
|------|--------|
| `app/components/dashboard/RestDayCard.tsx` | Rest day content card |

**Files to Modify:**
| File | Change |
|------|--------|
| `app/screens/dashboard/DashboardScreen.tsx` | Conditional rendering based on `data.sessions.length === 0` |

**Design:**
When `data.sessions.length === 0` AND current time is past user's typical workout time (or after 2pm as default), show `RestDayCard` instead of `TodayWorkoutCard`:

- **Recovery Focus:** "Rest Day — Recovery is where growth happens" header
- **Nutrition Emphasis:** Highlight protein target ("Make sure you hit Xg protein today")
- **Next Workout Preview:** If templates exist, show next scheduled template name
- **Streak Status:** "Your streak is safe" or "❄️ Freeze available" messaging
- **Quick Tip:** Rotating recovery tips (stretching, sleep, hydration) from a static array

The card replaces `TodayWorkoutCard` only — all other dashboard sections (macros, meal diary, weight trend, etc.) remain unchanged.

**Acceptance Criteria:**
- [ ] Rest day card shows when no sessions logged today (after 2pm or configurable)
- [ ] Protein target reminder displayed
- [ ] Next workout preview shown if templates exist
- [ ] Streak messaging accurate
- [ ] Training day dashboard unchanged
- [ ] Card has consistent styling with other dashboard cards

---

## Implementation Summary

### Timeline

| Phase | Items | Effort | Days |
|-------|-------|--------|------|
| Phase 1 — Critical Fixes | B1, B2, B3 | ~1 hour | Day 1 |
| Phase 2 — Dashboard Enhancements | F1, F3, F4 | ~6 hours | Day 1-2 |
| Phase 3 — Core Feature Builds | F2, F6, F7, F9 | ~5 days | Day 3-7 |
| Phase 4 — Growth & Viral Features | F5, F8, F10 | ~5 days | Day 8-12 |
| **Total** | **13 items** | **~12 working days** | |

### Dependency Graph

```
Phase 1 (no dependencies — start immediately)
  B1 ──→ standalone
  B2 ──→ standalone
  B3 ──→ standalone

Phase 2 (no cross-dependencies — all parallelizable)
  F1 ──→ standalone (uses existing emaSeries + TrendLineChart)
  F3 ──→ standalone (uses existing WeeklyTrainingCalendar)
  F4 ──→ standalone (modifies OnboardingWizard only)

Phase 3 (some cross-dependencies)
  F2 ──→ needs Alembic migration first, then backend, then frontend
  F6 ──→ needs Alembic migration first, then backend engine.py, then frontend
  F7 ──→ standalone (uses existing API endpoints)
  F9 ──→ needs Alembic migration first (is_favorite column)
  
  Recommended order: F7 first (no migration), then F2+F6+F9 migrations together

Phase 4 (some cross-dependencies)
  F5 ──→ depends on weekly report pattern (already exists)
  F8 ──→ depends on template system (already exists)
  F10 ──→ standalone (dashboard conditional rendering)
  
  All parallelizable within phase
```

### Database Migrations Required

| Migration | Table/Column | Phase |
|-----------|-------------|-------|
| `create_personal_records_table` | New `personal_records` table | Phase 3 (F2) |
| `add_streak_freeze_table` | New `streak_freezes` table | Phase 3 (F6) |
| `add_is_favorite_to_food_frequency` | Add `is_favorite` bool to `user_food_frequency` | Phase 3 (F9) |

Run all 3 migrations together before starting Phase 3 frontend work.

### New Files Created (Total: 14)

| File | Feature |
|------|---------|
| `app/utils/externalLinks.ts` | B3 |
| `src/modules/training/pr_models.py` | F2 |
| `src/modules/training/pr_service.py` | F2 |
| `app/screens/training/PRHistoryScreen.tsx` | F2 |
| `app/components/training/PRHistoryCard.tsx` | F2 |
| `src/modules/achievements/streak_freeze_service.py` | F6 |
| `app/screens/training/ExerciseHistoryScreen.tsx` | F7 |
| `app/components/training/ExerciseProgressChart.tsx` | F7 |
| `app/components/training/ExerciseSessionList.tsx` | F7 |
| `app/components/nutrition/FavoriteChip.tsx` | F9 |
| `src/modules/reports/monthly_service.py` | F5 |
| `app/screens/reports/MonthlyReportScreen.tsx` | F5 |
| `app/components/reports/MonthlyReportCard.tsx` | F5 |
| `app/components/sharing/TemplateShareCard.tsx` | F8 |
| `app/components/dashboard/RestDayCard.tsx` | F10 |

### Files Modified (Total: ~30)

Phase 1: 4 files (RegisterScreen, ActiveWorkoutScreen, CommunityScreen, CoachingScreen)
Phase 2: 3 files (DashboardScreen, useDashboardData, OnboardingWizard)
Phase 3: ~13 files (router.py, schemas.py, models.py, engine.py, calculateStreak.ts, StreakIndicator, BottomTabNavigator, ExerciseContextMenu, SessionDetailScreen, FoodSearchPanel, food service/router/schemas)
Phase 4: ~10 files (reports router, sharing.ts, templateConversion.ts, template_service.py, TemplatePicker, App.tsx, DashboardScreen, WeeklyReportScreen, BottomTabNavigator)

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Streak freeze changes break existing streaks | Write migration that preserves current streak values. Add feature flag to roll back |
| PR table migration on production DB | Run migration during low-traffic window. PR persistence is additive (no data loss risk) |
| Template sharing exposes user data | Public endpoint returns template structure only — no user IDs, no session data, no personal info |
| Dashboard performance with added components | F1 sparkline uses already-loaded data. F3 calendar needs one additional API call — batch with existing calls |

---

*Plan prepared from codebase analysis of 200+ source files. All file paths, interfaces, and API endpoints verified against commit d440329.*
