---
inclusion: manual
---

# Key Algorithms

## 1. Weekly Net Stimulus (WNS) Volume Engine

**Files:** `src/modules/training/wns_engine.py`, `app/utils/wnsCalculator.ts`

### Formula
```
Weekly Net Stimulus = Σ(session_stimulus) - Σ(atrophy_between_sessions)
```

### Stimulating Reps Per Set
Only the last ~5 reps before failure drive hypertrophy:
- Heavy load (≥85% 1RM): ALL reps are stimulating (up to 5)
- RIR 0 (failure): 5 stim reps
- RIR 1: 4 stim reps
- RIR 2: 3 stim reps
- RIR 3: 2 stim reps
- RIR 4+: 0 stim reps (junk volume)
- **Default when no RPE/RIR logged: RIR 2 (RPE 8)**

### Diminishing Returns
```python
factor = 1.0 / (1.0 + 0.96 * set_index)
# K=0.96 — updated from 1.69 based on revised meta-analysis fitting
```

### Muscle Attribution
- Direct muscle: coefficient 1.0 (bench → chest)
- Secondary muscle: coefficient 0.5 (bench → triceps)
- Source: exercise catalog `muscle_group` + `secondary_muscles` fields

### Atrophy Model
```python
atrophy_days = max(0, gap_days - 2.0)  # 48h stimulus duration
daily_rate = 3.0 / 7.0  # 3 maintenance sets per week
atrophy = atrophy_days * daily_rate
```

### Constants (MUST match between Python and TypeScript)
| Constant | Value | Source |
|----------|-------|--------|
| MAX_STIM_REPS | 5.0 | Beardsley (2019) |
| DEFAULT_RIR | 2.0 | Default (RPE 8) — updated from 3.0 to better reflect typical training effort |
| DIMINISHING_K | 0.96 | Updated from 1.69 based on revised meta-analysis fitting |
| STIMULUS_DURATION | 2.0 days | MPS elevation research |
| MAINTENANCE_SETS | 3.0/week | Beardsley recommendation |

### Feature Flag
`wns_engine` — when ON, `/training/analytics/muscle-volume` returns WNS data with `engine: "wns"`. When OFF, returns legacy set-counting with `engine: "legacy"`.

---

## 2. Fatigue Detection Engine

**File:** `src/modules/training/fatigue_engine.py`

### Composite Score (0-100)
```
score = regression_weight(0.35) × regression_component
      + volume_weight(0.30) × volume_component
      + frequency_weight(0.20) × frequency_component
      + nutrition_weight(0.15) × nutrition_component
```

### Components
- **Regression**: Consecutive e1RM declines (Epley formula). 3+ declines = max component.
- **Volume**: weekly_sets / MRV. Capped at 1.0.
- **Frequency**: weekly_frequency / 5. Capped at 1.0.
- **Nutrition**: 1.0 - compliance when compliance < 0.8. Zero when eating enough.

### Deload Trigger
Score > 70 → generate deload suggestion with specific exercise and decline %.

---

## 3. Micronutrient Dashboard

**File:** `src/modules/nutrition/micro_dashboard_service.py`

### Nutrient Quality Score (0-100)
- Average of min(rda_pct, 100) across all 27 nutrients
- Sodium and cholesterol are INVERTED (lower is better)
- Score = 0 when no data logged (not misleading partial score)

### Deficiency Detection
- Flags nutrients below 50% RDA on ≥50% of tracked days
- Excludes sodium and cholesterol (low is good)
- Sorted by deficit percentage (worst first)

### 27 Tracked Nutrients
Vitamins (13): A, C, D, E, K, B1-B7, B9, B12
Minerals (10): Ca, Fe, Zn, Mg, K, Se, Na, P, Mn, Cu
Fatty Acids (2): Omega-3, Omega-6
Other (2): Cholesterol, Fibre

---

## 4. Adaptive Macro Engine

**File:** `src/modules/adaptive/sync_engine.py`

Adjusts daily calorie/macro targets based on:
- Training volume (volume multiplier 0.7-1.5x)
- Day classification (training vs rest)
- Goal (cut/bulk/maintain)
- Weekly weight trend vs calorie intake
