# Color System Audit — Hypertrophy OS

> Source: `app/theme/tokens.ts` → `colors` object
> Reference: Token Baseline (`audit-output/token-baseline.md`)
> Requirements: 3.1–3.7

---

## 1. Color Inventory

### 1.1 Backgrounds (`colors.bg`) — 4 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.bg.base` | `#0A0E13` | App.tsx (root bg), ErrorBoundary.tsx, CustomExerciseForm.tsx, DashboardScreen.tsx, LogsScreen.tsx, AnalyticsScreen.tsx, ProfileScreen.tsx, all screen root containers |
| `colors.bg.surface` | `#12171F` | Card.tsx (flat variant), ModalContainer.tsx (web/mobile sheet), FilterPill.tsx (inactive), ReportCard.tsx, FatigueBreakdownModal.tsx, UpgradeModal.tsx, CoachingModeSelector.tsx, BottomTabNavigator.tsx (tab bar), GoalsSection.tsx, BodyStatsSection.tsx, PlanEditFlow.tsx, PhotoComparison.tsx, RecipeScalingModal.tsx, TemplateRow.tsx |
| `colors.bg.surfaceRaised` | `#1A2029` | Card.tsx (raised variant), Skeleton.tsx, EditableField.tsx, Tooltip.tsx, SetupBanner.tsx, MealBuilder.tsx (inputs, buttons), WeeklyCheckinCard.tsx (progress bar bg, inputs), UpgradeModal.tsx (plan cards), PeriodizationCalendar.tsx, RecentExercises.tsx, CustomExerciseForm.tsx (inputs), PreferencesSection.tsx (track), BodyStatsSection.tsx, PlanEditFlow.tsx, PhotoComparison.tsx (placeholder), TimelineSlider.tsx, ModalContainer.tsx (drag handle) |
| `colors.bg.overlay` | `rgba(0,0,0,0.6)` | UpgradeModal.tsx (overlay), ModalContainer.tsx (backdrop), BarcodeScanner.tsx (scan overlay) |

### 1.2 Borders (`colors.border`) — 4 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.border.subtle` | `rgba(255,255,255,0.06)` | Card.tsx (flat variant), MealSlotDiary.tsx, MealSlotGroup.tsx, WeeklySummaryCard.tsx, StrengthLeaderboard.tsx, FatigueAlertCard.tsx, ReadinessGauge.tsx, RecompDashboardCard.tsx, DashboardScreen.tsx, AnalyticsScreen.tsx, CoachingScreen.tsx, LogsScreen.tsx, ExercisePickerScreen.tsx, OnboardingWizard.tsx (progress track), BodyCompositionStep.tsx, LifestyleStep.tsx, BodyBasicsStep.tsx, DietStyleStep.tsx, SummaryStep.tsx, NutritionReportScreen.tsx, PeriodizationCalendar.tsx, CustomExerciseForm.tsx, TimelineSlider.tsx, TemplateRow.tsx |
| `colors.border.default` | `rgba(255,255,255,0.08)` | Card.tsx (raised/outlined variants), Button.tsx (secondary variant), Tooltip.tsx, EditableField.tsx, CoachingModeSelector.tsx, WeeklyCheckinCard.tsx (secondary button), GoalsSection.tsx, BodyStatsSection.tsx, PlanEditFlow.tsx, PreferencesSection.tsx, FastTrackStep.tsx, IntentStep.tsx, GoalStep.tsx, DietStyleStep.tsx, TDEERevealStep.tsx, BodyMeasurementsStep.tsx, SummaryStep.tsx |
| `colors.border.hover` | `rgba(255,255,255,0.12)` | DateScroller.tsx (today cell) |
| `colors.border.focus` | `#06B6D4` | Not found in direct usage (same as accent.primary) |

### 1.3 Text (`colors.text`) — 4 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.text.primary` | `#F1F5F9` | App.tsx (nav theme), all screen titles, card titles, data values, input text — used in 50+ files across screens and components |
| `colors.text.secondary` | `#94A3B8` | Labels, descriptions, secondary info — WeeklySummaryCard.tsx, CoachingModeSelector.tsx, WeeklyCheckinCard.tsx, HeatMapLegend.tsx, FatigueBreakdownModal.tsx, PeriodizationCalendar.tsx, all onboarding steps, profile sections |
| `colors.text.muted` | `#64748B` | Captions, timestamps, empty states — WeeklySummaryCard.tsx, StrengthLeaderboard.tsx, BodyHeatMap.tsx, CoachingModeSelector.tsx, WeeklyCheckinCard.tsx, FilterPill.tsx (inactive), WeekNavigator.tsx, ReportCard.tsx, RecipeScalingModal.tsx |
| `colors.text.inverse` | `#0B0F14` | WeeklyCheckinCard.tsx (primary button text), used on accent/light backgrounds |

### 1.4 Accent (`colors.accent`) — 3 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.accent.primary` | `#06B6D4` | Button.tsx (primary bg), FilterPill.tsx (active border/text), App.tsx (ActivityIndicator), CoachingModeSelector.tsx (selected icon), WeeklyCheckinCard.tsx (progress fill, primary button bg), PeriodizationCalendar.tsx (fab), RecipeScalingModal.tsx (active pill, preview title), BodyBasicsStep.tsx (active pill border), PrepSundayFlow.tsx |
| `colors.accent.primaryHover` | `#0891B2` | Not found in direct component usage (defined in tokens for hover states) |
| `colors.accent.primaryMuted` | `rgba(6,182,212,0.12)` | FilterPill.tsx (active bg), PeriodizationCalendar.tsx (fab bg), BodyBasicsStep.tsx (active pill bg) |

### 1.5 Semantic (`colors.semantic`) — 8 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.semantic.positive` | `#22C55E` | TodaySummaryRow (count > 0), RPEBadge.tsx (green), various success indicators |
| `colors.semantic.positiveSubtle` | `rgba(34,197,94,0.12)` | RPEBadge.tsx (green bg) |
| `colors.semantic.negative` | `#EF4444` | Button.tsx (danger border/text), RPEBadge.tsx (red), MealBuilder.tsx (remove btn fallback) |
| `colors.semantic.negativeSubtle` | `rgba(239,68,68,0.12)` | Button.tsx (danger bg), RPEBadge.tsx (red bg) |
| `colors.semantic.warning` | `#F59E0B` | RPEBadge.tsx (yellow), AchievementCard.tsx (streak) |
| `colors.semantic.warningSubtle` | `rgba(245,158,11,0.12)` | RPEBadge.tsx (yellow bg) |
| `colors.semantic.overTarget` | `#6B8FBF` | Used in BudgetBar for over-target state |
| `colors.semantic.overTargetSubtle` | `rgba(107,143,191,0.15)` | Used in BudgetBar for over-target background |

### 1.6 Premium (`colors.premium`) — 2 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.premium.gold` | `#D4AF37` | PremiumBadge.tsx, UpgradeBanner.tsx, UpgradeModal.tsx, PRBanner.tsx |
| `colors.premium.goldSubtle` | `rgba(212,175,55,0.12)` | PremiumBadge.tsx (bg), UpgradeBanner.tsx (bg) |

### 1.7 Gradient (`colors.gradient`) — 3 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.gradient.premiumCta` | `['#06B6D4', '#0E7490']` | UpgradeModal.tsx (CTA button gradient) |
| `colors.gradient.start` | `#06B6D4` | Available for linear gradient start points |
| `colors.gradient.end` | `#0E7490` | Available for linear gradient end points |

### 1.8 Chart (`colors.chart`) — 5 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.chart.calories` | `#06B6D4` | TrendLineChart.tsx, ExpenditureTrendCard.tsx |
| `colors.chart.positiveTrend` | `#22C55E` | TrendLineChart.tsx (positive trend lines) |
| `colors.chart.negativeDev` | `#EF4444` | TrendLineChart.tsx (negative deviation) |
| `colors.chart.warningThreshold` | `#F59E0B` | TrendLineChart.tsx (threshold lines) |
| `colors.chart.neutral` | `#6B7280` | TrendLineChart.tsx (baseline/neutral) |

### 1.9 Macro (`colors.macro`) — 8 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.macro.calories` | `#06B6D4` | MacroRingsRow.tsx, BudgetBar.tsx, LearnScreen.tsx (Nutrition category), ArticleCardCompact.tsx |
| `colors.macro.caloriesSubtle` | `rgba(6,182,212,0.10)` | MacroRingsRow.tsx (ring track bg) |
| `colors.macro.protein` | `#22C55E` | MacroRingsRow.tsx, BudgetBar.tsx, LearnScreen.tsx (Training category) |
| `colors.macro.proteinSubtle` | `rgba(34,197,94,0.10)` | MacroRingsRow.tsx (ring track bg) |
| `colors.macro.carbs` | `#F59E0B` | MacroRingsRow.tsx, BudgetBar.tsx, LearnScreen.tsx (Recovery category) |
| `colors.macro.carbsSubtle` | `rgba(245,158,11,0.10)` | MacroRingsRow.tsx (ring track bg) |
| `colors.macro.fat` | `#F472B6` | MacroRingsRow.tsx, BudgetBar.tsx, LearnScreen.tsx (Mindset/Recomp category) |
| `colors.macro.fatSubtle` | `rgba(244,114,182,0.10)` | MacroRingsRow.tsx (ring track bg) |

### 1.10 Heatmap (`colors.heatmap`) — 8 values

| Token Path | Value | Usage Locations |
|---|---|---|
| `colors.heatmap.untrained` | `#1E293B` | BodyHeatMap.tsx, HeatMapLegend.tsx |
| `colors.heatmap.belowMev` | `#22C55E` | BodyHeatMap.tsx, HeatMapLegend.tsx |
| `colors.heatmap.optimal` | `#06B6D4` | BodyHeatMap.tsx, HeatMapLegend.tsx |
| `colors.heatmap.nearMrv` | `#F59E0B` | BodyHeatMap.tsx, HeatMapLegend.tsx |
| `colors.heatmap.aboveMrv` | `#EF4444` | BodyHeatMap.tsx, HeatMapLegend.tsx |
| `colors.heatmap.silhouetteStroke` | `rgba(255,255,255,0.08)` | BodySilhouette.tsx |
| `colors.heatmap.regionBorder` | `rgba(255,255,255,0.12)` | BodyHeatMap.tsx (region outlines) |
| `colors.heatmap.regionOpacity` | `0.85` | BodyHeatMap.tsx (fill opacity) |


---

## 2. WCAG AA Contrast Ratios

### Methodology

Contrast ratios computed using the WCAG 2.1 relative luminance formula:
1. Linearize sRGB: if `c ≤ 0.04045` then `c/12.92`, else `((c+0.055)/1.055)^2.4`
2. Relative luminance: `L = 0.2126×R + 0.7152×G + 0.0722×B`
3. Contrast ratio: `(L1+0.05)/(L2+0.05)` where `L1 > L2`

WCAG AA thresholds: **4.5:1** for normal text (<18pt or <14pt bold), **3:1** for large text (≥18pt or ≥14pt bold).

### Luminance Values

| Color | Hex | sRGB (R,G,B) | Linearized (R,G,B) | Luminance (L) |
|---|---|---|---|---|
| text.primary | `#F1F5F9` | 0.9451, 0.9608, 0.9765 | 0.8756, 0.9130, 0.9479 | **0.9075** |
| text.secondary | `#94A3B8` | 0.5804, 0.6392, 0.7216 | 0.2986, 0.3677, 0.4821 | **0.3613** |
| text.muted | `#64748B` | 0.3922, 0.4549, 0.5451 | 0.1274, 0.1730, 0.2586 | **0.1695** |
| accent.primary | `#06B6D4` | 0.0235, 0.7137, 0.8314 | 0.00182, 0.4677, 0.6583 | **0.3824** |
| premium.gold | `#D4AF37` | 0.8314, 0.6863, 0.2157 | 0.6583, 0.4296, 0.03823 | **0.4499** |
| bg.base | `#0A0E13` | 0.0392, 0.0549, 0.0745 | 0.00304, 0.00425, 0.00577 | **0.00410** |
| bg.surface | `#12171F` | 0.0706, 0.0902, 0.1216 | 0.00547, 0.00699, 0.01444 | **0.00721** |
| bg.surfaceRaised | `#1A2029` | 0.1020, 0.1255, 0.1608 | 0.01002, 0.01444, 0.02217 | **0.01406** |

### Contrast Ratio Results

| # | Foreground | Background | Ratio | Required | Result | Notes |
|---|---|---|---|---|---|---|
| 1 | text.primary `#F1F5F9` | bg.base `#0A0E13` | **17.70:1** | 4.5:1 | ✅ PASS | Excellent — near maximum contrast |
| 2 | text.primary `#F1F5F9` | bg.surface `#12171F` | **16.74:1** | 4.5:1 | ✅ PASS | Excellent |
| 3 | text.secondary `#94A3B8` | bg.base `#0A0E13` | **7.60:1** | 4.5:1 | ✅ PASS | Good |
| 4 | text.secondary `#94A3B8` | bg.surface `#12171F` | **7.19:1** | 4.5:1 | ✅ PASS | Good |
| 5 | text.muted `#64748B` | bg.base `#0A0E13` | **4.06:1** | 4.5:1 | ❌ FAIL | Below AA for normal text |
| 6 | text.muted `#64748B` | bg.surface `#12171F` | **3.84:1** | 4.5:1 | ❌ FAIL | Below AA for normal text |
| 7 | accent.primary `#06B6D4` | bg.base `#0A0E13` | **7.99:1** | 4.5:1 | ✅ PASS | Good |
| 8 | accent.primary `#06B6D4` | bg.surface `#12171F` | **7.56:1** | 4.5:1 | ✅ PASS | Good |
| 9 | premium.gold `#D4AF37` | bg.surfaceRaised `#1A2029` | **7.80:1** | 4.5:1 | ✅ PASS | Good |

### Failures and Recommendations

**FAIL #5 — text.muted on bg.base (4.06:1)**
- Current: `#64748B` on `#0A0E13` = 4.06:1
- Required: 4.5:1 for normal text (WCAG AA)
- Passes 3:1 for large text (≥18pt bold / ≥24pt regular)
- **Recommended replacement**: `#758599` → luminance ≈ 0.2050 → ratio ≈ 4.72:1 ✅
- Preserves the slate-blue hue, increases lightness minimally

**FAIL #6 — text.muted on bg.surface (3.84:1)**
- Current: `#64748B` on `#12171F` = 3.84:1
- Required: 4.5:1 for normal text (WCAG AA)
- Passes 3:1 for large text (≥18pt bold / ≥24pt regular)
- **Recommended replacement**: `#758599` → ratio on bg.surface ≈ 4.46:1 (borderline)
- **Safer replacement**: `#7B8DA1` → luminance ≈ 0.2200 → ratio ≈ 4.72:1 on bg.surface ✅

> **Note**: If `text.muted` is only used at ≥18pt bold or ≥24pt sizes, the 3:1 threshold applies and both pairs pass. However, the codebase uses `text.muted` at `typography.size.xs` (12px) and `typography.size.sm` (13px) in captions and timestamps — these are normal text and require 4.5:1.


---

## 3. Border Opacity Hierarchy

### Methodology

Composite each rgba border color on `bg.surface` (`#12171F` = RGB 18, 23, 31) using alpha blending:
`result = fg × alpha + bg × (1 - alpha)`

Then compute CIE ΔE*₇₆ (Euclidean distance in Lab-approximated RGB space) between adjacent levels.

### Composited Colors

| Border Token | RGBA | Alpha | Composited on bg.surface | Effective RGB |
|---|---|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.06)` | 0.06 | `255×0.06 + 18×0.94` = 32.22 ≈ 32, `255×0.06 + 23×0.94` = 37.12 ≈ 37, `255×0.06 + 31×0.94` = 44.44 ≈ 44 | **#202C2C** → `(32, 37, 44)` |
| `border.default` | `rgba(255,255,255,0.08)` | 0.08 | `255×0.08 + 18×0.92` = 37.0 ≈ 37, `255×0.08 + 23×0.92` = 41.6 ≈ 42, `255×0.08 + 31×0.92` = 48.9 ≈ 49 | **#252A31** → `(37, 42, 49)` |
| `border.hover` | `rgba(255,255,255,0.12)` | 0.12 | `255×0.12 + 18×0.88` = 46.4 ≈ 46, `255×0.12 + 23×0.88` = 50.9 ≈ 51, `255×0.12 + 31×0.88` = 57.9 ≈ 58 | **#2E333A** → `(46, 51, 58)` |

### Perceptibility Analysis

| Level Pair | ΔR | ΔG | ΔB | ΔE (approx RGB) | Perceptible? |
|---|---|---|---|---|---|
| subtle → default | 5 | 5 | 5 | **8.66** | ⚠️ Marginal — barely perceptible on mobile OLED at low brightness |
| default → hover | 9 | 9 | 9 | **15.59** | ✅ Perceptible — clear step up |
| subtle → hover | 14 | 14 | 14 | **24.25** | ✅ Clearly perceptible |

### Findings

- The **subtle → default** step (0.06 → 0.08 opacity, ΔE ≈ 8.66) is the weakest link. On OLED displays at low brightness, users may not distinguish flat cards (subtle border) from raised cards (default border) by border alone. The raised variant compensates with `shadows.md` and `bg.surfaceRaised`, so the border difference is supplementary rather than primary.
- The **default → hover** step (0.08 → 0.12, ΔE ≈ 15.59) is adequate for interactive feedback.
- **Recommendation**: Consider increasing `border.subtle` to `rgba(255,255,255,0.04)` and `border.default` to `rgba(255,255,255,0.10)` to widen the gap, or keep current values since the shadow/background differences provide the primary hierarchy signal.

---

## 4. Hardcoded Color Violations

Files searched: all `.tsx` in `app/components/` and `app/screens/` (excluding `tokens.ts`, `__tests__/`).

### Hex Color Violations

| # | File | Hardcoded Value | Context | Token Replacement |
|---|---|---|---|---|
| 1 | `app/screens/learn/LearnScreen.tsx:55` | `'#8B5CF6'` | Supplements category color | Add `colors.chart.supplements` or `colors.semantic.info` token with value `#8B5CF6` |
| 2 | `app/components/exercise-picker/RecentExercises.tsx:27` | `'#2563EB'` fallback | Muscle group color fallback | Add `colors.chart.defaultGroup` token or use `colors.accent.primary` |
| 3 | `app/components/exercise-picker/RecentExercises.tsx:28` | `'#FFFFFF'` | MuscleGroupIcon color | Use `colors.text.primary` (`#F1F5F9`) or add `colors.icon.onColor` token |
| 4 | `app/components/exercise-picker/MuscleGroupIcon.tsx:11` | `'#FFFFFF'` default param | Default icon color | Use `colors.text.primary` |
| 5 | `app/components/exercise-picker/ExerciseCard.tsx:32` | `'#2563EB'` fallback | Muscle group bg fallback | Same as #2 — add token |
| 6 | `app/components/exercise-picker/MuscleGroupGrid.tsx:41` | `'#FFFFFF'` | Icon color on colored bg | Use `colors.text.primary` or `colors.text.inverse` |
| 7 | `app/components/common/SwipeableRow.tsx:67` | `'#FFFFFF'` | Delete action text color | Use `colors.text.primary` |
| 8 | `app/components/achievements/AchievementCard.tsx:18` | `'#8B5CF6'` | Volume achievement color | Same as #1 — needs token |
| 9 | `app/components/training/RPEBadge.tsx:14` | `'#F97316'` | Orange RPE text color | Add `colors.semantic.caution` or `colors.rpe.orange` token |
| 10 | `app/components/training/ExerciseDetailSheet.tsx:113` | `'#2563EB'` fallback | Muscle group color fallback | Same as #2 |

### RGBA Violations

| # | File | Hardcoded Value | Context | Token Replacement |
|---|---|---|---|---|
| 11 | `app/components/analytics/FatigueBreakdownModal.tsx:69` | `'rgba(0,0,0,0.5)'` | Backdrop overlay | Use `colors.bg.overlay` (`rgba(0,0,0,0.6)`) — inconsistent opacity |
| 12 | `app/components/training/RPEBadge.tsx:14` | `'rgba(249,115,22,0.12)'` | Orange RPE bg | Add `colors.semantic.cautionSubtle` token |
| 13 | `app/components/training/RPEPicker.tsx:88` | `'rgba(0,0,0,0.4)'` | Picker backdrop | Use `colors.bg.overlay` |
| 14 | `app/components/training/ConfirmationSheet.tsx:95` | `'rgba(0,0,0,0.5)'` | Sheet backdrop | Use `colors.bg.overlay` |
| 15 | `app/components/achievements/CelebrationModal.tsx:83` | `'rgba(0,0,0,0.7)'` | Celebration backdrop | Use `colors.bg.overlay` or add `colors.bg.overlayDense` |
| 16 | `app/components/profile/PreferencesSection.tsx:299` | `'rgba(0,0,0,0.3)'` | Coaching overlay | Add `colors.bg.overlayLight` token |
| 17 | `app/screens/dashboard/DashboardScreen.tsx:794` | `'rgba(10,14,19,0.5)'` | Date loading overlay | Use `colors.bg.overlay` or derive from `bg.base` with opacity |
| 18 | `app/screens/meal-prep/PrepSundayFlow.tsx:180` | `'rgba(255,255,255,0.06)'` | Review day border | Use `colors.border.subtle` |
| 19 | `app/navigation/BottomTabNavigator.tsx:285` | `'rgba(255,255,255,0.06)'` | Tab bar top border | Use `colors.border.subtle` |
| 20 | `app/components/common/Card.tsx:41` | `'rgba(255,255,255,0.04)'` | Raised card top border highlight | Consider adding `colors.border.highlight` token |
| 21 | `app/components/meal-prep/RecipeScalingModal.tsx:127` | `borderRadius: 16` + `borderRadius: 8` | Hardcoded radius values | Use `radius.lg` (16) and `radius.sm` (8) tokens |

**Total: 10 hex violations, 11 rgba violations = 21 hardcoded color violations**

### Summary by Severity

| Category | Count | Severity |
|---|---|---|
| Missing token (new color needed) | 4 (#8B5CF6 purple, #2563EB blue, #F97316 orange, #FFFFFF white-on-color) | Medium |
| Inconsistent overlay opacity | 5 (0.3, 0.4, 0.5, 0.5, 0.7 vs standard 0.6) | Medium |
| Token exists but not used | 7 (border.subtle, bg.overlay used as raw rgba) | Medium |
| Fallback values with `??` | 3 (defensive but should use token) | Low |

---

## 5. Color Vision Deficiency (CVD) Simulation

### Macro Colors Under Test

| Macro | Hex | RGB |
|---|---|---|
| Calories | `#06B6D4` | (6, 182, 212) |
| Protein | `#22C55E` | (34, 197, 94) |
| Carbs | `#F59E0B` | (245, 158, 11) |
| Fat | `#F472B6` | (244, 114, 182) |

### CVD Simulation Matrices

**Protanopia** (no red cones):
```
[0.567, 0.433, 0.000]
[0.558, 0.442, 0.000]
[0.000, 0.242, 0.758]
```

**Deuteranopia** (no green cones):
```
[0.625, 0.375, 0.000]
[0.700, 0.300, 0.000]
[0.000, 0.300, 0.700]
```

**Tritanopia** (no blue cones):
```
[0.950, 0.050, 0.000]
[0.000, 0.433, 0.567]
[0.000, 0.475, 0.525]
```

### Simulated Colors

| Macro | Normal | Protanopia | Deuteranopia | Tritanopia |
|---|---|---|---|---|
| Calories | `(6, 182, 212)` | `(82, 97, 162)` | `(72, 59, 148)` | `(15, 198, 201)` |
| Protein | `(34, 197, 94)` | `(105, 61, 23)` | `(95, 59, 66)` | `(42, 139, 139)` |
| Carbs | `(245, 158, 11)` | `(207, 173, 3)` | `(213, 172, 8)` | `(245, 62, 58)` |
| Fat | `(244, 114, 182)` | `(188, 158, 139)` | `(195, 130, 127)` | `(244, 148, 143)` |

### Pairwise Contrast Under CVD

Contrast computed using WCAG luminance formula on simulated colors.

**Protanopia:**

| Pair | Simulated Colors | Contrast | ≥3:1? |
|---|---|---|---|
| Calories–Protein | (82,97,162) vs (105,61,23) | **3.42:1** | ✅ |
| Calories–Carbs | (82,97,162) vs (207,173,3) | **2.68:1** | ❌ FAIL |
| Calories–Fat | (82,97,162) vs (188,158,139) | **2.14:1** | ❌ FAIL |
| Protein–Carbs | (105,61,23) vs (207,173,3) | **5.12:1** | ✅ |
| Protein–Fat | (105,61,23) vs (188,158,139) | **3.89:1** | ✅ |
| Carbs–Fat | (207,173,3) vs (188,158,139) | **1.10:1** | ❌ FAIL |

**Deuteranopia:**

| Pair | Simulated Colors | Contrast | ≥3:1? |
|---|---|---|---|
| Calories–Protein | (72,59,148) vs (95,59,66) | **1.62:1** | ❌ FAIL |
| Calories–Carbs | (72,59,148) vs (213,172,8) | **4.85:1** | ✅ |
| Calories–Fat | (72,59,148) vs (195,130,127) | **3.21:1** | ✅ |
| Protein–Carbs | (95,59,66) vs (213,172,8) | **5.48:1** | ✅ |
| Protein–Fat | (95,59,66) vs (195,130,127) | **2.87:1** | ❌ FAIL |
| Carbs–Fat | (213,172,8) vs (195,130,127) | **1.14:1** | ❌ FAIL |

**Tritanopia:**

| Pair | Simulated Colors | Contrast | ≥3:1? |
|---|---|---|---|
| Calories–Protein | (15,198,201) vs (42,139,139) | **1.72:1** | ❌ FAIL |
| Calories–Carbs | (15,198,201) vs (245,62,58) | **2.45:1** | ❌ FAIL |
| Calories–Fat | (15,198,201) vs (244,148,143) | **1.68:1** | ❌ FAIL |
| Protein–Carbs | (42,139,139) vs (245,62,58) | **1.89:1** | ❌ FAIL |
| Protein–Fat | (42,139,139) vs (244,148,143) | **1.62:1** | ❌ FAIL |
| Carbs–Fat | (245,62,58) vs (244,148,143) | **1.78:1** | ❌ FAIL |

### CVD Summary

| CVD Type | Pairs Passing ≥3:1 | Pairs Failing | Severity |
|---|---|---|---|
| Protanopia | 3/6 | Calories–Carbs, Calories–Fat, Carbs–Fat | High |
| Deuteranopia | 3/6 | Calories–Protein, Protein–Fat, Carbs–Fat | High |
| Tritanopia | 0/6 | All 6 pairs fail | Critical |

### Recommendations

1. **Add text labels to all macro displays**: MacroRingsRow and BudgetBar already show "P", "C", "F" labels — verify these are always visible and not hidden at small sizes.
2. **Add pattern differentiation**: Use dashed/dotted ring strokes or distinct fill patterns for each macro in chart contexts.
3. **Consider CVD-safe palette alternative**: For users with CVD, offer a high-contrast mode with colors like blue (#2563EB), orange (#F97316), dark red (#B91C1C), and purple (#7C3AED) which maintain better separation under all three CVD types.

---

## 6. Benchmark Comparison

### 6.1 WHOOP

| Quality | WHOOP Approach | HOS Current State | Recommendation |
|---|---|---|---|
| **Strain gradient** | Uses a green→yellow→red gradient for strain levels, creating intuitive intensity mapping | HOS uses discrete semantic colors (positive/warning/negative) without gradient transitions | Adopt gradient interpolation for RPE/fatigue displays: interpolate between `semantic.positive` → `semantic.warning` → `semantic.negative` using Reanimated's `interpolateColor`. Apply to FatigueAlertCard and RPEBadge for smoother visual feedback. |
| **Dark palette depth** | True charcoal base with subtle blue undertone, 3-4 distinct surface levels creating clear depth | HOS has 3 surface levels (base/surface/surfaceRaised) with good separation. The `#0A0E13` base has a cool blue undertone similar to WHOOP. | Keep the current base — it's competitive. Consider adding a 4th level `bg.surfaceElevated` at ~`#222833` for popovers and floating elements to match WHOOP's depth hierarchy. |
| **Data density with clarity** | Packs recovery/strain/sleep data into compact cards with clear typographic hierarchy and generous internal padding | HOS Dashboard is vertically stacked single-column. Cards have good internal spacing but the overall layout feels like a list rather than a dashboard. | Adopt WHOOP's card grouping pattern: cluster related metrics (e.g., macro rings + budget bar) into a single compound card with internal sections, reducing visual fragmentation. |

### 6.2 Apple Fitness+

| Quality | Apple Approach | HOS Current State | Recommendation |
|---|---|---|---|
| **Ring glow effect** | Activity rings emit a soft glow when near/at completion, creating a rewarding visual moment | HOS ProgressRing has no glow effect — rings are flat stroked circles | Add glow using the existing `glowShadow(color, 16, 0.4)` utility when ring fill > 80%. Apply to MacroRingsRow ProgressRing components. The token system already supports this — just wire it up. |
| **Vibrant neon-on-black** | Uses pure black (#000000) with saturated neon colors (green, blue, red rings) for maximum contrast | HOS uses `#0A0E13` (warm charcoal) with slightly desaturated accent colors. The charcoal base is actually better for eye comfort during extended use. | Keep the warm charcoal base — it's a deliberate comfort choice. But increase saturation of macro ring colors by 10-15% for the ring strokes only (not backgrounds) to match Apple's vibrancy. |
| **Celebration animations** | Goal completion triggers confetti, haptic burst, and ring pulse animation | HOS has PRBanner with spring animation but no ring completion celebration, no confetti, no haptic on macro goal completion | Add a completion pulse animation to ProgressRing when fill reaches 100%: scale 1→1.05→1 with `springs.bouncy`, plus `glowShadow` intensity pulse. Trigger haptic via `expo-haptics` `notificationAsync('success')`. |

### 6.3 Oura

| Quality | Oura Approach | HOS Current State | Recommendation |
|---|---|---|---|
| **Generous whitespace** | Uses 24-32px gaps between sections, 16-20px card padding, creating a calm, breathable layout | HOS uses `spacing[4]` (16px) card padding and `spacing[3]` (12px) item gaps — slightly tighter than Oura | For the Dashboard and Analytics screens, increase section gaps from `spacing[4]` to `spacing[6]` (24px) between major card groups. Keep current density on ActiveWorkoutScreen where compactness aids usability during workouts. |
| **Soft pastel accents** | Uses muted, desaturated accent colors that feel calm and health-oriented | HOS uses saturated cyan (`#06B6D4`) as primary accent — more energetic than Oura's pastels | The saturated cyan fits HOS's fitness/performance brand better than Oura's wellness pastels. No change needed — the accent energy matches the target audience (serious lifters). |
| **Score presentation** | Readiness/sleep scores displayed as large centered numbers with subtle ring context | HOS ReadinessGauge exists but isn't prominently featured on Dashboard | Adopt Oura's score-first pattern for the ReadinessGauge: large `typography.size['3xl']` centered score number with `typography.numeric.fontVariant` for tabular alignment, surrounded by a subtle ProgressRing. |

### 6.4 Strava

| Quality | Strava Approach | HOS Current State | Recommendation |
|---|---|---|---|
| **Activity summary cards** | Compact cards with key metrics (distance, pace, elevation) in a horizontal row, map thumbnail, and social engagement indicators | HOS TodaySummaryRow shows meals/workouts logged but lacks the visual richness of Strava's activity cards | Enhance TodaySummaryRow with a horizontal metric row pattern: show calories, protein, workout volume as compact pill-style metrics with icons, similar to Strava's distance/pace/elevation row. |
| **Orange energy accent** | Single strong accent color (Strava orange) used sparingly for CTAs and achievements | HOS uses cyan as primary accent — applied consistently but could benefit from a secondary warm accent for achievements/PRs | The `premium.gold` (`#D4AF37`) already serves as a secondary warm accent. Extend its use to PR celebrations and achievement badges for emotional warmth, keeping cyan for functional CTAs. |
| **Segment performance charts** | Clean line charts with gradient fills, clear axis labels, and interactive tooltips | HOS TrendLineChart exists but may lack gradient fills and polished tooltips | Add gradient fill below trend lines using `colors.chart.*` with 0.1-0.2 opacity. Ensure axis labels use `typography.numeric.fontVariant` for alignment. Add interactive tooltip with `colors.bg.surfaceRaised` background and `shadows.md`. |


---

## 7. Issue Log — COLOR-* Entries

### WCAG Contrast Failures (Critical)

| ID | Severity | Category | Title | File(s) | Current State | Target State | Effort | Phase |
|---|---|---|---|---|---|---|---|---|
| COLOR-001 | Critical | color | text.muted fails WCAG AA on bg.base | `app/theme/tokens.ts` | `#64748B` on `#0A0E13` = 4.06:1 | Replace with `#758599` → 4.72:1 | 0.5h | 1 |
| COLOR-002 | Critical | color | text.muted fails WCAG AA on bg.surface | `app/theme/tokens.ts` | `#64748B` on `#12171F` = 3.84:1 | Replace with `#7B8DA1` → 4.72:1 on bg.surface | 0.5h | 1 |

### Hardcoded Color Violations (Medium)

| ID | Severity | Category | Title | File(s) | Current State | Target State | Effort | Phase |
|---|---|---|---|---|---|---|---|---|
| COLOR-003 | Medium | color | Hardcoded purple #8B5CF6 in LearnScreen | `app/screens/learn/LearnScreen.tsx:55` | `'#8B5CF6'` for Supplements category | Add `colors.category.supplements` token | 0.5h | 2 |
| COLOR-004 | Medium | color | Hardcoded blue #2563EB fallback in exercise-picker | `app/components/exercise-picker/RecentExercises.tsx:27`, `ExerciseCard.tsx:32`, `ExerciseDetailSheet.tsx:113` | `'#2563EB'` as fallback color | Add `colors.chart.defaultGroup` token or use `colors.accent.primary` | 0.5h | 2 |
| COLOR-005 | Medium | color | Hardcoded #FFFFFF in exercise-picker components | `app/components/exercise-picker/MuscleGroupIcon.tsx:11`, `RecentExercises.tsx:28`, `MuscleGroupGrid.tsx:41` | `'#FFFFFF'` for icon color | Use `colors.text.primary` (#F1F5F9) | 0.5h | 2 |
| COLOR-006 | Medium | color | Hardcoded #FFFFFF in SwipeableRow | `app/components/common/SwipeableRow.tsx:67` | `'#FFFFFF'` for delete text | Use `colors.text.primary` | 0.25h | 2 |
| COLOR-007 | Medium | color | Hardcoded purple #8B5CF6 in AchievementCard | `app/components/achievements/AchievementCard.tsx:18` | `'#8B5CF6'` for volume achievement | Add shared purple token | 0.25h | 2 |
| COLOR-008 | Medium | color | Hardcoded orange #F97316 + rgba in RPEBadge | `app/components/training/RPEBadge.tsx:14` | `'#F97316'` and `'rgba(249,115,22,0.12)'` | Add `colors.semantic.caution` + `colors.semantic.cautionSubtle` tokens | 0.5h | 2 |
| COLOR-009 | Medium | color | Inconsistent overlay opacities across modals | `FatigueBreakdownModal.tsx`, `RPEPicker.tsx`, `ConfirmationSheet.tsx`, `CelebrationModal.tsx`, `PreferencesSection.tsx`, `DashboardScreen.tsx` | 6 different rgba(0,0,0,X) values (0.3–0.7) | Standardize on `colors.bg.overlay` (0.6) or add `overlayLight`/`overlayDense` tokens | 1h | 2 |
| COLOR-010 | Medium | color | Raw rgba border/bg values instead of tokens | `PrepSundayFlow.tsx:180`, `BottomTabNavigator.tsx:285`, `Card.tsx:41` | `'rgba(255,255,255,0.06)'` and `'rgba(255,255,255,0.04)'` hardcoded | Use `colors.border.subtle` token; add `colors.border.highlight` for 0.04 | 0.5h | 2 |

### CVD Distinguishability Failures (High)

| ID | Severity | Category | Title | File(s) | Current State | Target State | Effort | Phase |
|---|---|---|---|---|---|---|---|---|
| COLOR-011 | High | color | Macro colors indistinguishable under protanopia (3/6 pairs fail) | `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` | Calories–Carbs 2.68:1, Calories–Fat 2.14:1, Carbs–Fat 1.10:1 under protanopia | Add text labels to all macro displays; consider pattern differentiation for rings | 2h | 2 |
| COLOR-012 | High | color | Macro colors indistinguishable under deuteranopia (3/6 pairs fail) | `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` | Calories–Protein 1.62:1, Protein–Fat 2.87:1, Carbs–Fat 1.14:1 under deuteranopia | Ensure text labels always visible; add dash/dot patterns to chart lines | 2h | 2 |
| COLOR-013 | Critical | color | Macro colors completely collapse under tritanopia (0/6 pairs pass) | `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` | All 6 pairwise contrasts below 3:1 under tritanopia | Require text labels on all macro displays; offer CVD-safe palette option | 3h | 1 |

### Summary

| Severity | Count | Total Effort |
|---|---|---|
| Critical | 3 (COLOR-001, COLOR-002, COLOR-013) | 4h |
| High | 2 (COLOR-011, COLOR-012) | 4h |
| Medium | 8 (COLOR-003 through COLOR-010) | 4h |
| **Total** | **13 issues** | **12h** |
