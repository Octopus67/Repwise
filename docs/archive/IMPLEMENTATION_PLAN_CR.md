# Repwise — Conversion & Retention Implementation Plan
### 11 Active Items: C1-C5, C7-C8 (Conversion) + R2, R4-R6 (Retention)
### Note: C6, R1, R3 already implemented in Feature phase (F4, F6, F5)

---

## Overview

11 items organized into 4 phases. Each item includes exact file changes, design spec, and acceptance criteria.

**Phase 1 — Quick Conversion Wins (Day 1, ~3 hours)**
- C1: Extend trial to 14 days (~5 lines)
- C3: Remove confirm password field
- C4: Replace ToS checkbox with implicit consent

**Phase 2 — Auth & Onboarding Optimization (Day 2-3, ~1.5 days)**
- C2: Make email verification deferrable
- C5: Combine onboarding steps 6+7

**Phase 3 — Monetization & Win-Back (Day 4-6, ~3 days)**
- C7: Exit-intent discount offer on UpgradeModal
- C8: Win-back offer after trial expiration

**Phase 4 — Retention Features (Day 7-12, ~5 days)**
- R2: Weekly micro-challenges
- R4: Year in Review shareable card
- R5: Milestone content unlocks
- R6: Smart notification timing

---

## Phase 1 — Quick Conversion Wins

### C1: Extend Trial to 14 Days
**Priority:** P1 | **Effort:** 10 minutes | **Risk:** None

**Current State:** `TRIAL_DURATION_DAYS = 7` at `src/modules/payments/trial_service.py:23`. Used in trial activation (line 74), plan_id string (line 86: `"trial_7day"`), and insights fallback (line 129).

**Files to Change:**
| File | Change |
|------|--------|
| `src/modules/payments/trial_service.py` | Change constant + plan_id |
| `tests/test_trial.py` | Update 2 assertions |

**Exact Changes:**
```diff
- TRIAL_DURATION_DAYS = 7
+ TRIAL_DURATION_DAYS = 14

- plan_id="trial_7day",
+ plan_id="trial_14day",
```

Tests:
```diff
- assert sub.plan_id == "trial_7day"
+ assert sub.plan_id == "trial_14day"
```

**Acceptance Criteria:**
- [ ] New trials last 14 days
- [ ] plan_id reflects new duration
- [ ] Existing active trials unaffected (they already have `current_period_end` set)
- [ ] Tests pass with updated assertions

---

### C3: Remove Confirm Password Field
**Priority:** P1 | **Effort:** 30 minutes | **Risk:** Low

**Current State:** RegisterScreen.tsx has `confirmPassword` state, a TextInput, a mismatch warning, and validation in `handleRegister`.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/auth/RegisterScreen.tsx` | Remove confirm password field + related state/validation |

**What to Remove:**
1. State: `const [confirmPassword, setConfirmPassword] = useState('');`
2. State: `const [showConfirm, setShowConfirm] = useState(false);`
3. Ref: `const confirmRef = useRef<TextInput>(null);`
4. Validation: `if (password !== confirmPassword)` block in `handleRegister`
5. The entire confirm password `<View>` + `<TextInput>` + show/hide toggle (~20 lines)
6. The mismatch warning `<Text>` below it
7. Change password field's `onSubmitEditing` from `confirmRef.current?.focus()` to `handleRegister`
8. Change password field's `returnKeyType` from `"next"` to `"done"`

**Acceptance Criteria:**
- [ ] Registration form has only email + password (2 fields)
- [ ] Password field submits form on Enter/Done
- [ ] No confirm password validation
- [ ] Show/hide toggle still works on password field
- [ ] Registration still works end-to-end

---

### C4: Replace ToS Checkbox with Implicit Consent
**Priority:** P1 | **Effort:** 20 minutes | **Risk:** Low

**Current State:** RegisterScreen.tsx has `tosAccepted` state, a checkbox TouchableOpacity, validation in `handleRegister`, and `!tosAccepted` in button's disabled prop.

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/auth/RegisterScreen.tsx` | Replace checkbox with passive text |

**What to Remove:**
1. State: `const [tosAccepted, setTosAccepted] = useState(false);`
2. Validation: `if (!tosAccepted)` block in `handleRegister`
3. Button disabled: remove `!tosAccepted` from `disabled={!tosAccepted || loading}`
4. The entire checkbox `<TouchableOpacity>` block (~15 lines)

**What to Add:**
Replace the checkbox with passive consent text:
```tsx
<Text style={{ color: c.text.muted, fontSize: typography.size.xs, textAlign: 'center', marginBottom: spacing[3], lineHeight: typography.lineHeight.sm }}>
  By registering, you agree to our{' '}
  <Text style={{ color: c.accent.primary, textDecorationLine: 'underline' }}
    onPress={() => Linking.openURL('https://repwise.app/terms')}
    accessibilityRole="link">Terms of Service</Text>
  {' '}and{' '}
  <Text style={{ color: c.accent.primary, textDecorationLine: 'underline' }}
    onPress={() => Linking.openURL('https://repwise.app/privacy')}
    accessibilityRole="link">Privacy Policy</Text>
</Text>
```

**Acceptance Criteria:**
- [ ] No checkbox visible
- [ ] Passive consent text shown below form
- [ ] Terms and Privacy links still work
- [ ] Register button enabled without checkbox interaction
- [ ] Registration still works end-to-end

---

## Phase 2 — Auth & Onboarding Optimization

### C2: Make Email Verification Deferrable
**Priority:** P1 | **Effort:** 4-6 hours | **Risk:** Medium (auth flow change)

**Current State:** `login_email()` in `src/modules/auth/service.py` raises `403 EMAIL_NOT_VERIFIED` if `user.email_verified` is False. This is a hard gate — unverified users cannot access the app at all. Frontend auth gate in `App.tsx` only checks `isAuthenticated`, not `email_verified`.

**Architecture Decision:** Remove the server-side hard block. Let unverified users log in and use the app. Show a persistent but dismissible banner prompting verification. Restrict certain sensitive actions (e.g., payment) to verified users only.

**Files to Change:**
| File | Change |
|------|--------|
| `src/modules/auth/service.py` | Remove the `email_verified` guard in `login_email()` |
| `src/modules/auth/schemas.py` | Add `email_verified: bool` to `LoginResponse` |
| `app/screens/auth/RegisterScreen.tsx` | After registration, set auth state directly instead of navigating to verification |
| `app/components/common/VerificationBanner.tsx` (new) | Persistent banner component |
| `app/screens/dashboard/DashboardScreen.tsx` | Show VerificationBanner when `!user.email_verified` |
| `app/store/authSlice.ts` or equivalent | Store `email_verified` in auth state |

**Backend Change:**
```diff
# src/modules/auth/service.py login_email()
- if not user.email_verified:
-     raise ApiError(
-         status=403,
-         code="EMAIL_NOT_VERIFIED",
-         message="Please verify your email before logging in",
-     )
+ # Email verification is now deferrable - users can log in unverified
+ # Verification status is returned in the response for frontend gating
```

**Frontend Banner Design:**
```tsx
// app/components/common/VerificationBanner.tsx
// Persistent banner at top of dashboard:
// 📧 Verify your email to unlock all features  [Verify Now]  [Dismiss]
// - "Verify Now" navigates to EmailVerificationScreen
// - "Dismiss" hides for current session (not permanent)
// - Yellow/warning accent color, subtle animation
```

**Acceptance Criteria:**
- [ ] Unverified users can log in and access the app
- [ ] Login response includes `email_verified` boolean
- [ ] VerificationBanner shown on dashboard for unverified users
- [ ] "Verify Now" navigates to verification flow
- [ ] "Dismiss" hides banner for current session
- [ ] OAuth users (Google/Apple) unaffected (already auto-verified)
- [ ] Payment endpoints still require verified email

---

### C5: Combine Onboarding Steps 6+7
**Priority:** P2 | **Effort:** 3-4 hours | **Risk:** Low

**Current State:** Step 6 (TDEERevealStep) shows TDEE breakdown with 4 animated bars + optional override input. Step 7 (SmartTrainingStep) shows volume recommendations, static-vs-adaptive comparison cards, and a 4-week timeline. Both are read-only informational screens.

**Architecture Decision:** Merge into a single "Your Personalized Plan" screen. Keep the TDEE hero section (it's the value demonstration moment). Condense SmartTraining into a compact comparison section. Drop the 4-week timeline (too detailed for onboarding).

**Files to Change:**
| File | Change |
|------|--------|
| `app/screens/onboarding/steps/TDEERevealStep.tsx` | Expand to include condensed SmartTraining content |
| `app/screens/onboarding/steps/SmartTrainingStep.tsx` | Delete file |
| `app/screens/onboarding/OnboardingWizard.tsx` | Remove SmartTraining step, update TOTAL_STEPS |
| `app/screens/onboarding/stepConstants.ts` | Remove SMART_TRAINING, renumber subsequent steps |

**Combined Screen Layout:**
1. Heading: "Your Personalized Plan"
2. TDEE breakdown (keep as-is: animated counter + 4 bars)
3. TDEE override input (keep as-is)
4. Divider
5. "Smart Training" subheading
6. Comparison cards only (Static Plans vs Repwise Adaptive) — condensed to 2 small cards
7. Drop: volume bars, 4-week timeline (too much for combined screen)
8. Next button

**Step Renumbering:**
```
Before (11 steps): Intent → BodyBasics → BodyMeasurements → BodyComposition → Lifestyle → TDEEReveal → SmartTraining → Goal → DietStyle → FoodDNA → Summary
After (10 steps):  Intent → BodyBasics → BodyMeasurements → BodyComposition → Lifestyle → YourPlan → Goal → DietStyle → FoodDNA → Summary
```

**Acceptance Criteria:**
- [ ] Onboarding has 10 steps (down from 11)
- [ ] Combined screen shows TDEE breakdown + comparison cards
- [ ] TDEE override input still works
- [ ] SmartTrainingStep.tsx deleted
- [ ] Step dots (F4) update to show 10 dots
- [ ] All subsequent step numbers correct
- [ ] Onboarding completion still works end-to-end

---

## Phase 3 — Monetization & Win-Back

### C7: Exit-Intent Discount Offer
**Priority:** P1 | **Effort:** 1 day | **Risk:** Low

**Current State:** `UpgradeModal` has a "Maybe later" button and `onRequestClose` that both call `onClose` directly. No interception. Plans are hardcoded: Monthly $9.99, Yearly $79.99. No discount logic exists.

**Files to Change:**
| File | Change |
|------|--------|
| `app/components/premium/UpgradeModal.tsx` | Add exit-intent interception + discount overlay |

**Design:**

Add `showExitOffer` state. When user taps "Maybe later" or Android back:
1. First dismiss attempt → set `showExitOffer = true` (don't close)
2. Show discount overlay on top of existing modal content:
   - "Wait! Special offer just for you"
   - Strikethrough original annual price: ~~$79.99/yr~~ → **$55.99/yr** (30% off)
   - Countdown: "Offer expires in 10:00" (10-minute timer, session-only)
   - "Claim Discount" primary CTA
   - "No thanks" secondary → actually closes modal
3. Reset `showExitOffer` when modal closes (existing `useEffect` on `!visible` handles this)

**Implementation:**
```tsx
const [showExitOffer, setShowExitOffer] = useState(false);

const handleDismiss = () => {
  if (!showExitOffer) {
    setShowExitOffer(true);  // First attempt: show offer
  } else {
    onClose();  // Second attempt: actually close
  }
};

// Replace onClose calls from "Maybe later" and onRequestClose with handleDismiss
```

Discount overlay:
```tsx
{showExitOffer && (
  <View style={styles.exitOfferOverlay}>
    <Text style={styles.exitOfferTitle}>Wait! Special offer just for you</Text>
    <Text style={styles.exitOfferPrice}>
      <Text style={{ textDecorationLine: 'line-through' }}>$79.99/yr</Text>
      {'  '}
      <Text style={{ color: c.semantic.positive, fontWeight: 'bold' }}>$55.99/yr</Text>
    </Text>
    <Text style={styles.exitOfferTimer}>Offer expires in {formatCountdown(timeLeft)}</Text>
    <Button title="Claim Discount" onPress={() => handleSubscribe('yearly_discount')} />
    <TouchableOpacity onPress={onClose}>
      <Text style={styles.noThanks}>No thanks</Text>
    </TouchableOpacity>
  </View>
)}
```

**Backend Consideration:** The `handleSubscribe` function sends `plan_id` to the backend. For the discount, either:
- Add a `yearly_discount` plan in Stripe/Razorpay with the discounted price
- Or apply a coupon code server-side when `plan_id` contains `_discount`

**Acceptance Criteria:**
- [ ] First dismiss attempt shows discount overlay (doesn't close)
- [ ] Discount shows 30% off annual price with strikethrough
- [ ] 10-minute countdown timer visible
- [ ] "Claim Discount" triggers subscription with discounted plan
- [ ] "No thanks" actually closes the modal
- [ ] Second dismiss (Android back) also closes
- [ ] Overlay resets when modal reopens

---

### C8: Win-Back Offer After Trial Expiration
**Priority:** P1 | **Effort:** 2 days | **Risk:** Medium (touches payment flow + notifications)

**Current State:** `trial_expiration.py` silently downgrades expired trials (sets status to FREE). No notification sent. `TrialExpirationModal` shows trial insights but no discount or urgency.

**Files to Create:**
| File | Purpose |
|------|--------|
| `src/modules/payments/winback_service.py` | Win-back offer logic: eligibility, time window, discount |

**Files to Change:**
| File | Change |
|------|--------|
| `src/jobs/trial_expiration.py` | Send push notification on expiry + create win-back offer |
| `src/modules/payments/trial_service.py` | Add `get_winback_offer(user_id)` method |
| `src/modules/payments/schemas.py` | Add WinbackOfferResponse schema |
| `src/modules/payments/router.py` | Add `GET /payments/winback-offer` endpoint |
| `app/components/premium/TrialExpirationModal.tsx` | Add countdown timer + discounted pricing |

**Backend Design:**

Win-back offer: 48-hour window after trial expiration, 40% off annual plan.

```python
# winback_service.py
WINBACK_WINDOW_HOURS = 48
WINBACK_DISCOUNT_PCT = 40

async def get_winback_offer(session, user_id) -> Optional[WinbackOffer]:
    sub = await _get_latest_trial(session, user_id)
    if not sub or sub.status != SubscriptionStatus.FREE:
        return None
    expired_at = sub.current_period_end
    deadline = expired_at + timedelta(hours=WINBACK_WINDOW_HOURS)
    if datetime.utcnow() > deadline:
        return None  # Window expired
    remaining_seconds = (deadline - datetime.utcnow()).total_seconds()
    return WinbackOffer(
        eligible=True,
        discount_pct=WINBACK_DISCOUNT_PCT,
        original_price_yearly=79.99,
        discounted_price_yearly=round(79.99 * 0.6, 2),  # $47.99
        deadline=deadline,
        remaining_seconds=int(remaining_seconds),
    )
```

Trial expiration job addition:
```python
# trial_expiration.py — after setting status to FREE:
from src.services.push_notifications import NotificationService

for sub in expired_subs:
    sub.status = SubscriptionStatus.FREE
    # NEW: Send win-back push notification
    await NotificationService.send_push(
        user_id=sub.user_id,
        title="Your trial ended — but we have a deal 🎁",
        body="Get 40% off Premium for the next 48 hours. Don't lose your progress!",
        notification_type="winback_offer",
    )
```

**Frontend Design:**

Enhanced TrialExpirationModal:
1. Keep existing insights grid (workouts, PRs, volume, meals, measurements)
2. Add urgency section below insights:
   - "Special offer: 40% off Premium"
   - Countdown timer: "Expires in 47:23:15" (fetched from `GET /payments/winback-offer`)
   - Strikethrough pricing: ~~$79.99/yr~~ → **$47.99/yr**
3. Change CTA from "Upgrade to Premium" to "Claim 40% Off"
4. If win-back window expired, fall back to standard upgrade prompt

**Acceptance Criteria:**
- [ ] Push notification sent when trial expires
- [ ] `GET /payments/winback-offer` returns offer with countdown
- [ ] 48-hour window enforced (returns null after)
- [ ] TrialExpirationModal shows countdown + discounted price during window
- [ ] "Claim 40% Off" triggers discounted subscription
- [ ] Standard upgrade shown after window expires
- [ ] Existing trial insights still displayed

---

## Phase 4 — Retention Features

### R2: Weekly Micro-Challenges
**Priority:** P2 | **Effort:** 2-3 days | **Risk:** Medium (new module)

**Current State:** No challenge system exists. Achievement system is extensible: `AchievementCategory` is a StrEnum, `AchievementDef` is a frozen dataclass, `ACHIEVEMENT_REGISTRY` is a static dict.

**Files to Create:**
| File | Purpose |
|------|--------|
| `src/modules/challenges/models.py` | WeeklyChallenge + UserChallengeProgress models |
| `src/modules/challenges/service.py` | Challenge generation, progress tracking, completion |
| `src/modules/challenges/router.py` | GET /challenges/current, POST /challenges/progress |
| `src/modules/challenges/schemas.py` | Challenge schemas |
| `src/modules/challenges/generator.py` | Weekly challenge generation from user data |
| `alembic/versions/xxx_create_challenges_tables.py` | Migration |
| `app/components/dashboard/WeeklyChallengeCard.tsx` | Dashboard challenge card |

**Files to Modify:**
| File | Change |
|------|--------|
| `app/screens/dashboard/DashboardScreen.tsx` | Add WeeklyChallengeCard |
| `src/modules/achievements/definitions.py` | Add CHALLENGE category |

**Challenge Types (generated from user data):**
- Training: "Hit 12 sets of back this week", "Log 4 workouts", "Set a PR on any exercise"
- Nutrition: "Log 5 meals", "Hit protein target 5 days", "Stay within 100 cal of target 4 days"
- Consistency: "Log food and training 3 days", "Complete a workout before noon"

**Backend Design:**
```python
class WeeklyChallenge(Base):
    __tablename__ = "weekly_challenges"
    id: Mapped[uuid.UUID]
    user_id: Mapped[uuid.UUID]  # FK users.id
    challenge_type: Mapped[str]  # 'training_volume', 'workout_count', 'nutrition_compliance', etc.
    title: Mapped[str]
    description: Mapped[str]
    target_value: Mapped[int]
    current_value: Mapped[int] = mapped_column(default=0)
    week_start: Mapped[date]
    week_end: Mapped[date]
    completed: Mapped[bool] = mapped_column(default=False)
    completed_at: Mapped[Optional[datetime]]
```

Generator picks 2-3 challenges per week based on user's recent activity (e.g., if they've been neglecting back, generate a back volume challenge).

**Frontend Design:**
WeeklyChallengeCard on dashboard:
- Shows 2-3 active challenges with progress bars
- Completed challenges show checkmark + celebration
- "This week's challenges" header with week dates
- Tap to expand details

**Acceptance Criteria:**
- [ ] 2-3 challenges generated per user per week
- [ ] Challenges personalized based on user's training history
- [ ] Progress tracked automatically (training sessions update training challenges, nutrition entries update nutrition challenges)
- [ ] Completed challenges show celebration
- [ ] Dashboard card shows current challenges with progress
- [ ] New challenges generated on Monday

---

### R4: Year in Review
**Priority:** P2 | **Effort:** 2 days | **Risk:** Low

**Current State:** No annual aggregation exists. `WeeklyReportService._build_*` methods work with arbitrary date ranges. `WorkoutShareCard` pattern exists (ViewShot + themes + QR code).

**Files to Create:**
| File | Purpose |
|------|--------|
| `src/modules/reports/yearly_service.py` | Annual aggregation service |
| `src/modules/reports/yearly_schemas.py` | Year in Review schemas |
| `app/screens/reports/YearInReviewScreen.tsx` | Full-screen Year in Review |
| `app/components/sharing/YearInReviewCard.tsx` | Shareable branded card (ViewShot) |

**Files to Modify:**
| File | Change |
|------|--------|
| `src/modules/reports/router.py` | Add GET /reports/yearly?year=YYYY |
| `app/navigation/BottomTabNavigator.tsx` | Add YearInReview to Profile stack |

**Backend Design:**
Reuse `WeeklyReportService._build_*` with Jan 1 → Dec 31 date range. Add:
- Total workouts, total volume, total PRs
- Most trained muscle group
- Longest streak
- Total meals logged
- Weight change (start vs end of year)
- Most improved exercise (biggest e1RM gain)
- Consistency score (% of weeks with 3+ workouts)

**Frontend Design (Shareable Card):**
Follows WorkoutShareCard pattern:
- ViewShot capture → PNG
- 3 theme variants (dark/midnight/ocean)
- Stats grid: workouts, volume, PRs, streak, meals
- "Most improved" highlight
- QR code + Repwise branding
- Share via native share sheet

**Acceptance Criteria:**
- [ ] `GET /reports/yearly` returns annual aggregation
- [ ] YearInReviewScreen shows all annual stats
- [ ] Shareable card generates with 3 theme options
- [ ] Share via native share sheet works
- [ ] QR code links to app
- [ ] Accessible from Profile tab

---

### R5: Milestone Content Unlocks
**Priority:** P2 | **Effort:** 4-6 hours | **Risk:** Low

**Current State:** Content gating in `content/service.py` is a simple 3-condition check: `article.is_premium AND NOT has_premium AND NOT admin`. Achievement system tracks unlocked achievements via `UserAchievement` table.

**Files to Change:**
| File | Change |
|------|--------|
| `src/modules/content/models.py` | Add `unlocked_by_achievement: Optional[str]` to ContentArticle |
| `src/modules/content/service.py` | Modify `get_article()` to check achievement unlock |
| `alembic/versions/xxx_add_unlocked_by_achievement.py` | Migration |

**Backend Design:**

Add optional field to ContentArticle:
```python
unlocked_by_achievement: Mapped[Optional[str]] = mapped_column(nullable=True)
# e.g., "streak_30" means this article unlocks when user hits 30-day streak
```

Modified guard in `get_article()`:
```python
if article.is_premium and not has_premium and user_role != "admin":
    # Check if user has unlocked via achievement
    if article.unlocked_by_achievement:
        has_unlock = await self._check_achievement_unlock(
            user_id, article.unlocked_by_achievement
        )
        if has_unlock:
            return article
    raise PremiumRequiredError(...)
```

**Milestone → Article Mapping (seed data):**
- `streak_7` → "The Science of Progressive Overload"
- `streak_30` → "Advanced Periodization Strategies"
- `volume_50k` → "Nutrition for Hypertrophy: Complete Guide"
- `streak_90` → "Deload Protocols: When and How"

**Acceptance Criteria:**
- [ ] `unlocked_by_achievement` field added to ContentArticle
- [ ] Articles with achievement unlock accessible to users who earned that achievement
- [ ] Premium gate still works for articles without achievement unlock
- [ ] Admin bypass still works
- [ ] Seed data maps 4+ articles to achievements

---

### R6: Smart Notification Timing
**Priority:** P2 | **Effort:** 4-6 hours | **Risk:** Low

**Current State:** `workout_reminders.py` runs at fixed `hour=9` cron. No timezone awareness. `quiet_hours_start/end` exist in notification preferences but are NOT enforced. No personalization based on user's workout patterns.

**Files to Change:**
| File | Change |
|------|--------|
| `src/jobs/workout_reminders.py` | Add quiet hours enforcement + smart timing |
| `src/modules/notifications/models.py` | Add `preferred_workout_hour` to preferences (or derive from data) |

**Design:**

Phase A — Enforce quiet hours (quick win):
```python
# Before sending notification, check quiet hours:
prefs = await get_notification_prefs(user_id)
if prefs.quiet_hours_start and prefs.quiet_hours_end:
    now_time = datetime.now(tz=user_tz).time()
    if prefs.quiet_hours_start <= now_time <= prefs.quiet_hours_end:
        continue  # Skip this user, they're in quiet hours
```

Phase B — Smart timing from session history:
```python
# Derive preferred workout time from last 30 days of sessions:
sessions = await get_recent_sessions(user_id, days=30)
if sessions:
    start_hours = [s.started_at.hour for s in sessions if s.started_at]
    preferred_hour = statistics.mode(start_hours)  # Most common workout hour
    # Send reminder 30-60 min before preferred hour
    reminder_hour = preferred_hour - 1
```

Phase C — Run job more frequently:
- Change from `hour=9` single run to `every 2 hours` (6 runs/day)
- Each run checks which users should be reminded NOW based on their preferred time
- Skip users already notified today (existing `NotificationLog` check)

**Acceptance Criteria:**
- [ ] Quiet hours enforced (no notifications during user's quiet period)
- [ ] Preferred workout time derived from session history
- [ ] Reminders sent 30-60 min before user's typical workout time
- [ ] Job runs multiple times per day (not just hour=9)
- [ ] Users without session history get default time (9 AM)
- [ ] NotificationLog prevents duplicate reminders

---

## Implementation Summary

### Timeline

| Phase | Items | Effort | Days |
|-------|-------|--------|------|
| Phase 1 — Quick Conversion Wins | C1, C3, C4 | ~3 hours | Day 1 |
| Phase 2 — Auth & Onboarding | C2, C5 | ~1.5 days | Day 2-3 |
| Phase 3 — Monetization & Win-Back | C7, C8 | ~3 days | Day 4-6 |
| Phase 4 — Retention Features | R2, R4, R5, R6 | ~5 days | Day 7-12 |
| **Total** | **11 items** | **~12 working days** | |

### Already Completed (from Feature phase)
| Item | Implemented As | Status |
|------|---------------|--------|
| C6: Onboarding progress indicator | F4 | ✅ Done |
| R1: Streak freeze | F6 | ✅ Done |
| R3: Monthly recap | F5 | ✅ Done |

### Database Migrations Required
| Migration | Table/Column | Phase |
|-----------|-------------|-------|
| `add_unlocked_by_achievement` | Add column to `content_articles` | Phase 4 (R5) |
| `create_challenges_tables` | New `weekly_challenges` table | Phase 4 (R2) |

### Recommendation Index
| ID | Item | Category | Effort | Impact | Phase |
|----|------|----------|--------|--------|-------|
| C1 | Extend trial to 14 days | Conversion | 10 min | High | 1 |
| C3 | Remove confirm password | Conversion | 30 min | Low-Med | 1 |
| C4 | Implicit ToS consent | Conversion | 20 min | Low | 1 |
| C2 | Deferrable email verification | Conversion | 4-6 hrs | High | 2 |
| C5 | Combine onboarding steps 6+7 | Conversion | 3-4 hrs | Medium | 2 |
| C7 | Exit-intent discount | Conversion | 1 day | Med-High | 3 |
| C8 | Win-back offer | Conversion | 2 days | High | 3 |
| R2 | Weekly micro-challenges | Retention | 2-3 days | High | 4 |
| R4 | Year in Review | Retention | 2 days | High | 4 |
| R5 | Milestone content unlocks | Retention | 4-6 hrs | Medium | 4 |
| R6 | Smart notification timing | Retention | 4-6 hrs | Medium | 4 |

---

*Plan grounded in codebase analysis of specific files, interfaces, and patterns. All file paths and code snippets verified against the current codebase.*