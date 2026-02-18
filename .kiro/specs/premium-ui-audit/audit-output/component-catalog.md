# Component Catalog — Hypertrophy OS Design Consistency Audit

> Generated from static analysis of all `.tsx` files under `app/components/` (18 directories, 107 React component files).
> Non-component utility files skipped: `anatomicalPaths.ts` (data-only).

---

## 1. Component Inventory Table

| Component | File Path | Category | Variants | States | Token Compliance | Hardcoded Values | Animation Library | Press Anim | Hover | Issues |
|---|---|---|---|---|---|---|---|---|---|---|
| AchievementCard | achievements/AchievementCard.tsx | achievements | — | — | partial | 3 | none | ✗ | ✗ | `#8B5CF6`, fontSize `10`, borderRadius `20/2` |
| AchievementGrid | achievements/AchievementGrid.tsx | achievements | — | — | full | 0 | none | ✗ | ✗ | — |
| CelebrationModal | achievements/CelebrationModal.tsx | achievements | — | — | partial | 1 | reanimated | ✗ | ✗ | `rgba(0,0,0,0.7)` |
| ShareableCard | achievements/ShareableCard.tsx | achievements | — | — | partial | 1 | none | ✗ | ✗ | borderRadius `28` |
| BodyHeatMap | analytics/BodyHeatMap.tsx | analytics | — | loading,error | full | 0 | none | ✗ | ✗ | — |
| BodySilhouette | analytics/BodySilhouette.tsx | analytics | — | — | partial | 0 | rn-animated | ✗ | ✗ | RN Animated.timing |
| DrillDownModal | analytics/DrillDownModal.tsx | analytics | — | loading | full | 0 | none | ✗ | ✗ | — |
| ExpenditureTrendCard | analytics/ExpenditureTrendCard.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| FatigueBreakdownModal | analytics/FatigueBreakdownModal.tsx | analytics | — | — | partial | 2 | none | ✗ | ✗ | `rgba(0,0,0,0.5)`, fontSize `20/40` |
| FatigueHeatMapOverlay | analytics/FatigueHeatMapOverlay.tsx | analytics | — | — | partial | 2 | none | ✗ | ✗ | borderRadius `4`, fontSize `10` |
| HeatMapCard | analytics/HeatMapCard.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| HeatMapLegend | analytics/HeatMapLegend.tsx | analytics | — | — | partial | 1 | none | ✗ | ✗ | borderRadius `5` |
| ReadinessTrendChart | analytics/ReadinessTrendChart.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| StrengthLeaderboard | analytics/StrengthLeaderboard.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| StrengthStandardsCard | analytics/StrengthStandardsCard.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| WeeklySummaryCard | analytics/WeeklySummaryCard.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| WeekNavigator | analytics/WeekNavigator.tsx | analytics | — | — | full | 0 | none | ✗ | ✗ | — |
| TimeRangeSelector | charts/TimeRangeSelector.tsx | charts | — | — | partial | 1 | none | ✗ | ✗ | `padding: 2` |
| TrendLineChart | charts/TrendLineChart.tsx | charts | — | — | full | 0 | none | ✗ | ✗ | — |
| CoachingModeSelector | coaching/CoachingModeSelector.tsx | coaching | 3 modes | — | partial | 2 | none | ✗ | ✗ | borderRadius `10/5` |
| WeeklyCheckinCard | coaching/WeeklyCheckinCard.tsx | coaching | — | — | full | 0 | none | ✗ | ✗ | — |
| Button | common/Button.tsx | common | primary/secondary/ghost/danger | disabled,loading | full | 0 | reanimated | ✓ | ✓ | — |
| Card | common/Card.tsx | common | flat/raised/outlined | — | partial | 1 | reanimated | ✓ | ✓ | `rgba(255,255,255,0.04)` |
| EditableField | common/EditableField.tsx | common | — | — | full | 0 | none | ✗ | ✗ | — |
| EmptyState | common/EmptyState.tsx | common | — | — | partial | 1 | none | ✗ | ✗ | letterSpacing `-0.25` |
| ErrorBoundary | common/ErrorBoundary.tsx | common | — | error | full | 0 | none | ✗ | ✗ | — |
| FilterPill | common/FilterPill.tsx | common | active/inactive | — | full | 0 | reanimated | ✓ | ✓ | — |
| Icon | common/Icon.tsx | common | — | — | full | 0 | none | ✗ | ✗ | — |
| ModalContainer | common/ModalContainer.tsx | common | mobile/web | — | partial | 2 | reanimated | ✗ | ✗ | `rgba(0,0,0,0.6)`, fontSize `18` |
| ProgressBar | common/ProgressBar.tsx | common | — | — | partial | 1 | reanimated | ✗ | ✗ | borderRadius `4` |
| ProgressRing | common/ProgressRing.tsx | common | — | — | full | 0 | reanimated | ✗ | ✗ | — |
| SectionHeader | common/SectionHeader.tsx | common | — | — | full | 0 | none | ✗ | ✗ | — |
| SetupBanner | common/SetupBanner.tsx | common | — | — | full | 0 | none | ✗ | ✗ | — |
| Skeleton | common/Skeleton.tsx | common | rect/circle | — | full | 0 | reanimated | ✗ | ✗ | — |
| SwipeableRow | common/SwipeableRow.tsx | common | — | — | partial | 1 | none | ✗ | ✗ | `#FFFFFF` |
| Tooltip | common/Tooltip.tsx | common | — | — | partial | 0 | rn-animated | ✗ | ✗ | RN Animated.timing |
| ArticleCardCompact | dashboard/ArticleCardCompact.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| DateScroller | dashboard/DateScroller.tsx | dashboard | — | — | partial | 2 | none | ✗ | ✗ | borderRadius `2.5` |
| DayBadge | dashboard/DayBadge.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| DayIndicator | dashboard/DayIndicator.tsx | dashboard | — | isLoading | partial | 1 | none | ✗ | ✗ | borderRadius `3` |
| FatigueAlertCard | dashboard/FatigueAlertCard.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| MacroRingsRow | dashboard/MacroRingsRow.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| MealSlotDiary | dashboard/MealSlotDiary.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| MealSlotGroup | dashboard/MealSlotGroup.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| QuickActionButton | dashboard/QuickActionButton.tsx | dashboard | — | — | partial | 2 | reanimated | ✓ | ✗ | fontSize `24`, borderRadius `8` |
| ReadinessGauge | dashboard/ReadinessGauge.tsx | dashboard | — | empty | partial | 3 | none | ✗ | ✗ | borderRadius `12/2`, fontSize `28/11` |
| RecompDashboardCard | dashboard/RecompDashboardCard.tsx | dashboard | — | loading,error | full | 0 | none | ✗ | ✗ | — |
| StreakIndicator | dashboard/StreakIndicator.tsx | dashboard | — | — | full | 0 | reanimated | ✗ | ✗ | — |
| TodaySummaryRow | dashboard/TodaySummaryRow.tsx | dashboard | — | — | full | 0 | none | ✗ | ✗ | — |
| CustomExerciseForm | exercise-picker/CustomExerciseForm.tsx | exercise-picker | — | — | full | 0 | none | ✗ | ✗ | — |
| ExerciseCard | exercise-picker/ExerciseCard.tsx | exercise-picker | — | — | partial | 2 | none | ✗ | ✗ | `#2563EB`, `#FFFFFF` |
| MuscleGroupGrid | exercise-picker/MuscleGroupGrid.tsx | exercise-picker | — | — | partial | 2 | none | ✗ | ✗ | `#FFFFFF`, borderRadius `24` |
| MuscleGroupIcon | exercise-picker/MuscleGroupIcon.tsx | exercise-picker | — | — | partial | 1 | none | ✗ | ✗ | `#FFFFFF` default |
| RecentExercises | exercise-picker/RecentExercises.tsx | exercise-picker | — | — | partial | 2 | none | ✗ | ✗ | `#2563EB`, `#FFFFFF` |
| SearchBar | exercise-picker/SearchBar.tsx | exercise-picker | — | — | full | 0 | none | ✗ | ✗ | — |
| ArticleChart | learn/ArticleChart.tsx | learn | — | — | full | 0 | none | ✗ | ✗ | — |
| CollapsibleSection | log/CollapsibleSection.tsx | log | — | — | full | 0 | LayoutAnimation | ✗ | ✗ | RN LayoutAnimation |
| QuickRelogRow | log/QuickRelogRow.tsx | log | — | loading | full | 0 | none | ✗ | ✗ | — |
| StartWorkoutCard | log/StartWorkoutCard.tsx | log | — | — | full | 0 | none | ✗ | ✗ | — |
| TemplateRow | log/TemplateRow.tsx | log | — | — | full | 0 | none | ✗ | ✗ | — |
| RecipeScalingModal | meal-prep/RecipeScalingModal.tsx | meal-prep | — | — | partial | 3 | none | ✗ | ✗ | borderRadius `16/8` |
| AddBodyweightModal | modals/AddBodyweightModal.tsx | modals | — | — | full | 0 | none | ✗ | ✗ | — |
| AddNutritionModal | modals/AddNutritionModal.tsx | modals | — | — | full | 0 | none | ✗ | ✗ | — |
| AddTrainingModal | modals/AddTrainingModal.tsx | modals | — | — | partial | 1 | none | ✗ | ✗ | `padding: 12` |
| QuickAddModal | modals/QuickAddModal.tsx | modals | — | — | full | 0 | none | ✗ | ✗ | — |
| RecoveryCheckinModal | modals/RecoveryCheckinModal.tsx | modals | — | — | full | 0 | none | ✗ | ✗ | — |
| BarcodeScanner | nutrition/BarcodeScanner.tsx | nutrition | — | — | partial | 7 | none | ✗ | ✗ | 5× fontWeight, 3× rgba |
| BudgetBar | nutrition/BudgetBar.tsx | nutrition | — | — | partial | 2 | none | ✗ | ✗ | borderRadius `3` |
| CopyMealsBar | nutrition/CopyMealsBar.tsx | nutrition | — | loading | full | 0 | none | ✗ | ✗ | — |
| MealBuilder | nutrition/MealBuilder.tsx | nutrition | — | — | partial | 2 | none | ✗ | ✗ | `#ef4444`, fontSize `16` |
| SourceBadge | nutrition/SourceBadge.tsx | nutrition | — | — | full | 0 | none | ✗ | ✗ | — |
| WaterTracker | nutrition/WaterTracker.tsx | nutrition | — | — | full | 0 | none | ✗ | ✗ | — |
| BlockCreationModal | periodization/BlockCreationModal.tsx | periodization | — | — | full | 0 | none | ✗ | ✗ | — |
| BlockTemplateModal | periodization/BlockTemplateModal.tsx | periodization | — | — | full | 0 | none | ✗ | ✗ | — |
| PeriodizationCalendar | periodization/PeriodizationCalendar.tsx | periodization | — | — | partial | 3 | none | ✗ | ✗ | borderRadius `2/3` |
| AlignedComparison | photos/AlignedComparison.tsx | photos | — | loading | full | 0 | none | ✗ | ✗ | — |
| GuidedCameraView | photos/GuidedCameraView.tsx | photos | — | — | partial | 2 | none | ✗ | ✗ | borderRadius `36/28` |
| LightingReminder | photos/LightingReminder.tsx | photos | — | — | partial | 1 | none | ✗ | ✗ | fontSize `40` |
| PhotoComparison | photos/PhotoComparison.tsx | photos | — | — | full | 0 | none | ✗ | ✗ | — |
| PoseOverlay | photos/PoseOverlay.tsx | photos | — | — | full | 0 | none | ✗ | ✗ | — |
| PoseSelector | photos/PoseSelector.tsx | photos | — | — | partial | 1 | none | ✗ | ✗ | fontSize `32` |
| TimelineSlider | photos/TimelineSlider.tsx | photos | — | — | full | 0 | none | ✗ | ✗ | — |
| PremiumBadge | premium/PremiumBadge.tsx | premium | — | — | full | 0 | none | ✗ | ✗ | — |
| UpgradeBanner | premium/UpgradeBanner.tsx | premium | — | — | full | 0 | none | ✗ | ✗ | — |
| UpgradeModal | premium/UpgradeModal.tsx | premium | — | — | full | 0 | none | ✗ | ✗ | — |
| AccountSection | profile/AccountSection.tsx | profile | — | — | partial | 0 | LayoutAnimation | ✗ | ✗ | RN LayoutAnimation |
| BodyStatsSection | profile/BodyStatsSection.tsx | profile | — | — | full | 0 | none | ✗ | ✗ | — |
| EditPlanPanel | profile/EditPlanPanel.tsx | profile | — | — | full | 0 | none | ✗ | ✗ | — |
| FeatureNavItem | profile/FeatureNavItem.tsx | profile | — | — | full | 0 | reanimated | ✓ | ✗ | — |
| GoalsSection | profile/GoalsSection.tsx | profile | — | — | full | 0 | none | ✗ | ✗ | — |
| PlanEditFlow | profile/PlanEditFlow.tsx | profile | — | — | full | 0 | none | ✗ | ✗ | — |
| PlanSummaryCard | profile/PlanSummaryCard.tsx | profile | — | — | full | 0 | none | ✗ | ✗ | — |
| PreferencesSection | profile/PreferencesSection.tsx | profile | — | disabled | partial | 1 | none | ✗ | ✗ | `rgba(0,0,0,0.3)` |
| ReportCard | reports/ReportCard.tsx | reports | — | — | full | 0 | none | ✗ | ✗ | — |
| ConfirmationSheet | training/ConfirmationSheet.tsx | training | — | — | partial | 1 | none | ✗ | ✗ | `rgba(0,0,0,0.5)` |
| DurationTimer | training/DurationTimer.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| ExerciseContextMenu | training/ExerciseContextMenu.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| ExerciseDetailSheet | training/ExerciseDetailSheet.tsx | training | — | — | partial | 2 | rn-animated | ✗ | ✗ | `#2563EB`, RN Animated |
| FinishBar | training/FinishBar.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| OverloadSuggestionBadge | training/OverloadSuggestionBadge.tsx | training | — | — | partial | 0 | rn-animated | ✗ | ✗ | RN Animated |
| PRBanner | training/PRBanner.tsx | training | — | — | partial | 1 | rn-animated | ✗ | ✗ | RN Animated.spring, fontSize `40` |
| PreviousPerformance | training/PreviousPerformance.tsx | training | — | loading | partial | 0 | rn-animated | ✗ | ✗ | RN Animated pulse |
| RestTimer | training/RestTimer.tsx | training | — | — | partial | 0 | LayoutAnimation | ✗ | ✗ | LayoutAnimation, 64px font |
| RestTimerBar | training/RestTimerBar.tsx | training | — | completed | partial | 0 | rn-animated | ✗ | ✗ | RN Animated.spring |
| RestTimerOverlay | training/RestTimerOverlay.tsx | training | — | completed | full | 0 | none | ✗ | ✗ | — |
| RestTimerRing | training/RestTimerRing.tsx | training | — | — | partial | 0 | rn-animated | ✗ | ✗ | RN Animated.timing |
| RestTimerV2 | training/RestTimerV2.tsx | training | — | completed | partial | 0 | rn-animated | ✗ | ✗ | RN Animated.timing |
| RPEBadge | training/RPEBadge.tsx | training | — | — | partial | 2 | none | ✗ | ✗ | `#F97316`, non-token orange |
| RPEPicker | training/RPEPicker.tsx | training | — | — | partial | 2 | none | ✗ | ✗ | `rgba(0,0,0,0.4)`, borderRadius `22` |
| SetTypeSelector | training/SetTypeSelector.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| TemplatePicker | training/TemplatePicker.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| TypeBadge | training/TypeBadge.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| VolumeIndicatorPill | training/VolumeIndicatorPill.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |
| WarmUpSuggestion | training/WarmUpSuggestion.tsx | training | — | — | full | 0 | none | ✗ | ✗ | — |

---

## Summary Statistics

| Metric | Count |
|---|---|
| Total component files audited | 107 |
| Utility files skipped | 1 (`anatomicalPaths.ts`) |
| Full token compliance | 62 (58%) |
| Partial token compliance | 45 (42%) |
| No token compliance | 0 (0%) |
| Components with press animation | 5 (Button, Card, FilterPill, FeatureNavItem, QuickActionButton) |
| Components with hover state | 3 (Button, Card, FilterPill) |
| Components with staggered entrance | 1 (Card) |
| Components using Reanimated | 11 |
| Components using RN Animated | 10 |
| Components using LayoutAnimation | 3 (RestTimer, CollapsibleSection, AccountSection) |
| Components with hardcoded hex colors | 12 |
| Components with hardcoded fontSize | 10 |
| Components with hardcoded borderRadius | 20+ |
| Components with hardcoded fontWeight | 1 (BarcodeScanner — 5 instances) |

---

## 2. Foundation Component Deep Audit

### 2.1 Button (`app/components/common/Button.tsx`)

**Variants**: 4 confirmed — `primary`, `secondary`, `ghost`, `danger`

| Check | Expected | Actual | Status |
|---|---|---|---|
| `minHeight: 44` | 44 | 44 | PASS |
| Vertical padding | `spacing[3]` (12px) | `spacing[3]` | PASS |
| Horizontal padding | `spacing[6]` (24px) | `spacing[6]` | PASS |
| Border radius | `radius.md` (12) | `radius.lg` (16) | DEVIATION — uses `radius.lg` not `radius.md` |
| Press animation | `usePressAnimation` | Imported and used | PASS |
| Hover state | `useHoverState` | Imported and used | PASS |
| Disabled opacity | `opacityScale.disabled` (0.4) | `opacity: 0.4` hardcoded | MINOR — value matches but not token ref |
| Loading state | `ActivityIndicator` | Shows `ActivityIndicator` | PASS |
| Letter spacing | — | Uses `letterSpacing.wide` | PASS |
| Shadow on primary | `shadows.md` | Applied via `Object.assign` | PASS |

**Findings**:
- Button uses `radius.lg` (16px) instead of `radius.md` (12px) — intentional design choice or deviation?
- Disabled opacity is hardcoded `0.4` instead of referencing `opacityScale.disabled` token

### 2.2 Card (`app/components/common/Card.tsx`)

**Variants**: 3 confirmed — `flat`, `raised`, `outlined`

| Check | Expected | Actual | Status |
|---|---|---|---|
| Flat bg | `colors.bg.surface` | `colors.bg.surface` | PASS |
| Flat border | `colors.border.subtle` | `colors.border.subtle` | PASS |
| Raised bg | `colors.bg.surfaceRaised` | `colors.bg.surfaceRaised` | PASS |
| Raised border | `colors.border.default` | `colors.border.default` | PASS |
| Raised shadow | `shadows.md` | `Object.assign(base, shadows.md)` | PASS |
| Raised top highlight | `rgba(255,255,255,0.04)` | Present as `borderTopColor` | PASS (hardcoded but intentional) |
| Outlined bg | transparent | `'transparent'` | PASS |
| Outlined border | `colors.border.default` | `colors.border.default` | PASS |
| Padding | `spacing[4]` (16px) | `spacing[4]` | PASS |
| Border radius | `radius.md` (12px) | `radius.md` | PASS |
| Press animation | `usePressAnimation` | Used on pressable cards | PASS |
| Staggered entrance | `useStaggeredEntrance` | Used when `animated=true` | PASS |
| Hover state | `useHoverState` | Shows `colors.border.hover` | PASS |

**Findings**:
- Most token-compliant foundation component
- `rgba(255,255,255,0.04)` top border highlight is hardcoded — consider adding `colors.border.highlight` token
- Legacy `raised` boolean prop still supported (deprecated)

### 2.3 ModalContainer (`app/components/common/ModalContainer.tsx`)

| Check | Expected | Actual | Status |
|---|---|---|---|
| Mobile slide-up | 250ms, `Easing.out` | `withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) })` | PASS |
| Web scale | 200ms, `Easing.out` | `withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })` | PASS |
| Backdrop color | `colors.bg.overlay` | Hardcoded `'rgba(0,0,0,0.6)'` | FAIL — should reference token |
| Close button touch | >= 44pt | hitSlop=8 + padding=8 + icon=18 = ~34pt | FAIL — below 44pt |
| Animation library | Reanimated | `react-native-reanimated` | PASS |
| Title fontSize | `typography.size.lg` | Hardcoded `fontSize: 18` | FAIL — should reference token |
| Drag handle radius | token | Hardcoded `borderRadius: 2` | MINOR |

### 2.4 EmptyState (`app/components/common/EmptyState.tsx`)

| Check | Expected | Actual | Status |
|---|---|---|---|
| Icon container | 48x48 | `width: 48, height: 48` | PASS |
| Spacing tokens | All from `spacing.*` | Uses spacing[8], [6], [3], [2], [4] | PASS |
| Typography tokens | All from `typography.*` | Uses typography.size.md, weight.semibold | PASS |
| Color tokens | All from `colors.*` | Uses colors.text.secondary, text.muted | PASS |
| Letter spacing | Token | Hardcoded `letterSpacing: -0.25` | FAIL — should use `letterSpacing.tight` |

---

## 3. Training Component Set Audit

### 3.1 Animation Library Consistency

The training directory (20 files) is the worst offender for animation library inconsistency.

| Component | Animation Library | API Used | Severity |
|---|---|---|---|
| PRBanner | RN Animated | `Animated.spring` (damping:12, stiffness:200) | HIGH |
| RestTimerRing | RN Animated | `Animated.timing` (duration:300) | HIGH |
| RestTimerV2 | RN Animated | `Animated.timing` (duration:300) | HIGH |
| RestTimerBar | RN Animated | `Animated.spring` (damping:20, stiffness:200, mass:0.5) | HIGH |
| RestTimer | RN LayoutAnimation | `LayoutAnimation.Presets.easeInEaseOut` | MEDIUM |
| ExerciseDetailSheet | RN Animated | `Animated.spring` + `Animated.timing` | HIGH |
| PreviousPerformance | RN Animated | `Animated.timing` (skeleton pulse) | HIGH |
| OverloadSuggestionBadge | RN Animated | `Animated` import | HIGH |
| RestTimerOverlay | none (delegates) | Delegates to RestTimerRing | OK |

**Total**: 7 components using RN Animated + 1 using LayoutAnimation = 8/20 training components with animation library mismatch.

### 3.2 RestTimer Variant Consistency

| Property | RestTimer | RestTimerV2 | RestTimerRing | RestTimerBar | RestTimerOverlay |
|---|---|---|---|---|---|
| Background | `colors.bg.overlay` | `colors.bg.overlay` | — | `colors.bg.surfaceRaised` | `colors.bg.overlay` |
| Container bg | none | `colors.bg.surfaceRaised` | — | — | `colors.bg.surfaceRaised` |
| Label font | `typography.size.md` | `typography.size.md` | — | — | `typography.size.md` |
| Timer font | 64px (computed) | 32px (`3xl`) | 32px (`3xl`) | 18px (`lg`) | — (via Ring) |
| Timer weight | `weight.bold` | `weight.bold` | `weight.bold` | `weight.bold` | — |
| Color tokens | All tokens | All tokens | All tokens | All tokens | All tokens |
| Animation lib | LayoutAnimation | RN Animated | RN Animated | RN Animated | none |
| Has ring | No | Yes (inline) | Yes (is ring) | Yes (via Ring) | Yes (via Ring) |
| Has adjust | No | Yes | No | No | Yes |
| Has pause | No | Yes | No | No | Yes |
| Has skip | Yes | Yes | No | Yes | Yes |
| Has settings | Yes | No | No | No | No |

**Key Inconsistencies**:
1. Timer font size varies: 64px / 32px / 32px / 18px — the 64px breaks the type scale
2. RestTimer has no progress ring while all others do — appears to be legacy
3. RestTimerV2 duplicates RestTimerRing SVG logic instead of composing it
4. All animated variants use RN Animated — consistent within set but inconsistent with project

### 3.3 Other Training Findings

| Component | Finding | Severity |
|---|---|---|
| RPEBadge | `#F97316` (orange) not in token system | MEDIUM |
| RPEPicker | Hardcoded `rgba(0,0,0,0.4)`, borderRadius `22` | MEDIUM |
| ExerciseDetailSheet | Hardcoded `#2563EB` fallback | MEDIUM |
| ConfirmationSheet | Hardcoded `rgba(0,0,0,0.5)` | MEDIUM |
| PRBanner | Custom spring (damping:12, stiffness:200) — no matching preset | HIGH |
| RestTimerBar | Spring matches `springs.gentle` but hardcoded | MEDIUM |

---

## 4. COMP-* Issue Log

| ID | Severity | Category | Title | File Path | Current | Target | Effort (h) | Phase |
|---|---|---|---|---|---|---|---|---|
| COMP-001 | High | animation | PRBanner uses RN Animated instead of Reanimated | training/PRBanner.tsx | `Animated.spring` from react-native | Migrate to `withSpring` from reanimated using `springs.bouncy` | 2 | 1 |
| COMP-002 | High | animation | RestTimerRing uses RN Animated | training/RestTimerRing.tsx | `Animated.timing` from react-native | Migrate to `withTiming` from reanimated | 1.5 | 1 |
| COMP-003 | High | animation | RestTimerV2 uses RN Animated | training/RestTimerV2.tsx | `Animated.timing` from react-native | Migrate to Reanimated; compose RestTimerRing | 2 | 1 |
| COMP-004 | High | animation | RestTimerBar uses RN Animated | training/RestTimerBar.tsx | `Animated.spring` from react-native | Migrate to `withSpring` using `springs.gentle` | 1 | 1 |
| COMP-005 | High | animation | ExerciseDetailSheet uses RN Animated | training/ExerciseDetailSheet.tsx | `Animated.spring` + `Animated.timing` | Migrate to Reanimated | 2 | 1 |
| COMP-006 | High | animation | PreviousPerformance uses RN Animated for skeleton | training/PreviousPerformance.tsx | Custom `Animated.timing` pulse loop | Replace with `useSkeletonPulse` hook or `Skeleton` component | 1 | 1 |
| COMP-007 | High | animation | OverloadSuggestionBadge uses RN Animated | training/OverloadSuggestionBadge.tsx | `Animated` from react-native | Migrate to Reanimated | 1 | 1 |
| COMP-008 | High | animation | BodySilhouette uses RN Animated | analytics/BodySilhouette.tsx | `Animated.timing` for region press | Migrate to Reanimated `withTiming` | 1 | 1 |
| COMP-009 | Medium | animation | Tooltip uses RN Animated | common/Tooltip.tsx | `Animated.timing` for fade-in | Migrate to Reanimated `withTiming` | 0.5 | 2 |
| COMP-010 | Medium | animation | CollapsibleSection uses LayoutAnimation | log/CollapsibleSection.tsx | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout animations | 1 | 2 |
| COMP-011 | Medium | animation | AccountSection uses LayoutAnimation | profile/AccountSection.tsx | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout animations | 1 | 2 |
| COMP-012 | Medium | animation | RestTimer uses LayoutAnimation | training/RestTimer.tsx | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout animations | 1 | 2 |
| COMP-013 | High | animation | PRBanner uses custom spring config | training/PRBanner.tsx | damping:12, stiffness:200 (no preset) | Use `springs.bouncy` for celebration | 0.5 | 1 |
| COMP-014 | Medium | animation | RestTimerBar hardcodes springs.gentle values | training/RestTimerBar.tsx | Inline damping:20, stiffness:200, mass:0.5 | Import and use `springs.gentle` token | 0.5 | 2 |
| COMP-015 | Medium | component | ModalContainer close button below 44pt | common/ModalContainer.tsx | hitSlop=8 + padding=8 + icon=18 = ~34pt | Increase hitSlop to 13 or padding to 13 | 0.5 | 1 |
| COMP-016 | Medium | token | ModalContainer hardcoded backdrop rgba | common/ModalContainer.tsx | `'rgba(0,0,0,0.6)'` | Use `colors.bg.overlay` | 0.25 | 2 |
| COMP-017 | Medium | token | ModalContainer hardcoded title fontSize | common/ModalContainer.tsx | `fontSize: 18` | Use `typography.size.lg` | 0.25 | 2 |
| COMP-018 | Medium | token | EmptyState hardcoded letterSpacing | common/EmptyState.tsx | `letterSpacing: -0.25` | Use `letterSpacing.tight` | 0.25 | 2 |
| COMP-019 | Medium | token | Button hardcoded disabled opacity | common/Button.tsx | `opacity: 0.4` | Use `opacityScale.disabled` | 0.25 | 2 |
| COMP-020 | Medium | token | BarcodeScanner hardcoded fontWeight x5 | nutrition/BarcodeScanner.tsx | `fontWeight: '600'`, `'700'` | Use `typography.weight.semibold`, `.bold` | 0.5 | 2 |
| COMP-021 | Medium | token | BarcodeScanner hardcoded rgba overlays x3 | nutrition/BarcodeScanner.tsx | `rgba(0,0,0,0.6)` | Use `colors.bg.overlay` | 0.25 | 2 |
| COMP-022 | Medium | token | RPEBadge uses non-token orange color | training/RPEBadge.tsx | `#F97316` + `rgba(249,115,22,0.12)` | Add `colors.semantic.caution` or use warning | 0.5 | 2 |
| COMP-023 | Medium | token | AchievementCard hardcoded purple | achievements/AchievementCard.tsx | `#8B5CF6` | Add `colors.semantic.volume` token | 0.5 | 2 |
| COMP-024 | Medium | token | Exercise picker hardcoded #2563EB, #FFFFFF | exercise-picker/*.tsx | `#2563EB` fallback, `#FFFFFF` | Use `colors.accent.primary`, `colors.text.primary` | 1 | 2 |
| COMP-025 | Medium | token | SwipeableRow hardcoded #FFFFFF | common/SwipeableRow.tsx | `color: '#FFFFFF'` | Use `colors.text.primary` | 0.25 | 2 |
| COMP-026 | Medium | token | FatigueBreakdownModal hardcoded fontSize | analytics/FatigueBreakdownModal.tsx | `fontSize: 20`, `fontSize: 40` | Use `typography.size.xl`, `typography.size['3xl']` | 0.5 | 2 |
| COMP-027 | Medium | token | Multiple components hardcoded rgba overlays | Various (ConfirmationSheet, RPEPicker, CelebrationModal, PreferencesSection) | Various `rgba(0,0,0,0.X)` | Use `colors.bg.overlay` or add variants | 1 | 2 |
| COMP-028 | Medium | token | RecipeScalingModal hardcoded borderRadius | meal-prep/RecipeScalingModal.tsx | `borderRadius: 16`, `8` | Use `radius.lg`, `radius.sm` | 0.25 | 3 |
| COMP-029 | Medium | token | AddTrainingModal hardcoded padding | modals/AddTrainingModal.tsx | `padding: 12` | Use `spacing[3]` | 0.25 | 3 |
| COMP-030 | Medium | token | MealBuilder hardcoded #ef4444 fallback | nutrition/MealBuilder.tsx | `colors.semantic.negative ?? '#ef4444'` | Remove fallback — token always defined | 0.25 | 3 |
| COMP-031 | Medium | token | BudgetBar hardcoded borderRadius 3 | nutrition/BudgetBar.tsx | `borderRadius: 3` | Add `radius.xs` token or use computed | 0.5 | 3 |
| COMP-032 | Low | token | Dot/circle borderRadius hardcoded | Multiple files | `borderRadius: N` where N=width/2 | Acceptable for circle pattern; consider `radius.full` | 0 | — |
| COMP-033 | Low | token | Emoji fontSize hardcoded | PRBanner, LightingReminder, PoseSelector, etc. | Hardcoded fontSize for emoji | Platform-dependent; low priority | 0 | — |
| COMP-034 | Medium | token | Card raised variant hardcoded rgba highlight | common/Card.tsx | `borderTopColor: 'rgba(255,255,255,0.04)'` | Add `colors.border.highlight` token | 0.5 | 2 |
| COMP-035 | High | consistency | RestTimer uses 64px font outside type scale | training/RestTimer.tsx | `fontSize: typography.size['3xl'] * 2` = 64px | Add `typography.size['4xl']` or use `3xl` | 1 | 1 |

---

## Summary

### Token Compliance Distribution

| Level | Count | % |
|---|---|---|
| Full | 62 | 58% |
| Partial | 45 | 42% |
| None | 0 | 0% |

### Issue Severity Distribution

| Severity | Count |
|---|---|
| High | 10 (animation mismatches, custom springs, font scale violation) |
| Medium | 23 (hardcoded token values, rgba overlays, missing token refs) |
| Low | 2 (emoji sizing, circle borderRadius) |

### Top Priority Fixes

1. **Migrate 8 training components from RN Animated to Reanimated** (~11.5h)
2. **Replace hardcoded rgba overlays with `colors.bg.overlay`** across 6+ components (~1.5h)
3. **Fix ModalContainer close button touch target** to meet 44pt minimum (~0.5h)
4. **Add missing token for orange RPE color** (`#F97316`) (~0.5h)
5. **Standardize RestTimer font size** — 64px is outside the type scale (~1h)
