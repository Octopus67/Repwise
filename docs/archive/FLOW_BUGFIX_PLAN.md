# Repwise — End-to-End Flow Bug Fix Plan
### 4 Critical + 6 Medium Bugs from User Flow Audit

---

## Execution Strategy

3 batches by severity and dependency.

**Batch 1 — Data Corruption & Broken Features (4 items, ~3 hours)**
- FLOW-1: Activity level mapping error (corrupts calorie targets)
- FLOW-3: Challenge progress never updates (entire feature broken)
- FLOW-4: OnboardingTrialPrompt says "7 Days" (user-facing lie)
- FLOW-7: prs_hit always 0 in trial insights (dead code)

**Batch 2 — Broken Navigation & UX (4 items, ~2 hours)**
- FLOW-2: VerificationBanner navigation crash
- FLOW-6: TrialExpirationModal no dismiss persistence
- FLOW-10: Login skips onboarding check
- FLOW-8: 2-day gap freeze impossible (increase limit to 2)

**Batch 3 — Edge Cases & Hardening (2 items, ~1 hour)**
- FLOW-5: Winback window re-validation at subscribe time
- FLOW-9: Manual freeze doesn't recalculate streak

---

## Batch 1 — Data Corruption & Broken Features

### FLOW-1: Activity Level Mapping Error
**Severity:** Critical | **File:** `app/utils/onboardingPayloadBuilder.ts`

**Root Cause:** `'highly_active'` maps to `'very_active'` instead of `'active'`. Both `highly_active` and `very_highly_active` collapse to the same backend value, overestimating TDEE by 200-400 kcal/day.

**Fix:**
```diff
- 'highly_active': 'very_active',
+ 'highly_active': 'active',
```

One line. The backend `ActivityLevel` enum has: `sedentary`, `light`, `moderate`, `active`, `very_active`. The mapping should be:
- `sedentary` → `sedentary`
- `lightly_active` → `light`
- `moderately_active` → `moderate`
- `highly_active` → `active`
- `very_highly_active` → `very_active`

**Acceptance Criteria:**
- [ ] Each frontend activity level maps to a unique backend value
- [ ] No two frontend values map to the same backend value
- [ ] Existing users unaffected (their data is already stored server-side)

---

### FLOW-3: Challenge Progress Never Updates
**Severity:** Critical | **Files:** `src/modules/training/service.py`, `src/modules/challenges/service.py`

**Root Cause:** No backend hook between workout completion and challenge progress. `TrainingService.create_session()` doesn't call any challenge update logic. The entire challenges feature shows 0/target forever.

**Fix:** Add challenge progress auto-update in `TrainingService.create_session()` after the achievement evaluation:

```python
# In create_session(), after achievement evaluation:
from src.modules.challenges.service import update_challenge_progress_from_session

await update_challenge_progress_from_session(
    self.session, user_id, training, data
)
```

New function in `challenges/service.py`:
```python
async def update_challenge_progress_from_session(
    session: AsyncSession, user_id: uuid.UUID, training_session, data
) -> None:
    """Auto-update challenge progress after a workout is logged."""
    challenges = await get_current_challenges(session, user_id)
    if not challenges:
        return

    for challenge in challenges:
        if challenge.completed:
            continue
        if challenge.challenge_type == "workout_count":
            challenge.current_value += 1
        elif challenge.challenge_type == "training_volume":
            vol = sum(
                (s.get("weight_kg", 0) or 0) * (s.get("reps", 0) or 0)
                for ex in (data.exercises or [])
                for s in ex.get("sets", [])
            )
            challenge.current_value += int(vol)
        # nutrition_compliance updated separately in nutrition service

        if challenge.current_value >= challenge.target_value and not challenge.completed:
            challenge.completed = True
            challenge.completed_at = datetime.now(timezone.utc)

    await session.flush()
```

**Acceptance Criteria:**
- [ ] Logging a workout increments `workout_count` challenge by 1
- [ ] Logging a workout adds session volume to `training_volume` challenge
- [ ] Challenge auto-completes when target reached
- [ ] `completed_at` timestamp set on completion
- [ ] Existing challenge data not corrupted
- [ ] Errors in challenge update don't break session creation (wrap in try/except)

---

### FLOW-4: OnboardingTrialPrompt Says "7 Days"
**Severity:** Critical | **File:** `app/components/premium/OnboardingTrialPrompt.tsx`

**Root Cause:** UI text hardcodes "7 Days" but backend creates 14-day trial after C1 change.

**Fix:**
```diff
- <Text style={styles.title}>Try Premium Free for 7 Days</Text>
+ <Text style={styles.title}>Try Premium Free for 14 Days</Text>
```

Also search for any other "7" references in this file (subtitle, description, etc.).

**Acceptance Criteria:**
- [ ] All trial duration text says "14 Days" or "14-day"
- [ ] No remaining "7" references related to trial duration

---

### FLOW-7: prs_hit Always 0 in Trial Insights
**Severity:** Medium | **File:** `src/modules/payments/trial_service.py`

**Root Cause:** `pr_count` initialized to 0 but never incremented. The `PersonalRecord` table now exists (from F2), so we can query it.

**Fix:** Replace the dead `pr_count = 0` with an actual query:
```python
# After the sessions query, add:
from src.modules.training.models import PersonalRecord

pr_stmt = select(func.count()).select_from(PersonalRecord).where(
    PersonalRecord.user_id == user_id,
    PersonalRecord.achieved_at >= start,
    PersonalRecord.achieved_at <= end,
)
pr_result = await self.session.execute(pr_stmt)
pr_count = pr_result.scalar() or 0
```

Remove the `pr_count = 0` initialization.

**Acceptance Criteria:**
- [ ] `prs_hit` returns actual PR count from personal_records table
- [ ] Filtered to trial period (start → end dates)
- [ ] Returns 0 for users with no PRs (not None)

---

## Batch 2 — Broken Navigation & UX

### FLOW-2: VerificationBanner Navigation Crash
**Severity:** Critical | **File:** `app/screens/dashboard/DashboardScreen.tsx`

**Root Cause:** `navigation.navigate('EmailVerification')` targets a screen in AuthStack, not BottomTabNavigator. Silent failure.

**Fix:** Instead of navigating to a screen, open a modal or use a deep link. Simplest approach — trigger the verification email resend and show an alert:

```tsx
<VerificationBanner
  onVerify={async () => {
    try {
      await api.post('auth/resend-verification');
      Alert.alert('Verification Email Sent', 'Check your inbox for the verification code.');
    } catch {
      Alert.alert('Error', 'Could not send verification email. Please try again.');
    }
  }}
  onDismiss={dismissVerify}
/>
```

This avoids the navigation problem entirely — the user gets a fresh verification email and can enter the code when they next open the app (or via a future in-app verification modal).

**Acceptance Criteria:**
- [ ] "Verify Now" sends verification email via API
- [ ] Success alert shown
- [ ] Error handled gracefully
- [ ] No navigation to non-existent screen

---

### FLOW-6: TrialExpirationModal No Dismiss Persistence
**Severity:** Medium | **File:** `app/screens/dashboard/DashboardScreen.tsx`

**Root Cause:** Modal shows on every dashboard mount when trial is expired. No AsyncStorage persistence like VerificationBanner has.

**Fix:** Add AsyncStorage-backed dismiss with 24h TTL (same pattern as VerificationBanner):
```tsx
const TRIAL_MODAL_DISMISS_KEY = '@repwise:trial_modal_dismissed';

// On mount, check if dismissed recently:
useEffect(() => {
  AsyncStorage.getItem(TRIAL_MODAL_DISMISS_KEY).then(val => {
    if (val && Date.now() - Number(val) < 86_400_000) {
      setTrialModalDismissed(true);
    }
  });
}, []);

// On dismiss:
const dismissTrialModal = () => {
  setShowTrialExpiration(false);
  AsyncStorage.setItem(TRIAL_MODAL_DISMISS_KEY, Date.now().toString());
};
```

Pass `dismissTrialModal` as `onClose` to `TrialExpirationModal`.

**Acceptance Criteria:**
- [ ] Modal doesn't reappear for 24h after dismiss
- [ ] Still shows on first open after trial expiry
- [ ] Reappears after 24h if user hasn't subscribed

---

### FLOW-10: Login Skips Onboarding Check
**Severity:** Medium | **File:** `app/App.tsx`

**Root Cause:** `handleLoginSuccess` sets auth but doesn't check if onboarding was completed. User who registered but didn't finish onboarding lands on dashboard with default targets.

**Fix:** Add goals check in `handleLoginSuccess` (same pattern as `restoreSession`):
```tsx
const handleLoginSuccess = async (user, tokens) => {
  setAuth({ ...user, role: 'user' }, tokens);
  try {
    const [profileRes, goalsRes] = await Promise.all([
      api.get('users/profile'),
      api.get('users/goals'),
    ]);
    // If no goals exist, user needs onboarding
    if (!goalsRes.data || !goalsRes.data.goal_type) {
      setNeedsOnboarding(true);
    }
    // ... existing profile/subscription loading ...
  } catch {
    // If goals check fails, assume onboarding needed
    setNeedsOnboarding(true);
  }
};
```

**Acceptance Criteria:**
- [ ] User who registered but didn't onboard sees OnboardingWizard after login
- [ ] User who completed onboarding goes straight to dashboard
- [ ] Goals check failure defaults to showing onboarding (safe fallback)

---

### FLOW-8: 2-Day Gap Freeze Impossible
**Severity:** Medium | **File:** `src/modules/achievements/streak_freeze_service.py`

**Root Cause:** `FREEZES_PER_MONTH = 1` but a 2-day gap needs 2 freezes. Only 1-day gaps can be auto-frozen.

**Fix:** Increase to 2:
```diff
- FREEZES_PER_MONTH = 1
+ FREEZES_PER_MONTH = 2
```

This matches the `_update_streak` logic which allows gaps up to 2 days (`if 1 <= gap_days <= 2`).

**Acceptance Criteria:**
- [ ] 1-day gap: auto-frozen with 1 freeze (1 remaining)
- [ ] 2-day gap: auto-frozen with 2 freezes (0 remaining)
- [ ] 3+ day gap: streak resets (unchanged)
- [ ] Monthly limit resets on calendar month boundary

---

## Batch 3 — Edge Cases & Hardening

### FLOW-5: Winback Window Re-validation at Subscribe Time
**Severity:** Medium | **File:** `src/modules/payments/service.py`

**Root Cause:** Backend doesn't verify winback window is still open when processing `yearly_winback_discount` plan_id.

**Fix:** Add validation in `initiate_subscription()` for winback plan_ids:
```python
if data.plan_id == 'yearly_winback_discount':
    from src.modules.payments.winback_service import get_winback_offer
    offer = await get_winback_offer(self.session, user_id)
    if offer is None or not offer.get('eligible'):
        raise UnprocessableError("Win-back offer has expired.")
```

**Acceptance Criteria:**
- [ ] Expired winback plan_id rejected with clear error
- [ ] Valid winback plan_id processed normally
- [ ] Non-winback plan_ids unaffected

---

### FLOW-9: Manual Freeze Doesn't Recalculate Streak
**Severity:** Medium | **File:** `src/modules/achievements/router.py`

**Root Cause:** Manual freeze creates a StreakFreeze record but doesn't recalculate the streak counter. If the streak was already reset, the freeze record exists but the counter stays at 1.

**Fix:** After creating the freeze, trigger a streak recalculation:
```python
# After successful freeze creation:
from src.modules.achievements.engine import AchievementEngine
engine = AchievementEngine(db)
await engine.recalculate_streak(user.id)
```

Add `recalculate_streak` to the engine:
```python
async def recalculate_streak(self, user_id: uuid.UUID) -> None:
    """Recalculate streak from activity dates + freeze dates."""
    progress = await self._get_or_create_progress(user_id, "streak")
    # Get all activity dates
    sessions = await self.session.execute(
        select(TrainingSession.session_date)
        .where(TrainingSession.user_id == user_id)
        .order_by(TrainingSession.session_date.desc())
    )
    activity_dates = {row[0] for row in sessions.all()}
    # Get all freeze dates
    freezes = await self.session.execute(
        select(StreakFreeze.freeze_date)
        .where(StreakFreeze.user_id == user_id)
    )
    frozen_dates = {row[0] for row in freezes.all()}
    # Walk backwards from today counting consecutive days
    today = date.today()
    if today not in activity_dates:
        return  # No activity today, streak stays as-is
    count = 1
    current = today
    while True:
        prev = current - timedelta(days=1)
        if prev in activity_dates:
            count += 1
            current = prev
        elif prev in frozen_dates:
            current = prev  # Bridge but don't count
        else:
            break
    progress.current_value = count
    await self.session.flush()
```

**Acceptance Criteria:**
- [ ] Manual freeze followed by streak check shows correct streak value
- [ ] Frozen dates bridge gaps without inflating count
- [ ] Recalculation matches frontend `calculateStreak` logic

---

## Summary

| Batch | Items | Effort | Files |
|-------|-------|--------|-------|
| Batch 1 — Data Corruption | 4 (2 critical + 2 medium) | ~3 hours | 5 files |
| Batch 2 — Navigation & UX | 4 medium | ~2 hours | 4 files |
| Batch 3 — Edge Cases | 2 medium | ~1 hour | 3 files |
| **Total** | **10 items** | **~6 hours** | **~10 files** |

### Zero-Regression Checklist
- [ ] Activity level mapping: all 5 levels map to unique backend values
- [ ] Challenge progress: increments on workout completion
- [ ] Trial prompt: says "14 Days" everywhere
- [ ] Trial insights: prs_hit returns actual count
- [ ] VerificationBanner: sends email, no navigation crash
- [ ] TrialExpirationModal: dismissed for 24h
- [ ] Login: checks onboarding completion
- [ ] Streak freeze: 2/month limit, recalculates on manual freeze
- [ ] Winback: re-validated at subscribe time
- [ ] TypeScript: 0 errors
- [ ] Python: all files compile clean

---

*Plan grounded in exact code analysis of every affected file and user flow.*
