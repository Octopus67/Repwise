# Repwise — Frontend Bug Fix Plan
### 7 Critical Bugs + 12 Suggestions from Comprehensive Audit
### Zero-Regression Approach

---

## Execution Strategy

All fixes organized into 3 batches by dependency. Each batch is independently auditable.

**Batch 1 — Structural Fixes (4 items, ~2 hours)**
Fixes that change component structure or remove code.
- BUG-1: FoodSearchPanel heart toggle (restructure row)
- BUG-4: LoginScreen dead code removal
- BUG-6: auth-validation.spec.ts stale tests
- BUG-7: UpgradeModal countdown interval fix

**Batch 2 — Conversion Flow Fixes (3 items, ~1.5 hours)**
Fixes to the premium/payment conversion path.
- BUG-2: TrialExpirationModal winback discount wiring
- BUG-3: TrialExpirationModal hardcoded discount text
- BUG-5: OAuth emailVerified missing
- SUG-1: TrialExpirationModal useEffect dependency

**Batch 3 — Polish & Hardening (11 items, ~2 hours)**
Suggestions that improve UX, accessibility, and robustness.
- SUG-2 through SUG-12

---

## Batch 1 — Structural Fixes

### BUG-1: FoodSearchPanel Heart Toggle Fires Both Actions
**Severity:** Critical | **File:** `app/components/nutrition/FoodSearchPanel.tsx`

**Root Cause:** `e.stopPropagation()` is a web-only DOM API. In React Native, nested `TouchableOpacity` components both fire their `onPress` handlers. Tapping the heart selects the food AND toggles favorite.

**Fix:** Restructure the search result row. Replace the outer `TouchableOpacity` with a `View`, and make the food info area and heart button separate touchable zones.

```tsx
// BEFORE (broken):
<TouchableOpacity onPress={() => handleFoodSelect(item)}>
  <View style={row}>
    <Text>{item.name}</Text>
    <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); toggleFavorite(item); }}>
      <Ionicons name="heart" />
    </TouchableOpacity>
  </View>
  <Text>{item.calories} kcal</Text>
</TouchableOpacity>

// AFTER (fixed):
<View style={[styles.resultItem, { borderBottomColor: c.border.subtle }]}>
  <TouchableOpacity onPress={() => handleFoodSelect(item)} activeOpacity={0.7} style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text>{item.name}</Text>
      <SourceBadge />
      {frequency badge}
    </View>
    <Text>{item.calories} kcal</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => toggleFavorite(item)} hitSlop={8}
    style={{ paddingLeft: 12, justifyContent: 'center' }}
    accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
    accessibilityRole="button">
    <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={c.accent.primary} />
  </TouchableOpacity>
</View>
```

**Key:** The outer element is now a `View` (not touchable). Two separate `TouchableOpacity` children handle their own press events independently. No propagation issue.

**Acceptance Criteria:**
- [ ] Tapping food info area selects the food (calls handleFoodSelect)
- [ ] Tapping heart toggles favorite (calls toggleFavorite) WITHOUT selecting food
- [ ] Heart icon updates immediately (optimistic)
- [ ] Accessibility labels on heart button

---

### BUG-4: LoginScreen Dead Code Removal
**Severity:** Critical | **File:** `app/screens/auth/LoginScreen.tsx`

**Root Cause:** The `EMAIL_NOT_VERIFIED` error handler was removed (C2) but all the UI/state for it remains.

**What to Remove:**
1. States: `unverifiedEmail`, `resendLoading`, `resendSuccess` (3 useState calls)
2. Function: `handleResendVerification` (~15 lines)
3. JSX: Unverified banner block (~15 lines)
4. Clears in handleLogin: `setUnverifiedEmail('')`, `setResendSuccess('')`
5. Prop: `onNavigateEmailVerification` from interface (only used in dead code)

**What to Keep:**
- The `onNavigateEmailVerification` prop on the interface IF it's used elsewhere. Check callers.

**Acceptance Criteria:**
- [ ] Zero references to `unverifiedEmail`, `resendLoading`, `resendSuccess`
- [ ] `handleResendVerification` removed
- [ ] Unverified banner JSX removed
- [ ] Login still works for both verified and unverified users
- [ ] TypeScript compiles clean

---

### BUG-6: auth-validation.spec.ts Stale Tests
**Severity:** Critical | **File:** `app/e2e/auth-validation.spec.ts`

**Root Cause:** 2 tests reference `register-tos-checkbox` which no longer exists after C4.

**Fix:**
1. Remove test: `'shows ToS checkbox on register screen'`
2. Rewrite test: `'register button disabled without ToS'` → `'register button disabled when fields empty'` (test that button is disabled when email/password are empty, enabled when filled)

**Acceptance Criteria:**
- [ ] Zero references to `tos-checkbox` in e2e tests
- [ ] Replacement test verifies button disabled state correctly
- [ ] All e2e tests pass

---

### BUG-7: UpgradeModal Countdown Interval Recreation
**Severity:** Critical | **File:** `app/components/premium/UpgradeModal.tsx`

**Root Cause:** `countdown` in useEffect dependency array causes interval destroy/recreate every second.

**Fix:** Remove `countdown` from deps. Self-terminate inside the callback.

```tsx
// BEFORE (600 interval cycles):
useEffect(() => {
  if (!showExitOffer || countdown <= 0) return;
  const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
  return () => clearInterval(timer);
}, [showExitOffer, countdown]);

// AFTER (1 interval, self-terminates):
useEffect(() => {
  if (!showExitOffer) return;
  const timer = setInterval(() => {
    setCountdown(prev => {
      if (prev <= 1) { clearInterval(timer); return 0; }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(timer);
}, [showExitOffer]);
```

**Acceptance Criteria:**
- [ ] Exactly 1 interval created when exit offer shows
- [ ] Countdown ticks correctly from 600 to 0
- [ ] Interval self-terminates at 0
- [ ] Cleanup runs on unmount

---

## Batch 2 — Conversion Flow Fixes

### BUG-2 + BUG-3: TrialExpirationModal Winback Discount
**Severity:** Critical | **Files:** `TrialExpirationModal.tsx`, `DashboardScreen.tsx`

**Root Cause:** `onUpgrade` prop is `() => void` — can't pass discount info. "Claim 40% Off" calls `onUpgrade` which opens standard UpgradeModal at full price. Button text hardcoded.

**Fix:** Change `onUpgrade` to accept an optional plan_id parameter. When winback offer exists, pass `'yearly_winback_discount'` through.

```tsx
// TrialExpirationModal.tsx
interface Props {
  onUpgrade: (planId?: string) => void;  // Changed from () => void
}

// CTA button:
<Button
  title={hasOffer ? `Claim ${offer.discount_pct}% Off` : 'Upgrade to Premium'}
  onPress={() => hasOffer ? onUpgrade('yearly_winback_discount') : onUpgrade()}
  style={styles.cta}
/>
```

```tsx
// DashboardScreen.tsx (or wherever TrialExpirationModal is rendered):
<TrialExpirationModal
  onUpgrade={(planId) => {
    setShowTrialExpiration(false);
    if (planId) {
      // Direct subscribe with discount plan
      api.post('payments/subscribe', { plan_id: planId, region, currency });
    } else {
      openUpgrade();  // Standard upgrade flow
    }
  }}
/>
```

**Also fix SUG-1:** Change `[remaining > 0]` to a derived boolean:
```tsx
const isCountingDown = remaining > 0;
useEffect(() => { ... }, [isCountingDown]);
```

**Acceptance Criteria:**
- [ ] "Claim X% Off" uses dynamic discount_pct from offer
- [ ] Clicking CTA sends `yearly_winback_discount` plan_id to backend
- [ ] Standard upgrade shown when no offer
- [ ] Countdown timer dependency is a named boolean

---

### BUG-5: OAuth emailVerified Missing
**Severity:** Critical | **Files:** `RegisterScreen.tsx`, `LoginScreen.tsx`

**Fix:** Add `emailVerified: true` to both social login handlers.

```tsx
// RegisterScreen.tsx handleSocialSuccess:
setAuth(
  { id: parseJwtSub(tokens.access_token), email: '', role: 'user', emailVerified: true },
  ...
);

// LoginScreen.tsx handleSocialSuccess:
onLoginSuccess(
  { id: parseJwtSub(tokens.access_token), email: '', emailVerified: true },
  ...
);
```

**Acceptance Criteria:**
- [ ] OAuth users have `emailVerified: true` in store
- [ ] VerificationBanner does NOT show for OAuth users
- [ ] Email/password users still get `emailVerified: false` on register

---

## Batch 3 — Polish & Hardening

### SUG-2: Extract RestDayCard IIFE to named variable
**File:** `DashboardScreen.tsx`
Replace IIFE with `const workoutSection = useMemo(...)` or a simple variable above the JSX return.

### SUG-3: Integrate WeeklyChallengeCard into dashboard refresh lifecycle
**File:** `WeeklyChallengeCard.tsx`
Accept `challenges` as a prop instead of fetching internally. Move the API call to `useDashboardData`.

### SUG-4: Note about 15 API calls (no code change)
Document in a TODO comment. Future optimization: BFF endpoint.

### SUG-5: Auto-scroll to exit offer when it appears
**File:** `UpgradeModal.tsx`
Add `scrollViewRef` and call `scrollViewRef.current?.scrollToEnd()` when `showExitOffer` becomes true.

### SUG-6: Reset showExitOffer when countdown reaches 0
**File:** `UpgradeModal.tsx`
In the countdown callback, when `prev <= 1`, also `setShowExitOffer(false)`.

### SUG-7: Persist VerificationBanner dismiss in AsyncStorage
**File:** `DashboardScreen.tsx`
Use AsyncStorage key `@repwise:verify_dismissed` with 24h TTL.

### SUG-8: Pass theme colors as prop to TemplateCard
**File:** `TemplatePicker.tsx`
Pass `c` from parent `TemplatePicker` (which uses `useThemeColors()`) as a prop to `TemplateCard`.

### SUG-9: Add accessibilityLabel to share button
**File:** `TemplatePicker.tsx`
Add `accessibilityLabel="Share template" accessibilityRole="button"` to the share TouchableOpacity.

### SUG-10: Add console.warn to toggleFavorite catch
**File:** `FoodSearchPanel.tsx`
Change `catch {}` to `catch (err) { console.warn('[FoodSearch] toggle favorite failed:', err?.message); }`

### SUG-11: Fix stale onboarding store comment
**File:** `app/store/onboardingSlice.ts`
Change `// 1-9` to `// 1-10` or remove the comment.

### SUG-12: Note about comparison card truncation (no code change)
Test on 320px width. If truncation occurs, add `numberOfLines={2}` to result text.

---

## Summary

| Batch | Items | Effort | Files Changed |
|-------|-------|--------|---------------|
| Batch 1 — Structural | 4 critical bugs | ~2 hours | 4 files |
| Batch 2 — Conversion | 3 critical + 1 suggestion | ~1.5 hours | 4 files |
| Batch 3 — Polish | 11 suggestions | ~2 hours | 8 files |
| **Total** | **19 items** | **~5.5 hours** | **~12 files** |

### Zero-Regression Checklist
- [ ] TypeScript: 0 errors after each batch
- [ ] All e2e tests pass (no stale selectors)
- [ ] Login works: email/password + Google + Apple
- [ ] Registration works: 2 fields + passive consent
- [ ] Onboarding: 10 steps, dots correct, TDEE+comparison renders
- [ ] Dashboard: sparkline, calendar, rest day card, challenges, verification banner
- [ ] UpgradeModal: exit offer shows on first dismiss, countdown works, discount plan sent
- [ ] TrialExpirationModal: winback offer with dynamic discount, countdown, correct plan_id
- [ ] FoodSearchPanel: heart toggle doesn't select food, favorites work
- [ ] OAuth users: no verification banner

---

*Plan grounded in exact code analysis of every affected file.*
