# Feature Flag Rollout Plan

**Created:** Phase 4 — Integration Testing & Polish
**Status:** Ready for rollout

---

## Feature Flags Overview

| Flag Name | Feature | Default | Risk Level |
|-----------|---------|---------|------------|
| `food_search_ranking` | Personalized food search with frequency-based ranking | Disabled | 🟢 Low |
| `predictive_warmup` | Warm-up set generation from previous session history | Disabled | 🟢 Low |
| `combined_readiness` | Combined fatigue + readiness recovery score | Disabled | 🟡 Medium |
| `camera_barcode_scanner` | Camera-based barcode scanning (already exists) | Disabled | 🟢 Low |

---

## Rollout Order

### Stage 1: `food_search_ranking` (Enable First — Lowest Risk)

**Why first:** Pure backend re-ranking with graceful fallback. Zero UI changes when disabled. Left-join means zero-frequency items still appear.

**Enable steps:**
1. Verify `user_food_frequency` table exists: `SELECT count(*) FROM user_food_frequency`
2. Enable flag: `UPDATE feature_flags SET enabled = true WHERE name = 'food_search_ranking'`
3. Monitor: Search latency stays < 500ms (check backend logs)
4. Verify: Search results still return for users with no frequency data

**Rollback:** `UPDATE feature_flags SET enabled = false WHERE name = 'food_search_ranking'`

**Validation:**
- [ ] Search returns results for new users (no frequency data)
- [ ] Search returns results for existing users (with frequency data)
- [ ] Frequently logged items appear higher in results
- [ ] Search latency < 500ms

---

### Stage 2: `predictive_warmup` (Enable Second)

**Why second:** Pure function extension with backward compatibility. Existing callers unaffected. Only activates when user has previous performance data and no working weight entered.

**Enable steps:**
1. Enable flag: `UPDATE feature_flags SET enabled = true WHERE name = 'predictive_warmup'`
2. Verify: "Generate Warm-Up (based on last session)" button appears for exercises with history
3. Verify: Standard warm-up generation still works when working weight is entered

**Rollback:** `UPDATE feature_flags SET enabled = false WHERE name = 'predictive_warmup'`

**Validation:**
- [ ] Warm-up generates from previous performance when no working weight entered
- [ ] Warm-up generates normally when working weight is entered
- [ ] Button label changes appropriately
- [ ] Generated sets are reasonable (bar → 60% → 80%)

---

### Stage 3: `combined_readiness` (Enable Third — Most Visible)

**Why third:** Most visible change — replaces separate readiness badge with combined recovery score. Needs both readiness and fatigue systems working correctly.

**Enable steps:**
1. Verify `/readiness/combined` endpoint returns valid JSON: `curl /readiness/combined`
2. Enable flag: `UPDATE feature_flags SET enabled = true WHERE name = 'combined_readiness'`
3. Monitor: Dashboard load time stays < 2s
4. Verify: Recovery badge shows combined score with label

**Rollback:** `UPDATE feature_flags SET enabled = false WHERE name = 'combined_readiness'`

**Validation:**
- [ ] Combined score displays on dashboard (0-100 range)
- [ ] Volume multiplier shown (0.5-1.2 range)
- [ ] Labels correct: "Ready to Push" (≥70), "Train Smart" (≥40), "Recovery Day" (<40)
- [ ] Fallback to separate readiness score when flag disabled
- [ ] RecoveryInsightCard renders without errors

---

### Stage 4: `camera_barcode_scanner` (Verify Existing)

**Why last:** Already exists — just verify it still works after Phase 2 modal decomposition.

**Verify steps:**
1. Confirm flag exists in database
2. Test barcode scan → food selection → macro population on mobile
3. Test manual barcode entry on web
4. Verify scan history chips appear in FoodSearchPanel

**Validation:**
- [ ] Camera scanner opens on mobile
- [ ] Scanned barcode resolves to food item
- [ ] Manual entry works on web
- [ ] Scan history shows last 5 scanned items

---

## Monitoring Checklist

| Metric | Target | Tool |
|--------|--------|------|
| Dashboard load time | < 2s | React DevTools / Sentry |
| Food search latency | < 500ms | Backend logging |
| Combined score computation | < 100ms | Backend endpoint timing |
| Barcode lookup success rate | > 80% | `BarcodeResponse.source` logging |
| Feature flag evaluation | < 5ms | Flag service cache hit rate |

---

## Emergency Rollback

If any feature causes issues after enabling:

```sql
-- Disable specific flag
UPDATE feature_flags SET enabled = false WHERE name = '<flag_name>';

-- Disable all new flags at once
UPDATE feature_flags SET enabled = false
WHERE name IN ('food_search_ranking', 'predictive_warmup', 'combined_readiness');
```

Each feature is fully independent — disabling one does not affect others.

---

## Post-Rollout Verification

After all flags are enabled and stable for 48 hours:

1. [ ] All existing tests pass (`pytest tests/ -x` and `npx jest`)
2. [ ] No new error reports in monitoring
3. [ ] Dashboard load time stable < 2s
4. [ ] Food search latency stable < 500ms
5. [ ] User engagement metrics trending positive
6. [ ] No rollback needed for any flag
