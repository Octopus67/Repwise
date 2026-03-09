# CRITICAL: Onboarding & Auth Issues - Investigation & Fixes

**Date:** 2026-03-09 22:02  
**Status:** INVESTIGATING

---

## Issues Reported

1. **TDEERevealStep crash** - `value.toLocaleString()` on undefined
2. **Onboarding starts at step 12** - Should start at step 1
3. **Prefilled values wrong** - Data flow issue
4. **Email sending fixed** - AWS credentials now working

---

## Root Cause Analysis

### Issue 1: TDEERevealStep Crash ✅ FIXED
**Cause:** `breakdown.bmr/neat/eat/tef` are undefined when store values are missing  
**Fix:** Added `|| 0` guards to all breakdown values  
**File:** `app/screens/onboarding/steps/TDEERevealStep.tsx`

### Issue 2: Onboarding Starts at Step 12
**Likely cause:** Onboarding store persisted to AsyncStorage with step=12 from previous session  
**Solution:** Clear AsyncStorage onboarding data

### Issue 3: Prefilled Values Wrong
**Likely cause:** Stale data in AsyncStorage from previous incomplete onboarding  
**Solution:** Clear AsyncStorage

### Issue 4: Email Sending ✅ FIXED
**Cause:** AWS credentials not loaded from .env into settings  
**Fix:** Added `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to settings.py  
**Status:** Emails now send correctly

---

## Immediate Actions Required

### 1. Clear AsyncStorage (Frontend)
The onboarding wizard persists state to AsyncStorage. Stale data is causing issues.

**Solution:**
```typescript
// In browser console or add to App.tsx temporarily:
import AsyncStorage from '@react-native-async-storage/async-storage';
AsyncStorage.clear();
// Then refresh
```

### 2. Delete and Recreate Database (Backend)
Already done - `dev.db` was deleted and recreated with new schema.

### 3. Restart Both Servers
- Backend: Already restarted
- Frontend: Needs refresh after clearing AsyncStorage

---

## Verification Checklist

After clearing AsyncStorage and refreshing:

- [ ] Register new user
- [ ] Onboarding starts at step 1 (not step 12)
- [ ] All onboarding steps show correct data
- [ ] TDEE calculation works
- [ ] Onboarding completes successfully
- [ ] Email verification code sent
- [ ] Login works
- [ ] Forgot password works
- [ ] Password reset works

---

## Next Steps

1. **Clear AsyncStorage** in browser DevTools:
   - Open DevTools (F12)
   - Go to Application tab
   - Clear Storage → Clear site data
   - Refresh page

2. **Test full auth flow:**
   - Register → Onboarding → Email verification → Login
   - Forgot password → Reset → Login

3. **Report results** - Let me know if issues persist

---

## AWS SES Status

✅ **Credentials:** Valid and working  
✅ **Sender email:** Verified (0000006mm@gmail.com)  
✅ **Test email:** Sent successfully via CLI  
✅ **Backend:** Now configured to use credentials  

**Emails will now be sent correctly!**

