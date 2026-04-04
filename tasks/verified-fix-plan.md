# Repwise Verified Bug Fix Plan

> Generated from code-verified audit. 14 of 33 original findings were false positives.
> Only confirmed, code-verified bugs are included below.

---

## Executive Summary

| Severity | Count | Phase |
|----------|-------|-------|
| High     | 1     | 1     |
| Medium   | 2 (1 downgraded) | 2     |
| Low      | 4 (1 closed as FP) | 3     |
| Minor    | 4     | 4     |
| **Total**| **11 confirmed** |       |

Estimated total effort: **Medium (1–2 days)** across all phases.

---

## Dependency Graph

```
H1 (IDOR) ─── standalone, no deps
M1 (TOCTOU) ── standalone, no deps
M2 (depth) ─── standalone, no deps
M3 (middleware) ── standalone, no deps
L1 (audit log) ── standalone (may already be fixed — verify first)
L2 (empty query) ── standalone, no deps
L3 (key sanitize) ── standalone, no deps
L4 (retry) ──── standalone, no deps
L5 (.env) ───── standalone, no deps
MINOR M1–M4 ── standalone, no deps
```

No inter-bug dependencies. All fixes can be parallelized. Recommended order is by severity for risk management.

---

## Phase 1: High Priority (Security)

### H1: food_database/service.py:532 — IDOR on custom food items

**Severity:** HIGH
**Root cause:** `get_by_id(food_item_id, user_id=None)` skips ownership check for custom food items when `user_id` is not provided. The condition `item.created_by is not None and user_id is not None and item.created_by != user_id` means passing `user_id=None` bypasses the guard entirely.

**File:** `src/modules/food_database/service.py` line 538
**Current code:**
```python
if item.created_by is not None and user_id is not None and item.created_by != user_id:
    raise NotFoundError("Food item not found")
```

**Implementation steps:**

1. Change the ownership check at line 538 to reject custom items when `user_id` is `None`:
```python
if item.created_by is not None and (user_id is None or item.created_by != user_id):
    raise NotFoundError("Food item not found")
```

2. Verify all callers:
   - `router.py:208` — `service.get_by_id(food_item_id, user_id=user.id)` ✅ passes user_id
   - `service.py:902` — `self.get_by_id(food_item_id)` — admin-only `update_food_item`, called from router behind `require_role(UserRole.ADMIN)`. This is intentional — admins should access any item. **No change needed** but add a comment:
```python
# Admin bypass: no user_id means ownership check is skipped (admin-only callers)
item = await self.get_by_id(food_item_id)
```

Wait — with the new logic, the admin call at line 902 will now FAIL for custom items because `user_id=None` will trigger the rejection. We need to handle this.

**Revised approach:** Add an `allow_any_owner` parameter for admin callers:
```python
async def get_by_id(
    self, food_item_id: uuid.UUID, user_id: Optional[uuid.UUID] = None, *, allow_any_owner: bool = False
) -> FoodItem:
    """Retrieve a single food item by ID."""
    stmt = select(FoodItem).where(FoodItem.id == food_item_id)
    stmt = FoodItem.not_deleted(stmt)
    result = await self.db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise NotFoundError("Food item not found")
    if not allow_any_owner and item.created_by is not None and (user_id is None or item.created_by != user_id):
        raise NotFoundError("Food item not found")
    return item
```

Then update the admin caller at line 902:
```python
item = await self.get_by_id(food_item_id, allow_any_owner=True)
```

**Ripple effects:** Admin update endpoint now explicitly opts into cross-user access. All other callers default to strict ownership.
**Regression risk:** LOW — only tightens access. Admin path explicitly preserved.
**Testing:**
- Manual: Try fetching another user's custom food item as a regular user → expect 404
- Manual: Admin update of custom food item → expect success
- Unit test: Call `get_by_id(custom_item_id, user_id=None)` → expect `NotFoundError`
- Unit test: Call `get_by_id(custom_item_id, user_id=wrong_user)` → expect `NotFoundError`
- Unit test: Call `get_by_id(custom_item_id, allow_any_owner=True)` → expect success

**Effort:** Quick (<1h)

---

## Phase 2: Medium Priority

### M1: api.ts — TOCTOU race on isRefreshing flag

**Severity:** MEDIUM
**Root cause:** Two concurrent 401 responses (or proactive refreshes) can both read `isRefreshing === false` before either sets it to `true`, causing duplicate refresh calls. The `isRefreshing` boolean at line 81 is not atomic — JavaScript is single-threaded but `await` yields, creating interleaving windows.

**File:** `app/services/api.ts` lines 55–57 (request interceptor) and lines 107–113 (response interceptor)

**Implementation steps:**

1. Replace the boolean flag + queue pattern with a single shared Promise:

```typescript
// Replace these:
// let isRefreshing = false;
// let pendingQueue: Array<{...}> = [];

let refreshPromise: Promise<string> | null = null;

function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refresh = await getRefreshToken!();
      if (!refresh) throw new Error('No refresh token');
      const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
        refresh_token: refresh,
      });
      await onTokensRefreshed!(data.access_token, data.refresh_token);
      proactiveRefreshFailed = false;
      return data.access_token as string;
    } catch (err) {
      await onRefreshFailed?.();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
```

2. Update the request interceptor (proactive refresh) to use `doRefresh()`:
```typescript
if (token && getRefreshToken && onTokensRefreshed && !proactiveRefreshFailed) {
  const exp = getJwtExp(token);
  if (exp && exp - Date.now() / 1000 < 30) {
    try {
      token = await doRefresh();
    } catch {
      console.warn('[api] Proactive refresh failed');
      proactiveRefreshFailed = true;
    }
  }
}
```

3. Update the response interceptor (401 retry) to use `doRefresh()`:
```typescript
async (error: AxiosError) => {
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  if (error.response?.status !== 401 || originalRequest._retry) {
    return Promise.reject(error);
  }
  if (!getRefreshToken || !onTokensRefreshed) {
    return Promise.reject(error);
  }
  originalRequest._retry = true;
  try {
    const newToken = await doRefresh();
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return api(originalRequest);
  } catch (refreshError) {
    return Promise.reject(refreshError);
  }
}
```

4. Remove `isRefreshing`, `pendingQueue`, and `processPendingQueue` — they're replaced by the Promise-based approach.

**Ripple effects:** All token refresh paths now go through `doRefresh()`. Concurrent callers naturally coalesce on the same Promise.
**Regression risk:** MEDIUM — core auth interceptor. Test thoroughly.
**Testing:**
- Manual: Open app, let token expire, trigger 2+ simultaneous API calls → verify only 1 refresh request fires (check network tab)
- Manual: Force proactive refresh with near-expiry token → verify single refresh
- Manual: Verify normal login/logout flow still works

**Effort:** Short (1–2h)

---

### M2: validators.py:24 — Off-by-one in depth check

**Severity:** MEDIUM
**Root cause:** `if depth >= MAX_JSON_DEPTH` with `MAX_JSON_DEPTH=4` rejects at depth 4, meaning only 3 nesting levels are allowed (depth 0, 1, 2, 3). The intent is to allow 4 levels.

**File:** `src/shared/validators.py` line 24
**Current code:**
```python
if depth >= MAX_JSON_DEPTH:
    raise ValueError(f"JSON nesting too deep (max {MAX_JSON_DEPTH} levels)")
```

**Implementation:**
```python
if depth > MAX_JSON_DEPTH:
    raise ValueError(f"JSON nesting too deep (max {MAX_JSON_DEPTH} levels)")
```

**Ripple effects:** None — only relaxes the depth limit by 1 level. Used by `food_database/schemas.py` and `coaching/schemas.py` validators.
**Regression risk:** LOW
**Testing:**
- Unit test: 4-level nested dict should pass validation
- Unit test: 5-level nested dict should fail validation
- Verify existing tests still pass

**Effort:** Quick (<15min)

---

### M3: main.py:207-229 — Middleware ordering (CORS vs SecurityHeaders)

**Severity:** MEDIUM → **DOWNGRADED TO VERIFY-THEN-CLOSE**
**Root cause (claimed):** CORS preflight responses don't get security headers because CORS middleware short-circuits before SecurityHeaders processes the response.

**Verified finding:** After reading `src/middleware/security_headers.py`, the middleware adds headers on the **response path** (after `await call_next(request)`). Since SecurityHeadersMiddleware is outermost relative to CORSMiddleware in the Starlette stack, it DOES process CORS preflight responses. The security headers are correctly applied to all responses including OPTIONS preflight.

**Current middleware order (last added = outermost):**
1. Inner: Rate limit, body size, logging, timeout
2. HTTPS redirect (production only)
3. CORSMiddleware (handles preflight, short-circuits inner middlewares)
4. SecurityHeadersMiddleware (adds headers on response path — processes ALL responses including CORS)
5. TrustedHostMiddleware (outermost, production only)

**Status:** FALSE POSITIVE — no fix needed. The ordering is intentionally correct.

**Action:** Add a comment in `main.py` explaining the intentional ordering:


**Effort:** Quick (<5min, comment only)

---

## Phase 3: Low Priority

### L1: coaching/service.py:187 — Audit log records wrong old status

**Severity:** LOW → **CLOSED AS FALSE POSITIVE**
**Root cause (claimed):** `request.status` is mutated before audit log captures old value.

**Verified finding:** The code correctly captures `old_status = request.status` BEFORE mutating `request.status = CoachingRequestStatus.CANCELLED`. The audit log uses the `old_status` variable (immutable enum value copy), not `request.status`. The implementation is correct.



**Status:** FALSE POSITIVE — no fix needed.

**Effort:** None

---

### L2: training/router.py:59 — Empty string query returns all exercises

**Severity:** LOW
**Root cause:** `q: str = Query(default='', max_length=200)` allows empty string. In `search_exercises()`, `"".split()` returns `['']`, and `'' in any_string` is always `True`, so all exercises match.

**File:** `src/modules/training/router.py` line 60, `src/modules/training/exercises.py` line 46

**Implementation:** Fix in the service layer (exercises.py) — return empty list for empty/whitespace-only queries:
```python
def search_exercises(
    query: str,
    muscle_group: Optional[str] = None,
    equipment: Optional[str] = None,
    category: Optional[str] = None,
) -> list[dict]:
    words = query.lower().split()
    if not query.strip() and not muscle_group and not equipment and not category:
        return []
    results = [ex for ex in EXERCISES if all(w in ex["name"].lower() for w in words)] if query.strip() else list(EXERCISES)
    # ... rest of filters unchanged
```

Actually, simpler — just handle the empty query case:
```python
words = query.lower().split()
if not words or words == ['']:
    results = list(EXERCISES) if (muscle_group or equipment or category) else []
else:
    results = [ex for ex in EXERCISES if all(w in ex["name"].lower() for w in words)]
```

This way: empty query with no filters → empty list. Empty query with filters → filter all exercises.

**Ripple effects:** Frontend search behavior changes — empty search box returns nothing instead of everything.
**Regression risk:** LOW
**Testing:** Manual — search with empty string, verify empty results. Search with filter only, verify filtered results.

**Effort:** Quick (<30min)

---

### L3: storage.py:104 — No key sanitization in generate_read_url

**Severity:** LOW
**Root cause:** `generate_read_url(key)` does `f"{settings.CDN_BASE_URL}/{key}"` with no validation. If a malicious key like `../../etc/passwd` or `javascript:alert(1)` were passed, it could produce unexpected URLs.

**File:** `src/shared/storage.py` line 104

**Mitigating factors:** Keys are generated by `generate_upload_url()` which uses `_sanitize_filename()` and prefixes with `users/{user_id}/`. The `r2_key` stored in the database comes from this path. Direct injection is unlikely unless the database is compromised.

**Implementation:**
```python
def generate_read_url(key: str) -> str:
    """Return the public CDN URL for a stored object."""
    if '..' in key or key.startswith('/') or '//' in key:
        raise ValidationError("Invalid storage key")
    return f"{settings.CDN_BASE_URL}/{key}"
```

**Ripple effects:** None — defense-in-depth only.
**Regression risk:** LOW
**Testing:** Unit test with malicious keys (`../`, `//`, absolute paths) → expect ValidationError

**Effort:** Quick (<15min)

---

### L4: photoUpload.ts — Retry only handles 403

**Severity:** LOW
**Root cause:** The retry loop only retries on 403 (expired presigned URL). Network errors thrown by `FileSystem.uploadAsync` and 5xx server errors are not retried.

**File:** `app/services/photoUpload.ts` lines 28–44

**Implementation:**
```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  const { data } = await api.post('progress-photos/upload-url', {
    filename,
    content_type: contentType,
  });

  try {
    const uploadResult = await FileSystem.uploadAsync(data.upload_url, localUri, {
      httpMethod: 'PUT',
      headers: { 'Content-Type': contentType },
    });

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return { r2Key: data.key };
    }

    // Retry on 403 (expired URL) or 5xx (server error)
    if (attempt === 0 && (uploadResult.status === 403 || uploadResult.status >= 500)) continue;

    throw new Error(`Upload failed with status ${uploadResult.status}`);
  } catch (err) {
    // Retry on network errors (first attempt only)
    if (attempt === 0 && !(err instanceof Error && err.message.startsWith('Upload failed'))) continue;
    throw err;
  }
}
throw new Error('Upload failed after retry');
```

**Ripple effects:** None — only adds resilience.
**Regression risk:** LOW
**Testing:** Manual — test upload with poor network conditions. Verify retry behavior.

**Effort:** Quick (<30min)

---

### L5: .env.example — Missing production variables

**Severity:** LOW
**Root cause:** `.env.example` is missing several variables defined in `settings.py`.

**File:** `.env.example`

**Missing variables (compared to `src/config/settings.py`):**
- `APP_NAME` (has default, optional)
- `JWT_ALGORITHM` (has default, optional)
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (has default, optional)
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS` (has default, optional)
- `LOGIN_RATE_LIMIT_THRESHOLD` (has default, optional)
- `LOGIN_RATE_LIMIT_WINDOW_SECONDS` (has default, optional)
- `USDA_API_KEY` (important — validated in production)
- `FCM_SERVER_KEY` (push notifications)
- `APNS_KEY_ID` (push notifications)
- `APNS_TEAM_ID` (push notifications)
- `APNS_AUTH_KEY_PATH` (push notifications)

**Implementation:** Add missing variables to `.env.example`:
```env
# App Configuration
APP_NAME=Repwise
DEBUG=true

# JWT Configuration
JWT_SECRET=your-jwt-secret-here-min-32-chars
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Rate Limiting
RATE_LIMIT_RPM=100
LOGIN_RATE_LIMIT_THRESHOLD=5
LOGIN_RATE_LIMIT_WINDOW_SECONDS=900

# USDA FoodData Central
USDA_API_KEY=DEMO_KEY

# Push Notifications — Firebase Cloud Messaging
FCM_SERVER_KEY=

# Push Notifications — Apple Push Notification Service
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_AUTH_KEY_PATH=
```

**Ripple effects:** None — documentation only.
**Regression risk:** NONE
**Testing:** N/A

**Effort:** Quick (<15min)

---

## Phase 4: Minor / Design Improvements

### MINOR M1: feature_flags/router.py — Flag name pattern too restrictive

**Root cause:** Pattern `r'^[a-z0-9_]{1,100}$'` doesn't allow hyphens. Flag names like `dark-mode` would be rejected.

**File:** `src/modules/feature_flags/router.py` line 23

**Implementation:**
```python
flag_name: str = Path(..., pattern=r'^[a-z0-9_-]{1,100}$'),
```

**Regression risk:** NONE — only relaxes validation
**Effort:** Quick (<5min)

---

### MINOR M2: coaching/schemas.py — document_url prefix-only validation

**Root cause:** `pattern=r'^https?://'` only validates the URL starts with `http://` or `https://`. Values like `https://` (no host) or `https://   ` pass validation.

**File:** `src/modules/coaching/schemas.py` line 72

**Implementation:** Replace with Pydantic's built-in URL type:
```python
from pydantic import HttpUrl

class DocumentUploadRequest(BaseModel):
    document_url: HttpUrl = Field(..., max_length=2048)
```

Or if string type is needed downstream:
```python
from pydantic import field_validator
import re

class DocumentUploadRequest(BaseModel):
    document_url: str = Field(..., min_length=10, max_length=2048)

    @field_validator('document_url')
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not re.match(r'^https?://[^\s/$.?#].[^\s]*$', v):
            raise ValueError('Invalid URL format')
        return v
```

**Regression risk:** LOW
**Effort:** Quick (<15min)

---

### MINOR M3: food_database/schemas.py — micro_nutrients no key/value validation

**Root cause:** `micro_nutrients: Optional[dict[str, float]]` accepts any string key and any float value. No whitelist of valid micronutrient names, no range validation on values.

**File:** `src/modules/food_database/schemas.py` lines 30, 52

**Implementation:** Add a validator:
```python
VALID_MICRONUTRIENTS = {
    "fiber_g", "sugar_g", "sodium_mg", "potassium_mg", "calcium_mg",
    "iron_mg", "vitamin_a_iu", "vitamin_c_mg", "vitamin_d_iu",
    "vitamin_b12_mcg", "zinc_mg", "magnesium_mg", "cholesterol_mg",
    "saturated_fat_g", "trans_fat_g", "omega3_g", "omega6_g",
}

@field_validator('micro_nutrients')
@classmethod
def validate_micro_nutrients(cls, v: dict[str, float] | None) -> dict[str, float] | None:
    if v is None:
        return v
    v = validate_json_size(v)
    for key, val in v.items():
        if key not in VALID_MICRONUTRIENTS:
            raise ValueError(f"Unknown micronutrient: {key}")
        if val < 0:
            raise ValueError(f"Micronutrient value must be >= 0: {key}={val}")
    return v
```

**Note:** The whitelist should be reviewed with the product team. Adding unknown micronutrients from USDA/OFF imports could break if the whitelist is too strict. Consider a warning log instead of rejection for unknown keys.

**Regression risk:** MEDIUM — could reject valid data from external food databases
**Effort:** Short (1h including whitelist research)

---

### MINOR M4: photoUpload.ts — Content type from parameter not file

**Root cause:** `contentType` parameter defaults to `'image/jpeg'` and is used for the upload `Content-Type` header. It's not derived from the actual file.

**File:** `app/services/photoUpload.ts` line 13

**Assessment:** The `ALLOWED_TYPES` check at line 18 validates the content type is one of jpeg/png/webp. The caller is responsible for passing the correct type. This is a design choice, not a bug — deriving from file extension is equally unreliable.

**Implementation (optional):**
```typescript
function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  return map[ext ?? ''] ?? 'image/jpeg';
}

export async function uploadProgressPhoto(
  localUri: string,
  filename: string,
  contentType?: string,
): Promise<UploadResult> {
  const resolvedType = contentType ?? inferContentType(filename);
  // ... rest uses resolvedType
```

**Regression risk:** LOW
**Effort:** Quick (<15min)

---

## Post-Implementation Verification Checklist

- [ ] **H1:** Attempt to fetch another user's custom food item without auth → 404
- [ ] **H1:** Admin can still update any food item
- [ ] **H1:** Public food items (created_by=None) still accessible to all
- [ ] **M1:** Trigger 3+ concurrent API calls with expired token → only 1 refresh request in network log
- [ ] **M1:** Normal login/logout flow works
- [ ] **M1:** Proactive refresh (token near expiry) works
- [ ] **M2:** 4-level nested JSON passes validation
- [ ] **M2:** 5-level nested JSON fails validation
- [ ] **M3:** `curl -X OPTIONS` returns both CORS and security headers (or document why not)
- [ ] **L1:** Verify audit log entries show correct old/new status (or close as false positive)
- [ ] **L2:** Empty search query returns empty list
- [ ] **L2:** Search with only filters returns filtered results
- [ ] **L3:** `generate_read_url("../../etc/passwd")` raises ValidationError
- [ ] **L4:** Photo upload retries on network error
- [ ] **L5:** All settings.py variables present in .env.example
- [ ] **All:** Existing test suite passes with no regressions
- [ ] **All:** Manual smoke test of core flows (login, food search, photo upload, coaching)

---

## Effort Summary

| Phase | Estimated Effort |
|-------|-----------------|
| Phase 1 (High) | Quick (<1h) |
| Phase 2 (Medium) | Short (2–3h) |
| Phase 3 (Low) | Short (1–2h) |
| Phase 4 (Minor) | Short (1–2h) |
| **Total** | **Medium (~1.5 days)** |

---

## False Positives Record

The following 14 items from the original 33-item audit were verified as NOT bugs:

| # | Original Finding | Why It's Not a Bug |
|---|------------------|--------------------|
| 1 | Sharing IDOR (1.1) | Ownership check EXISTS in sharing service |
| 2 | Logout token cleanup (1.2) | Token deletion ordering is CORRECT |
| 3 | onRefreshFailed await (1.3) | `secureDelete` IS properly awaited |
| 4 | r2_key validation (1.5) | Double-validated with regex + `startswith` check |
| 5 | RegisterScreen hardcoded tokens (2.3) | Uses `TOKEN_KEYS` constants, not hardcoded strings |
| 6 | CDN URL hardcoded (2.5) | Uses `settings.CDN_BASE_URL` already |
| 7 | FTS5 migration (launch blocker) | SQLite dialect guards are PRESENT |
| 8 | food_database description max_length (3.4) | `max_length=2000` EXISTS on the field |
| 9 | ProgressPhotosScreen web handling (3.7) | `Platform.OS` check EXISTS |
| 10 | parseJwtSub duplication (3.9) | Properly centralized in `jwtUtils.ts` |
| 11 | .gitignore .env patterns (4.7) | `.env` patterns properly configured |
| 12 | Barcode regex (4.3) | Correct 8–14 digit validation |
| 13 | LoginRequest.password min_length (4.1) | `min_length=1` is intentional — don't block existing users with short passwords |
| 14 | Password error message (3.8) | Revealing password policy in error messages is standard UX practice |

| 15 | Middleware ordering CORS vs SecurityHeaders (M3) | SecurityHeadersMiddleware adds headers on response path (after `call_next`), so it processes ALL responses including CORS preflight. Ordering is correct. |
| 16 | Coaching audit log wrong old status (L1) | `old_status` is captured BEFORE mutation. Audit log uses the captured variable, not the mutated field. |

**Lesson:** Always verify audit findings against actual code before planning fixes. 48% false positive rate in this audit (16 of 33).
