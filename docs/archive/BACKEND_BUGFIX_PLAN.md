# Repwise — Backend Bug Fix Plan
### 7 Critical Bugs + 9 Suggestions from Comprehensive Audit
### SDE-4 Level: Zero-Regression, Defense-in-Depth

---

## Execution Strategy

3 batches by blast radius. Each batch independently auditable.

**Batch 1 — Data Integrity & Safety (5 items, ~2 hours)**
Fixes that prevent data corruption, crashes, or security issues.
- BBUG-1: Midnight hour wrapping in workout reminders
- BBUG-2: ZoneInfo crash on invalid timezone
- BBUG-3: Manual freeze date validation + duplicate protection
- BBUG-4: try_auto_freeze IntegrityError handling
- BBUG-5: try_auto_freeze race condition on availability check

**Batch 2 — Type Safety & API Contracts (4 items, ~1.5 hours)**
- BBUG-6: login_email return type regression
- BBUG-7: pr_type hardcoded to "weight"
- BSUG-1: Winback endpoint response_model
- BSUG-2: /auth/me response_model

**Batch 3 — Robustness & Hardening (8 items, ~2 hours)**
- BSUG-3: Winback timezone-naive guard
- BSUG-4: Shared constants for prices/discounts
- BSUG-5: Backdated entry guard in _update_streak
- BSUG-6: Remove explicit db.commit() from challenges router
- BSUG-7: ProgressUpdate value validation
- BSUG-8: toggle_favorite with_for_update
- BSUG-9: Reports router narrower exception handling
- BSUG-10: is_in_quiet_hours start==end guard

---

## Batch 1 — Data Integrity & Safety

### BBUG-1: Midnight Hour Wrapping in Workout Reminders
**Severity:** Critical | **File:** `src/jobs/workout_reminders.py`

**Root Cause:** `abs(current_hour - reminder_hour) > 1` doesn't handle circular arithmetic. When `reminder_hour=23` and `current_hour=0`, `abs(0-23)=23` instead of the correct distance of 1. Users who train late at night or early morning never receive reminders.

**Fix:**
```python
# BEFORE (broken at midnight):
if abs(current_hour - reminder_hour) > 1:
    continue

# AFTER (circular distance):
hour_diff = min(abs(current_hour - reminder_hour), 24 - abs(current_hour - reminder_hour))
if hour_diff > 1:
    continue
```

**Why this works:** For any two hours on a 24h clock, the shortest distance is `min(|a-b|, 24-|a-b|)`. Examples:
- `current=0, reminder=23` → `min(23, 1)` = 1 ✅
- `current=23, reminder=0` → `min(23, 1)` = 1 ✅
- `current=9, reminder=8` → `min(1, 23)` = 1 ✅
- `current=14, reminder=8` → `min(6, 18)` = 6 ✅ (skipped correctly)

**Acceptance Criteria:**
- [ ] Users with preferred hour 23 get reminders at hour 0
- [ ] Users with preferred hour 0 get reminders at hour 23
- [ ] Normal cases (e.g., preferred=9, current=8) still work
- [ ] Large gaps (e.g., preferred=9, current=18) still skip

---

### BBUG-2: ZoneInfo Crash on Invalid Timezone
**Severity:** Critical | **File:** `src/jobs/workout_reminders.py`

**Root Cause:** `ZoneInfo(user_tz)` raises `KeyError`/`ZoneInfoNotFoundError` if `user_tz` is an invalid string (e.g., `"foo"`, `"UTC+5"`, empty string). This crashes the per-user iteration in `_send_reminders` and crashes `is_in_quiet_hours` entirely (no try/except there).

**Fix:** Create a safe helper:
```python
def _safe_tz(user_tz: str | None) -> timezone | ZoneInfo:
    """Return a timezone object, falling back to UTC on invalid input."""
    if not user_tz:
        return timezone.utc
    try:
        return ZoneInfo(user_tz)
    except (KeyError, Exception):
        logger.warning("Invalid timezone '%s', falling back to UTC", user_tz)
        return timezone.utc
```

Replace ALL `ZoneInfo(user_tz) if user_tz else timezone.utc` calls with `_safe_tz(user_tz)`. There are 2 call sites: `is_in_quiet_hours` and `_send_reminders`.

**Acceptance Criteria:**
- [ ] Invalid timezone string logs warning and falls back to UTC
- [ ] None timezone falls back to UTC
- [ ] Valid timezone works normally
- [ ] Job doesn't crash on bad data

---

### BBUG-3: Manual Freeze Date Validation + Duplicate Protection
**Severity:** Critical | **File:** `src/modules/achievements/router.py`

**Root Cause:** The `POST /streak/freeze` endpoint has no date bounds validation (users can freeze future dates or ancient dates) and no duplicate protection (POSTing same date twice hits UniqueConstraint → unhandled IntegrityError → 500).

**Fix:**
```python
# After parsing freeze_date:
today = date.today()
if freeze_date > today:
    return ManualFreezeResponse(success=False, message="Cannot freeze future dates.")
if freeze_date < today - timedelta(days=7):
    return ManualFreezeResponse(success=False, message="Cannot freeze dates older than 7 days.")

# Wrap the insert in IntegrityError handling:
from sqlalchemy.exc import IntegrityError
try:
    db.add(freeze)
    await db.flush()
except IntegrityError:
    await db.rollback()
    return ManualFreezeResponse(success=False, message="This date is already frozen.")
```

**Acceptance Criteria:**
- [ ] Future dates rejected with friendly message
- [ ] Dates >7 days ago rejected
- [ ] Duplicate date returns friendly message (not 500)
- [ ] Valid dates within window still work

---

### BBUG-4: try_auto_freeze IntegrityError Handling
**Severity:** Critical | **File:** `src/modules/achievements/streak_freeze_service.py`

**Root Cause:** `try_auto_freeze` creates StreakFreeze records without handling the `uq_streak_freeze_user_date` UniqueConstraint. Concurrent requests can crash.

**Fix:** Wrap the creation loop + flush in IntegrityError handling:
```python
from sqlalchemy.exc import IntegrityError

async def try_auto_freeze(session, user_id, last_active, current_date) -> bool:
    # ... existing availability check ...
    try:
        for day_offset in range(1, gap_days + 1):
            freeze_date = last_active + timedelta(days=day_offset)
            month_str = freeze_date.strftime("%Y-%m")
            session.add(StreakFreeze(user_id=user_id, freeze_date=freeze_date, month=month_str))
        await session.flush()
        return True
    except IntegrityError:
        await session.rollback()
        return False  # Another request already froze these dates
```

**Acceptance Criteria:**
- [ ] Concurrent auto-freeze attempts don't crash
- [ ] First request succeeds, second returns False gracefully
- [ ] Streak update continues correctly after failed freeze

---

### BBUG-5: try_auto_freeze Race Condition on Availability
**Severity:** Critical | **File:** `src/modules/achievements/streak_freeze_service.py`

**Root Cause:** `get_available_freezes` and the subsequent `session.add` are not atomic. Two concurrent requests can both see `available=1` and both insert, resulting in >1 freeze per month.

**Fix:** Combined with BBUG-4 — the IntegrityError handling on the UniqueConstraint `uq_streak_freeze_user_date` acts as the concurrency guard. Even if two requests both see `available=1`, only one can successfully insert (the other hits the unique constraint and returns False). This is the "optimistic locking" pattern.

Additionally, add a count check AFTER the flush to verify we haven't exceeded the monthly limit:
```python
# After successful flush, verify monthly count
count_stmt = select(func.count()).where(
    StreakFreeze.user_id == user_id,
    StreakFreeze.month == month_str,
)
count = (await session.execute(count_stmt)).scalar()
if count > MAX_FREEZES_PER_MONTH:
    await session.rollback()
    return False
```

**Acceptance Criteria:**
- [ ] Monthly limit of 1 freeze enforced even under concurrent requests
- [ ] Post-insert count verification catches edge cases

---

## Batch 2 — Type Safety & API Contracts

### BBUG-6: login_email Return Type Regression
**Severity:** Critical | **File:** `src/modules/auth/service.py`

**Root Cause:** `login_email` changed from returning typed `AuthTokens` to raw `dict`. The `-> dict` annotation breaks type safety for any direct callers.

**Fix:** Return a proper typed object:
```python
from src.modules.auth.schemas import LoginResponse

async def login_email(self, email: str, password: str) -> LoginResponse:
    user = await self._get_user_by_email(email)
    if user is None or not _verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    tokens = _generate_tokens(user.id)
    return LoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        email_verified=user.email_verified,
    )
```

**Acceptance Criteria:**
- [ ] Return type is `LoginResponse` (not dict)
- [ ] Router's `response_model=LoginResponse` still works
- [ ] Tests pass with typed return

---

### BBUG-7: pr_type Always Hardcoded to "weight"
**Severity:** Critical | **File:** `src/modules/training/service.py`

**Root Cause:** `PersonalRecord` is always created with `pr_type="weight"`. The model supports weight/reps/volume/e1rm but only weight is ever written. The frontend shows PR type badges that will always say "weight".

**Design Decision:** For now, document this as intentional (weight PRs only) and add a comment. The PR detector (`pr_detector.py`) only detects weight-based PRs. Extending to reps/volume/e1rm requires changes to the detector, which is out of scope for this bug fix batch.

**Fix:** Add explicit documentation + a TODO:
```python
# PR detector currently only detects weight-based PRs.
# TODO: Extend PRDetector to detect reps PRs (most reps at a weight),
#       volume PRs (weight * reps), and e1RM PRs.
for pr in prs:
    self.session.add(
        PersonalRecord(
            user_id=user_id,
            exercise_name=pr.exercise_name,
            pr_type="weight",  # Only weight PRs detected currently
            ...
        )
    )
```

**Acceptance Criteria:**
- [ ] Comment documents the limitation
- [ ] TODO added for future extension
- [ ] No functional change (weight-only is correct for current detector)

---

### BSUG-1: Winback Endpoint Response Model
**File:** `src/modules/payments/router.py`

**Fix:** Create `WinbackOfferResponse` schema and set as response_model:
```python
# In schemas.py:
class WinbackOfferResponse(BaseModel):
    eligible: bool
    discount_pct: Optional[int] = None
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    deadline: Optional[str] = None
    remaining_seconds: Optional[int] = None

# In router.py:
@router.get("/winback-offer", response_model=WinbackOfferResponse)
```

---

### BSUG-2: /auth/me Response Model
**File:** `src/modules/auth/router.py`

**Fix:** Create or extend a schema for the /auth/me response:
```python
class CurrentUserResponse(BaseModel):
    id: str
    email: str
    role: str
    email_verified: bool

@router.get("/me", response_model=CurrentUserResponse)
```

---

## Batch 3 — Robustness & Hardening

### BSUG-3: Winback Timezone-Naive Guard
**File:** `src/modules/payments/winback_service.py`

**Fix:** Add defensive timezone handling:
```python
period_end = sub.current_period_end
if period_end.tzinfo is None:
    period_end = period_end.replace(tzinfo=timezone.utc)
elapsed = (now - period_end).total_seconds()
```

### BSUG-4: Shared Constants for Prices/Discounts
**Fix:** Create `src/modules/payments/constants.py`:
```python
ANNUAL_PRICE_USD = 79.99
WINBACK_DISCOUNT_PCT = 40
WINBACK_WINDOW_HOURS = 48
EXIT_DISCOUNT_PCT = 30
```
Import from both `winback_service.py` and `trial_expiration.py`.

### BSUG-5: Backdated Entry Guard in _update_streak
**File:** `src/modules/achievements/engine.py`

**Fix:** Add early return for backdated entries:
```python
if activity_date < last_active:
    return []  # Backdated entry — don't modify streak
```

### BSUG-6: Remove Explicit db.commit() from Challenges Router
**File:** `src/modules/challenges/router.py`

**Fix:** Remove `await db.commit()` from both endpoints (lines 50 and 60). The `get_db` dependency handles commit/rollback.

### BSUG-7: ProgressUpdate Value Validation
**File:** `src/modules/challenges/router.py`

**Fix:** Add Field constraint:
```python
class ProgressUpdate(BaseModel):
    value: int = Field(ge=0, le=10000)
```

### BSUG-8: toggle_favorite with_for_update
**File:** `src/modules/food_database/service.py`

**Fix:** Add row-level locking:
```python
stmt = select(UserFoodFrequency).where(...).with_for_update()
```

### BSUG-9: Reports Router Narrower Exception Handling
**File:** `src/modules/reports/router.py`

**Fix:** Let known errors propagate, only catch unexpected:
```python
try:
    report = await service.get_monthly_report(...)
except (NotFoundError, ValidationError):
    raise  # Let FastAPI handle these
except Exception:
    logger.exception(...)
    raise HTTPException(status_code=500, ...)
```

### BSUG-10: is_in_quiet_hours start==end Guard
**File:** `src/jobs/workout_reminders.py`

**Fix:** Treat equal start/end as disabled:
```python
if start == end:
    return False  # No quiet hours configured
```

---

## Summary

| Batch | Items | Effort | Risk |
|-------|-------|--------|------|
| Batch 1 — Data Integrity | 5 critical | ~2 hours | Medium (touches streak logic) |
| Batch 2 — Type Safety | 2 critical + 2 suggestions | ~1.5 hours | Low (type changes only) |
| Batch 3 — Hardening | 8 suggestions | ~2 hours | Low (defensive additions) |
| **Total** | **16 items** | **~5.5 hours** | |

### Zero-Regression Checklist
- [ ] All 23 trial tests pass
- [ ] All 18 auth unit tests pass
- [ ] All 4 workout reminder tests pass
- [ ] Streak freeze: concurrent requests don't crash
- [ ] Manual freeze: future dates rejected, duplicates handled
- [ ] Login returns typed LoginResponse
- [ ] Winback endpoint has response_model
- [ ] Midnight hour wrapping: hour 23→0 gives distance 1
- [ ] Invalid timezone: falls back to UTC, doesn't crash
- [ ] TypeScript frontend: 0 errors (no API contract changes)

---

*Plan grounded in exact code analysis. Every fix includes before/after code and mathematical proof where applicable.*
