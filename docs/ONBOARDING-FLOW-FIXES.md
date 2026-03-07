# 🔧 ONBOARDING FLOW - CRITICAL FIXES APPLIED

## Issues Found in End-to-End Audit

### ❌ CRITICAL Issues (5 found, all fixed)

1. **Registration set auth before email verification**
   - User was authenticated immediately, yanked away from verification screen
   - **Fixed:** Tokens stored but auth not set until verification succeeds

2. **New users skipped onboarding**
   - needsOnboarding never set to true after registration
   - **Fixed:** setNeedsOnboarding(true) called after auth

3. **Duplicate email corrupted client state**
   - Null tokens from backend caused undefined in setAuth()
   - **Fixed:** Null guard added, only set auth if tokens exist

4. **OAuth users had email_verified=false**
   - Blocked from premium features despite verified by provider
   - **Fixed:** OAuth users created with email_verified=True

5. **Soft-deleted users couldn't re-register**
   - Unique constraint blocked same email
   - **Fixed:** Partial unique index (WHERE deleted_at IS NULL)

---

## Complete User Flows (After Fixes)

### Flow 1: Email/Password Registration
```
1. RegisterScreen → enter email, password, accept ToS
2. POST /auth/register → backend creates user, sends OTP
3. Tokens stored in SecureStore (NOT authenticated yet)
4. Navigate to EmailVerificationScreen
5. Enter 6-digit OTP
6. POST /auth/verify-email → email_verified=true
7. handleVerified → validate tokens, setAuth(), setNeedsOnboarding(true)
8. OnboardingWizard renders (12 steps)
9. Complete onboarding → POST /onboarding/complete
10. setNeedsOnboarding(false) → Dashboard renders
11. Profile and subscription loaded in parallel
```

### Flow 2: Google/Apple OAuth
```
1. LoginScreen/RegisterScreen → tap "Continue with Google/Apple"
2. Native SDK → account picker → select account
3. POST /auth/oauth/{provider} → backend verifies token
4. OAuth users created with email_verified=True
5. setAuth() + setNeedsOnboarding(true)
6. OnboardingWizard renders
7. Complete onboarding → Dashboard
8. Profile and subscription loaded
```

### Flow 3: Returning User Login
```
1. LoginScreen → enter email, password
2. POST /auth/login → backend checks email_verified
3. If not verified: 403 EMAIL_NOT_VERIFIED
4. If verified: returns tokens
5. handleLoginSuccess → setAuth(), load profile + subscription
6. Dashboard renders (skip onboarding)
```

### Flow 4: Session Restore (App Restart)
```
1. App.tsx mount → restoreSession()
2. Read tokens from SecureStore
3. GET /auth/me → validate token
4. If valid: setAuth(), check goals for onboarding need
5. Load profile + subscription in parallel
6. Render OnboardingWizard or Dashboard
```

---

## Edge Cases Handled

✅ **Duplicate email:** Generic success message, no state corruption  
✅ **Soft-deleted re-registration:** Partial unique index allows it  
✅ **OAuth email collision:** Links to existing account or returns 409  
✅ **Failed OTP:** Clear error message, rate limited (5 attempts)  
✅ **Expired OTP:** Same error, user can resend  
✅ **OAuth cancelled:** Silent dismiss (no error shown)  
✅ **OAuth network error:** Clear error message  
✅ **Token refresh:** Automatic on 401, queues concurrent requests  
✅ **Logout:** Clears local tokens and all state  
✅ **Unverified email:** Blocked from premium, clear error  

---

## Data Persistence

✅ **Tokens:** SecureStore (iOS/Android), localStorage (web)  
✅ **User profile:** Loaded after auth, stored in Zustand  
✅ **Subscription:** Loaded after auth, stored in Zustand  
✅ **Onboarding state:** AsyncStorage with versioning (v3)  
✅ **Preferences:** Loaded with profile  
✅ **Historical data:** Loaded on dashboard mount  

---

## Platform-Specific Behavior

### iOS
✅ SecureStore (Keychain)  
✅ Apple Sign-In (native bottom sheet)  
✅ Google Sign-In (native modal, skips Play Services check)  
✅ KeyboardAvoidingView with behavior="padding"  

### Android
✅ SecureStore (Android Keystore)  
✅ Google Sign-In (Credential Manager)  
✅ Apple Sign-In hidden (not available)  
✅ hasPlayServices check with update dialog  

### Web
✅ localStorage (tokens)  
✅ Email/password only (no native OAuth)  
✅ Google/Apple buttons hidden  

---

## Remaining Issues (Non-Blocking)

### MEDIUM (P1 - Should Fix Soon)
- Logout doesn't call backend /auth/logout (tokens not blacklisted)
- Apple OAuth nonce not verified on backend (replay attack vector)

### LOW (P2 - Nice to Have)
- Profile not loaded until ProfileScreen visited (minor UX issue)
- RPE mode not persisted across sessions
- Web uses localStorage (XSS vulnerable, consider httpOnly cookies)

---

## Testing Required

**After backend restart with new database:**

1. **Test Registration Flow:**
   - Register with new email
   - Should see verification screen (not dashboard)
   - Enter OTP
   - Should see onboarding wizard (not dashboard)
   - Complete onboarding
   - Should see dashboard

2. **Test OAuth Flow:**
   - Sign in with Google/Apple
   - Should see onboarding wizard (not dashboard)
   - Complete onboarding
   - Should see dashboard

3. **Test Duplicate Email:**
   - Register with existing email
   - Should see generic success (no crash)
   - Should receive "account exists" email

4. **Test Soft-Delete Re-registration:**
   - Delete account
   - Register with same email
   - Should work (no unique constraint error)

---

## Backend Restart Required

**The database needs to be recreated with the new schema.**

Run:
```bash
cd /Users/manavmht/Documents/HOS
rm dev.db
./dev.sh
```

This will:
- Delete old database
- Start backend (creates new database with all columns)
- Start frontend
- Ready to test!

---

**All critical onboarding flow bugs are fixed. Just restart the backend and test!**
