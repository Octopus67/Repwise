# Medium & Low Priority Bug Fixes - Implementation Plan

**Start Time:** 2026-03-09 14:35  
**Status:** IN PROGRESS

---

## Remaining Issues (30 total)

### Medium Priority (18 issues)
**Phase 1 - Login/Auth (3 issues)**
- [ ] M1: Password requirements too strict (5 rules → length-only)
- [ ] M2: Social login buried below email/password
- [ ] M3: Unverified users locked out with no recovery

**Phase 2 - Nutrition (4 issues)**
- [ ] M4: Grams-only recipe builder (add cups/tbsp/oz)
- [ ] M5: No photo-based food logging
- [ ] M6: Food search doesn't prioritize frequently logged
- [ ] M7: No barcode scanner integration

**Phase 3 - Workout (5 issues)**
- [ ] M8: Plate calculator not accessible (no trigger)
- [ ] M9: RPE picker not integrated (plain TextInput)
- [ ] M10: Set type selector not integrated
- [ ] M11: Warm-up generation UX (requires weight first)
- [ ] M12: Missing drag-to-reorder for exercises

**Phase 4 - Algorithms (2 issues)**
- [ ] M13: Coaching service hardcodes sex='male'
- [ ] M14: Fatigue/readiness systems independent (no cross-reference)

**Phase 5 - Profile (3 issues)**
- [ ] M15: 1500ms recalculate debounce too sluggish
- [ ] M16: No avatar upload (only initials)
- [ ] M17: Timezone/region/currency free-text fields

**Phase 6 - Cross-Cutting (1 issue)**
- [ ] M18: DashboardScreen god component (30+ useState)

### Low Priority (12 issues)
**Phase 1 (2 issues)**
- [ ] L1: Email verification friction (can be deferred)
- [ ] L2: Password reset flow could be smoother

**Phase 2 (2 issues)**
- [ ] L3: Recipe builder no image upload
- [ ] L4: Micronutrient gaps (no RDA warnings)

**Phase 3 (3 issues)**
- [ ] L5: Progress dots visual-only (no accessible alternative)
- [ ] L6: PR celebration never shown (flag never set)
- [ ] L7: Finish flow has duplicate confirmation sheets

**Phase 4 (2 issues)**
- [ ] L8: WNS audit doc references old K=1.69
- [ ] L9: Legacy volume detail endpoint doesn't support WNS

**Phase 5 (2 issues)**
- [ ] L10: Progress photos data loss risk (local only)
- [ ] L11: Notification settings uses 30-min increments only

**Phase 6 (1 issue)**
- [ ] L12: Health check endpoint is shallow (no DB ping)

---

## Implementation Strategy

Given the scope (30 issues), I'll focus on **high-impact Medium issues** that improve UX significantly:

### Priority Order
1. **Phase 3 Medium** (M8-M12) - Workout UX improvements (5 issues)
2. **Phase 2 Medium** (M4) - Recipe builder units (1 issue)
3. **Phase 5 Medium** (M15-M17) - Profile UX (3 issues)
4. **Phase 1 Medium** (M1-M2) - Auth UX (2 issues)
5. **Phase 6 Medium** (M18) - Dashboard refactor (1 issue)
6. **Low Priority** - Quick wins only (selected issues)

---

## Phase Execution Log

