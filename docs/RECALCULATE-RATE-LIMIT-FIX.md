# Recalculate Rate Limit Issue - Analysis & Fix

## Issue

**User Experience:** User adjusts multiple profile settings (protein target, meals per day, etc.) and gets 429 "Too many requests" error.

**Root Cause:** 
- Rate limit: **1 request per 60 seconds** per user
- BodyStatsSection has 5 separate save handlers (height, weight, body fat, activity, all)
- Each field edit triggers a recalculate API call
- Editing 2+ fields within 60 seconds hits the rate limit

**Code Location:**
- Backend: `src/modules/user/service.py` line 41-43
- Frontend: `app/components/profile/BodyStatsSection.tsx` (5 save handlers)

---

## Analysis

### Current Rate Limit
```python
_recalculate_attempts: dict[str, float] = {}
RECALCULATE_COOLDOWN_SECONDS = 60
```

**Why 60 seconds?**
- Prevents abuse/spam
- Recalculate is computationally expensive (runs adaptive engine)
- In-memory tracking (TODO: move to Redis for multi-worker)

### Frontend Behavior
User edits profile in AdvancedSettingsSection:
1. Changes protein target → calls recalculate
2. Changes meals per day → calls recalculate (within 60s)
3. Gets 429 error

**Each setting change triggers a separate recalculate call.**

---

## Solutions

### Option A: Increase Rate Limit (Quick Fix)
**Change:** 60 seconds → 10 seconds  
**Pros:** Simple, allows multiple edits  
**Cons:** Still possible to hit limit with rapid edits  
**Effort:** 1 line change  

### Option B: Debounce Frontend Calls (Better UX)
**Change:** Batch multiple field changes, send one recalculate  
**Pros:** Better UX, fewer API calls, respects rate limit  
**Cons:** More complex implementation  
**Effort:** 2-3 hours  

### Option C: Remove Rate Limit for Authenticated Users (Risky)
**Change:** Only rate limit unauthenticated or remove entirely  
**Pros:** No user friction  
**Cons:** Abuse vector, expensive computation  
**Effort:** 1 line change  

### Option D: Smart Rate Limiting (Best)
**Change:** Allow burst of 3 requests, then 1 per minute  
**Pros:** Handles legitimate multi-field edits, still prevents abuse  
**Cons:** More complex logic  
**Effort:** 1-2 hours  

---

## Recommended Solution

**Implement Option D (Smart Rate Limiting):**

```python
# Allow burst of 3 requests, then 1 per minute
RECALCULATE_BURST_LIMIT = 3
RECALCULATE_BURST_WINDOW = 10  # seconds
RECALCULATE_SUSTAINED_COOLDOWN = 60  # seconds

# Track: [(timestamp, count_in_window)]
_recalculate_attempts: dict[str, list[float]] = {}

def check_recalculate_rate_limit(user_id: str):
    now = time.time()
    attempts = _recalculate_attempts.get(user_id, [])
    
    # Remove attempts older than burst window
    recent = [t for t in attempts if now - t < RECALCULATE_BURST_WINDOW]
    
    # Check burst limit
    if len(recent) >= RECALCULATE_BURST_LIMIT:
        # Check if last attempt was within sustained cooldown
        if now - recent[-1] < RECALCULATE_SUSTAINED_COOLDOWN:
            raise RateLimitedError(...)
    
    # Record attempt
    recent.append(now)
    _recalculate_attempts[user_id] = recent
```

**This allows:**
- User edits 3 fields quickly (within 10 seconds) ✅
- After 3 edits, must wait 60 seconds ✅
- Prevents spam/abuse ✅

---

## Alternative: Frontend Debouncing

**If backend rate limit stays at 60s:**

Add debouncing in AdvancedSettingsSection:
```typescript
const debouncedRecalculate = useMemo(
  () => debounce(async (payload) => {
    await api.post('users/recalculate', payload);
  }, 1000), // Wait 1s after last change
  []
);
```

**This batches rapid changes into one API call.**

---

## Immediate Fix (5 minutes)

**Quick fix for testing:**

Change rate limit to 10 seconds:
```python
RECALCULATE_COOLDOWN_SECONDS = 10
```

**File:** `src/modules/user/service.py` line 43

This allows user to edit multiple fields without frustration.

---

## My Recommendation

**For MVP:** Change to 10 seconds (immediate fix)  
**For Production:** Implement smart rate limiting (burst of 3, then 1/min)  

**Shall I implement the immediate fix (10 seconds) or the smart rate limiting (burst)?**
