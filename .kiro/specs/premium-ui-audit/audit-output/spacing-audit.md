# Spacing and Layout System Audit — Hypertrophy OS

> Source: `app/theme/tokens.ts` spacing and radius exports
> Audit scope: 4 primary tab screens, 3 high-density screens, 7 spacing hotspots, thumb-zone ergonomics

---

## 1. Spacing Scale (Section 7.1)

**Validates: Requirement 5.1**

### Spacing Tokens (`spacing`)

8px grid system with 11 steps (keys 0–16, non-contiguous).

| Key | Value (px) | Tier | Common Usage |
|-----|-----------|------|-------------|
| `spacing[0]` | `0` | — | Reset |
| `spacing[1]` | `4` | Internal | Tight internal gaps, icon-to-text |
| `spacing[2]` | `8` | Internal | Component internal padding |
| `spacing[3]` | `12` | Item | Item gaps within sections |
| `spacing[4]` | `16` | Item | Card padding, standard gap |
| `spacing[5]` | `20` | — | Medium section gap (rarely used) |
| `spacing[6]` | `24` | Section | Section dividers |
| `spacing[8]` | `32` | Section | Major section gaps |
| `spacing[10]` | `40` | — | Large spacing |
| `spacing[12]` | `48` | — | Extra large spacing, bottom padding |
| `spacing[16]` | `64` | — | Maximum spacing |

> Note: Keys 7, 9, 11, 13, 14, 15 are not defined. The scale jumps 6→8→10→12→16.

### Radius Tokens (`radius`)

| Token | Value (px) | Usage |
|-------|-----------|-------|
| `radius.sm` | `8` | Small elements, badges, chips, tabs |
| `radius.md` | `12` | Cards, inputs, buttons |
| `radius.lg` | `16` | Large cards, modals |
| `radius.full` | `9999` | Circles, pills |

### 3-Tier Spacing Hierarchy (Expected)

| Tier | Token Range | Pixel Range | Purpose |
|------|------------|-------------|---------|
| Section | `spacing[6]`–`spacing[8]` | 24–32px | Between major screen sections |
| Item | `spacing[3]`–`spacing[4]` | 12–16px | Between items within a section |
| Internal | `spacing[1]`–`spacing[2]` | 4–8px | Within a component |


---

## 2. Screen-Level Horizontal Padding (Section 7.2)

**Validates: Requirement 5.2**

### Methodology

Extracted the root `contentContainerStyle` (or equivalent) from each primary tab screen's ScrollView/FlatList.

### Findings

| Screen | File | Style Property | Value | Token | Consistent? |
|--------|------|---------------|-------|-------|-------------|
| DashboardScreen | `screens/dashboard/DashboardScreen.tsx` | `content: { padding: spacing[4] }` | 16px | `spacing[4]` | ✅ |
| LogsScreen | `screens/logs/LogsScreen.tsx` | `listContent: { padding: spacing[4], paddingTop: 0 }` | 16px horizontal | `spacing[4]` | ✅ |
| AnalyticsScreen | `screens/analytics/AnalyticsScreen.tsx` | `content: { padding: spacing[4] }` | 16px | `spacing[4]` | ✅ |
| ProfileScreen | `screens/profile/ProfileScreen.tsx` | `content: { padding: spacing[4] }` | 16px | `spacing[4]` | ✅ |

### Assessment

All 4 primary tab screens use `spacing[4]` (16px) for horizontal padding via the `padding` shorthand property. This is **fully consistent**.

Note: All screens also use `paddingBottom: spacing[12]` (48px) for scroll overscroll, which is consistent.

LogsScreen uses `paddingTop: 0` to override the top padding from the shorthand — this is intentional since the tab bar and date nav sit above the scrollable content area.

### Pattern Details

- All screens use `padding: spacing[4]` as the base, which sets all four sides to 16px
- `paddingBottom: spacing[12]` overrides bottom to 48px for comfortable scroll overscroll
- No screen uses `paddingHorizontal` explicitly — they all use the `padding` shorthand
- This is a clean, consistent pattern

**Result: ✅ PASS — No inconsistencies found. No SPACE issues to log for this section.**


---

## 3. Content Density Evaluation (Section 7.3)

**Validates: Requirements 5.3, 5.4**

### Expected 3-Tier Hierarchy

| Tier | Expected Token | Expected Pixels |
|------|---------------|----------------|
| Section gaps | `spacing[6]`–`spacing[8]` | 24–32px |
| Item gaps | `spacing[3]`–`spacing[4]` | 12–16px |
| Internal gaps | `spacing[1]`–`spacing[2]` | 4–8px |

---

### (a) DashboardScreen

| Gap Between | Mechanism | Value | Tier | Compliant? |
|------------|-----------|-------|------|-----------|
| Header → DateScroller | No explicit gap; Animated.View siblings | 0px (relies on component margins) | — | ⚠️ No section gap |
| DateScroller → QuickActions | No explicit gap | 0px | — | ⚠️ No section gap |
| QuickActions → MacroRingsRow | No explicit gap | 0px | — | ⚠️ No section gap |
| MacroRingsRow → BudgetBar | BudgetBar `container.marginBottom: spacing[3]` | 12px | Item | ⚠️ Missing marginTop on BudgetBar; gap is only from BudgetBar's own bottom margin to next element |
| BudgetBar → MealSlotDiary | BudgetBar `marginBottom: spacing[3]` | 12px | Item | ✅ Item-level |
| MealSlotDiary → TodaySummaryRow | `summarySection.marginTop: spacing[6]` | 24px | Section | ✅ Section-level |
| TodaySummaryRow → WeightTrend | `trendSection.marginTop: spacing[3]` | 12px | Item | ✅ Item-level |
| WeightTrend → MilestoneBanner | `milestoneBanner.marginTop: spacing[3]` | 12px | Item | ✅ Item-level |

**Assessment:** The Dashboard relies heavily on individual component margins rather than a consistent section-level gap system. The top portion (Header → DateScroller → QuickActions → MacroRingsRow) has **no explicit section gaps** — sections flow directly into each other with only the global `padding: spacing[4]` providing horizontal breathing room. The lower portion (TodaySummaryRow onward) correctly uses `spacing[6]` for section separation.

**Issue:** The Dashboard's top half feels dense because there are no section-level gaps (24–32px) between the major content blocks. The `Animated.View` wrappers for staggered entrance don't add any margin.

---

### (b) AnalyticsScreen

| Gap Between | Mechanism | Value | Tier | Compliant? |
|------------|-----------|-------|------|-----------|
| Title → Tab Pills | `title.marginBottom: spacing[4]` | 16px | Item | ✅ |
| Tab Pills → TimeRange | `analyticsTabRow.marginBottom: spacing[3]` | 12px | Item | ✅ |
| Section Title → Content | `sectionTitle.marginBottom: spacing[3]` | 12px | Item | ✅ |
| Content → Next Section Title | `sectionTitle.marginTop: spacing[5]` | 20px | ⚠️ | Between item and section tier |
| Card → Card (within section) | No explicit gap; Cards have internal padding only | 0px | — | ⚠️ No item gap |

**Assessment:** AnalyticsScreen uses `spacing[5]` (20px) for section-to-section gaps via `sectionTitle.marginTop`. This is **below the expected section tier** of `spacing[6]`–`spacing[8]` (24–32px). The vertical rhythm is consistent but slightly tight. The gap between a Card's bottom and the next sectionTitle is only 20px, which doesn't create strong visual separation between major sections.

**Issue:** Section gaps use `spacing[5]` (20px) instead of `spacing[6]` (24px) or `spacing[8]` (32px). This makes the analytics screen feel slightly cramped when scrolling through multiple chart sections.

---

### (c) ActiveWorkoutScreen

| Gap Between | Mechanism | Value | Tier | Compliant? |
|------------|-----------|-------|------|-----------|
| Top bar → Scroll content | `scrollContent.padding: spacing[4]` | 16px top | Item | ✅ |
| Exercise card → Exercise card | `exerciseCard.marginBottom: spacing[4]` | 16px | Item | ✅ |
| Exercise header → Set header row | `exerciseHeader.marginBottom: spacing[2]` | 8px | Internal | ✅ |
| Set header → First set row | `setHeaderRow.marginBottom: spacing[1]` | 4px | Internal | ✅ |
| Set row → Set row | `setRow.paddingVertical: spacing[1]` | 4px (8px total) | Internal | ✅ |
| Last set → Add set button | `addSetBtn.paddingVertical: spacing[2]` | 8px | Internal | ✅ |
| Exercise card → Add exercise button | `addExerciseBtn.marginBottom: spacing[4]` | 16px | Item | ✅ |

**Assessment:** ActiveWorkoutScreen has the **best spacing hierarchy** of the three screens. Exercise cards use `spacing[4]` (16px) for item-level separation, internal elements use `spacing[1]`–`spacing[2]` (4–8px), and the overall structure is clean. However, there is **no section-level gap** (24–32px) — the screen is a flat list of exercise cards with uniform 16px gaps. During a workout with 5+ exercises, this can feel monotonous.

**Issue:** The set rows use `spacing[1]` (4px) vertical padding, giving only 8px between rows. Combined with `minHeight: 36` for set rows, this is functional but tight for a workout context where users have sweaty fingers and need quick input. The density is appropriate for the use case but could benefit from slightly more breathing room.

---

### Summary: 3-Tier Hierarchy Compliance

| Screen | Section Tier (24–32px) | Item Tier (12–16px) | Internal Tier (4–8px) | Overall |
|--------|----------------------|--------------------|--------------------|---------|
| DashboardScreen | ⚠️ Partial — only TodaySummaryRow uses `spacing[6]`; top sections have no gaps | ✅ `spacing[3]` used consistently | ✅ `spacing[1]`–`spacing[2]` | ⚠️ Mixed |
| AnalyticsScreen | ⚠️ Uses `spacing[5]` (20px) — below threshold | ✅ `spacing[3]` used consistently | ✅ `spacing[1]`–`spacing[2]` | ⚠️ Slightly tight |
| ActiveWorkoutScreen | ❌ No section-level gaps | ✅ `spacing[4]` between exercise cards | ✅ `spacing[1]`–`spacing[2]` within cards | ⚠️ Flat hierarchy |


---

## 4. Spacing Hotspots (Section 7.4)

**Validates: Requirement 5.6**

### Hotspot 1: MacroRingsRow Ring Gaps

**File:** `app/components/dashboard/MacroRingsRow.tsx`

| Property | Value | Token? | On Scale? |
|----------|-------|--------|-----------|
| `container.gap` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `container.justifyContent` | `center` | — | — |

**Assessment:** ✅ Clean. Uses `spacing[3]` (12px) gap between the 4 ProgressRing components. This is item-level spacing, appropriate for rings within a single row component.

---

### Hotspot 2: BudgetBar Internal Padding

**File:** `app/components/nutrition/BudgetBar.tsx`

| Property | Value | Token? | On Scale? |
|----------|-------|--------|-----------|
| `container.padding` | `spacing[4]` | ✅ Yes | ✅ 16px |
| `container.marginBottom` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `calorieRow.gap` | `spacing[2]` | ✅ Yes | ✅ 8px |
| `calorieRow.marginBottom` | `spacing[2]` | ✅ Yes | ✅ 8px |
| `progressTrack.height` | `6` | ❌ Hardcoded | ❌ Not on scale |
| `progressTrack.borderRadius` | `3` | ❌ Hardcoded | ❌ Not on scale |
| `progressFill.borderRadius` | `3` | ❌ Hardcoded | ❌ Not on scale |
| `progressTrack.marginBottom` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `macroLabel.marginBottom` | `2` | ❌ Hardcoded | ❌ Not on scale |

**Assessment:** ⚠️ Mixed. Container padding and major gaps use tokens correctly. However, the progress track uses hardcoded `height: 6` and `borderRadius: 3` — these are design-specific values for the thin progress bar that don't map to the spacing/radius scale. The `marginBottom: 2` on macroLabel is a minor hardcoded value.

**Issues:**
- `height: 6` — Consider defining a `progressTrackHeight` constant or using `spacing[1]` (4px) + 2
- `borderRadius: 3` — Half of track height, intentional for pill shape, but not on radius scale
- `marginBottom: 2` — Should be `spacing[1]` (4px) or 0

---

### Hotspot 3: MealSlotGroup Section Spacing

**File:** `app/components/dashboard/MealSlotGroup.tsx`

| Property | Value | Token? | On Scale? |
|----------|-------|--------|-----------|
| `container.marginBottom` | `spacing[2]` | ✅ Yes | ✅ 8px |
| `header.paddingVertical` | `spacing[2]` | ✅ Yes | ✅ 8px |
| `header.paddingHorizontal` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `body.paddingLeft` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `body.paddingTop` | `spacing[1]` | ✅ Yes | ✅ 4px |
| `entryRow.paddingVertical` | `spacing[1]` | ✅ Yes | ✅ 4px |
| `addButton.paddingVertical` | `spacing[2]` | ✅ Yes | ✅ 8px |
| `entryTime.marginTop` | `1` | ❌ Hardcoded | ❌ Not on scale |

**Assessment:** ✅ Mostly clean. All major spacing uses tokens. The `marginTop: 1` on entryTime is a cosmetic micro-adjustment (1px) that's too small for the spacing scale — acceptable as a one-off.

The `container.marginBottom: spacing[2]` (8px) between meal slot groups is internal-tier spacing, which is correct since these are items within the MealSlotDiary component.

---

### Hotspot 4: ExerciseCard Item Gaps in ExercisePickerScreen

**File:** `app/components/exercise-picker/ExerciseCard.tsx`

| Property | Value | Token? | On Scale? |
|----------|-------|--------|-----------|
| `container.paddingHorizontal` | `spacing[4]` | ✅ Yes | ✅ 16px |
| `container.paddingVertical` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `info.marginLeft` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `tagRow.gap` | `spacing[1]` | ✅ Yes | ✅ 4px |
| `tagRow.marginTop` | `4` | ❌ Hardcoded | ⚠️ Matches `spacing[1]` value |
| `equipmentTag.paddingVertical` | `2` | ❌ Hardcoded | ❌ Not on scale |
| `categoryTag.paddingVertical` | `2` | ❌ Hardcoded | ❌ Not on scale |
| `chevron.marginLeft` | `spacing[2]` | ✅ Yes | ✅ 8px |

**Assessment:** ⚠️ Mixed. Major layout spacing uses tokens. However:
- `marginTop: 4` should be `spacing[1]` — the value matches but doesn't use the token
- `paddingVertical: 2` on tags is below the spacing scale minimum (`spacing[1]` = 4px). This creates very tight tag pills. Consider using `spacing[1]` (4px) for more comfortable touch targets on tags.

---

### Hotspot 5: RestTimer Overlay Padding

**File:** `app/components/training/RestTimer.tsx`

| Property | Value | Token? | On Scale? |
|----------|-------|--------|-----------|
| `container.padding` | `spacing[8]` | ✅ Yes | ✅ 32px |
| `header.gap` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `header.marginBottom` | `spacing[2]` | ✅ Yes | ✅ 8px |
| `countdown.marginBottom` | `spacing[6]` | ✅ Yes | ✅ 24px |
| `gearBtn.padding` | `spacing[1]` | ✅ Yes | ✅ 4px |
| `skipBtn.paddingHorizontal` | `spacing[6]` | ✅ Yes | ✅ 24px |
| `skipBtn.paddingVertical` | `spacing[3]` | ✅ Yes | ✅ 12px |
| `settingsPanel.padding` | `spacing[4]` | ✅ Yes | ✅ 16px |
| `settingsPanel.marginBottom` | `spacing[4]` | ✅ Yes | ✅ 16px |
| `settingsRow.marginBottom` | `spacing[3]` | ✅ Yes | ✅ 12px |

**Assessment:** ✅ Excellent. RestTimer is fully token-compliant for spacing. The `spacing[8]` (32px) container padding is generous and appropriate for a modal overlay that needs to feel spacious during rest periods. All internal spacing follows the hierarchy correctly.

**Note:** The `gearBtn.padding: spacing[1]` (4px) creates a very small touch target — this is flagged separately in the accessibility audit (A11Y touch target section), not a spacing scale issue.

---

### Hotspot 6: Set Row Spacing in ActiveWorkoutScreen

**File:** `app/screens/training/ActiveWorkoutScreen.tsx`

| Property | Value | Token? | On Scale? |
|----------|-------|--------|-----------|
| `setRow.paddingVertical` | `spacing[1]` | ✅ Yes | ✅ 4px |
| `setRow.minHeight` | `36` | ❌ Hardcoded | ❌ Not on scale |
| `setInput.paddingVertical` | `4` (iOS) / `2` (Android) | ❌ Hardcoded | ⚠️ Platform-specific |
| `setInput.paddingHorizontal` | `4` | ❌ Hardcoded | ⚠️ Matches `spacing[1]` |
| `setInput.borderRadius` | `4` | ❌ Hardcoded | ❌ Not on scale |
| `setHeaderRow.paddingVertical` | `spacing[1]` | ✅ Yes | ✅ 4px |
| `setHeaderRow.marginBottom` | `spacing[1]` | ✅ Yes | ✅ 4px |

**Assessment:** ⚠️ Mixed. The set row uses `spacing[1]` for vertical padding (correct internal-tier), but the TextInput cells use hardcoded platform-specific padding values. The `minHeight: 36` is a touch-target consideration, not a spacing scale value. The `borderRadius: 4` should be `radius.sm / 2` or a defined constant.

---

### Hotspot 7: Dashboard Card-to-Card Gaps

**File:** `app/screens/dashboard/DashboardScreen.tsx`

The Dashboard doesn't use explicit card-to-card gaps. Content sections are wrapped in `Animated.View` for staggered entrance, and gaps come from individual component margins:

| Component | Bottom Margin | Token? |
|-----------|--------------|--------|
| BudgetBar | `spacing[3]` (12px) | ✅ |
| MealSlotDiary | `spacing[3]` (12px) | ✅ |
| MilestoneBanner | `spacing[3]` (12px) via marginTop | ✅ |
| TodaySummaryRow section | `spacing[6]` (24px) via marginTop | ✅ |

**Hardcoded values found in DashboardScreen styles:**

| Style | Property | Value | Should Be |
|-------|----------|-------|-----------|
| `dateLoadingOverlay` | `borderRadius` | `12` | `radius.md` |
| `nutritionSummary` | `gap` | `16` | `spacing[4]` |
| `milestoneBanner` | `borderRadius` | `8` | `radius.sm` |
| `nutritionItem` | `fontSize` | `13` | `typography.size.sm` |
| `infoIcon` | `fontSize` | `14` | `typography.size.base` |

**Assessment:** ⚠️ The Dashboard has 5 hardcoded values that should use tokens. The card-to-card gaps are consistent at `spacing[3]` (12px) which is item-level — appropriate for cards within the same scroll. However, the lack of section-level gaps (24–32px) between major content areas (rings → budget → meals) makes the top of the dashboard feel dense.

---

### Hotspot Summary

| Hotspot | Token Compliance | Scale Compliance | Issues |
|---------|-----------------|-----------------|--------|
| MacroRingsRow ring gaps | ✅ Full | ✅ | None |
| BudgetBar internal padding | ⚠️ Partial | ⚠️ | 3 hardcoded values (track height, borderRadius, marginBottom) |
| MealSlotGroup spacing | ✅ Near-full | ✅ | 1 minor hardcoded (marginTop: 1) |
| ExerciseCard gaps | ⚠️ Partial | ⚠️ | 3 hardcoded values (marginTop: 4, paddingVertical: 2 ×2) |
| RestTimer overlay padding | ✅ Full | ✅ | None |
| Set row spacing | ⚠️ Partial | ⚠️ | 4 hardcoded values (minHeight, padding, borderRadius) |
| Dashboard card gaps | ⚠️ Partial | ⚠️ | 5 hardcoded values (borderRadius, gap, fontSize) |


---

## 5. Thumb-Zone Ergonomics (Section 7.5)

**Validates: Requirement 5.5**

### Primary Action Button Positioning

| Action | Component | File | Position | Bottom 40%? | Notes |
|--------|-----------|------|----------|-------------|-------|
| Add entry (FAB) | LogsScreen FAB | `screens/logs/LogsScreen.tsx` | `position: absolute, bottom: spacing[6]` (24px from bottom) | ✅ Yes | 56×56px circle, bottom-right corner. Excellent thumb-zone placement. |
| Finish Workout | FinishBar | `components/training/FinishBar.tsx` | Fixed at bottom, `height: 72` | ✅ Yes | Sticky bottom bar with full-width button. Ideal placement. |
| Log Set (checkmark) | SetRow in ActiveWorkoutScreen | `screens/training/ActiveWorkoutScreen.tsx` | Inline in scrollable content | ⚠️ Varies | Checkmark is at the right edge of each set row. Position depends on scroll — not fixed to bottom. During a workout, the current set row may be anywhere on screen. |
| Tab Bar | BottomTabNavigator | `navigation/BottomTabNavigator.tsx` | Fixed at bottom | ✅ Yes | Standard bottom tab bar. |
| Modal Actions | Various modals | `components/modals/*.tsx` | Bottom of modal sheet | ✅ Yes | Modals slide up from bottom, action buttons are at the bottom of the modal content. |
| Quick Log buttons | DashboardScreen | `screens/dashboard/DashboardScreen.tsx` | Near top of scroll content | ❌ No | Quick Action buttons (Log Food, Training, Bodyweight) are positioned above the fold but in the top 30% of the screen. Users must reach up to tap them. |

### Tab Bar Sizing

**File:** `app/navigation/BottomTabNavigator.tsx`

| Property | Value | Assessment |
|----------|-------|-----------|
| `tabBar.paddingTop` | `spacing[1]` (4px) | Minimal top padding |
| `iconWrap` size | `width: 32, height: 28` | ⚠️ Below 44×44pt minimum |
| `iconWrap` + tab button padding | ~32×28 + system tab button padding | ⚠️ Effective touch area depends on tab bar implementation |
| `TabSvgIcon` size | `22px` | Icon itself is small |
| `tabLabel.fontSize` | `typography.size.xs` (12px) | Appropriate for tab labels |
| `tabLabel.marginTop` | `spacing[1]` (4px) | Tight spacing between icon and label |

**Assessment:** The `iconWrap` at 32×28px is below the 44×44pt minimum touch target. However, the `@react-navigation/bottom-tabs` library typically provides its own touch area that extends beyond the icon wrapper. The effective touch area is likely adequate due to the tab button container, but the visual icon area is small. This is flagged in the accessibility audit.

### Modal Action Button Reachability

| Modal | Action Button Position | Reachable? |
|-------|----------------------|-----------|
| AddNutritionModal | Bottom of scrollable content within ModalContainer | ✅ Yes — ModalContainer slides up from bottom |
| AddTrainingModal | Bottom of modal content | ✅ Yes |
| AddBodyweightModal | Bottom of modal content | ✅ Yes |
| QuickAddModal | Bottom of modal content | ✅ Yes |
| RestTimer | Center of overlay (Skip button) | ✅ Yes — centered, large touch target |

### Ergonomic Assessment

**Strengths:**
- FinishBar is perfectly positioned as a sticky bottom bar — the most critical action (finishing a workout) is always in the thumb zone
- LogsScreen FAB at `bottom: spacing[6]` is in the ideal thumb-zone position
- Tab bar is at the bottom as expected
- Modal actions are reachable via bottom-sheet pattern

**Concerns:**
- **DashboardScreen Quick Actions** are positioned near the top of the scroll content. For a one-handed grip, users must reach up to tap "Log Food" or "Training". Consider: (a) moving Quick Actions to a sticky bottom bar, or (b) adding a FAB on the Dashboard similar to LogsScreen
- **ActiveWorkoutScreen set completion** — the checkmark button is inline with each set row. During a workout, the user may need to scroll to find the current set. The set row is not auto-scrolled into view after completing the previous set. Consider auto-scrolling to the next incomplete set.
- **Tab bar icon wrap** at 32×28px is visually small, though the effective touch area from the tab bar container is likely adequate


---

## 6. SPACE-* Issues (Section 7.7)

**Validates: Requirements 5.2, 5.3, 5.5, 5.6**

### Issue Log

| ID | Severity | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase |
|----|----------|----------|-------|---------|--------------|-------------|-----------|-------|
| SPACE-001 | Medium | spacing | DashboardScreen top sections lack section-level gaps | `app/screens/dashboard/DashboardScreen.tsx` | Animated.View sections (Header → DateScroller → QuickActions → MacroRingsRow) have no explicit gaps between them; content flows with 0px separation | Add `marginBottom: spacing[6]` (24px) to QuickActions and MacroRingsRow wrapper Animated.Views to create section-level breathing room | 1 | 3 |
| SPACE-002 | Medium | spacing | AnalyticsScreen section gaps use spacing[5] instead of spacing[6-8] | `app/screens/analytics/AnalyticsScreen.tsx` | `sectionTitle.marginTop: spacing[5]` (20px) — below section-tier threshold | Change `sectionTitle.marginTop` to `spacing[6]` (24px) for proper section-level separation | 0.5 | 3 |
| SPACE-003 | Medium | spacing | DashboardScreen hardcoded borderRadius values | `app/screens/dashboard/DashboardScreen.tsx` | `dateLoadingOverlay.borderRadius: 12`, `milestoneBanner.borderRadius: 8` | Replace with `radius.md` (12) and `radius.sm` (8) respectively | 0.5 | 3 |
| SPACE-004 | Medium | spacing | DashboardScreen hardcoded gap and fontSize values | `app/screens/dashboard/DashboardScreen.tsx` | `nutritionSummary.gap: 16`, `nutritionItem.fontSize: 13`, `infoIcon.fontSize: 14` | Replace with `spacing[4]`, `typography.size.sm`, `typography.size.base` | 0.5 | 3 |
| SPACE-005 | Medium | spacing | BudgetBar hardcoded progress track values | `app/components/nutrition/BudgetBar.tsx` | `progressTrack.height: 6`, `progressTrack.borderRadius: 3`, `progressFill.borderRadius: 3`, `macroLabel.marginBottom: 2` | Define progress track height constant; use `spacing[1]` for marginBottom; borderRadius = height/2 is intentional for pill shape | 0.5 | 3 |
| SPACE-006 | Medium | spacing | ExerciseCard hardcoded spacing values | `app/components/exercise-picker/ExerciseCard.tsx` | `tagRow.marginTop: 4`, `equipmentTag.paddingVertical: 2`, `categoryTag.paddingVertical: 2` | Replace `marginTop: 4` with `spacing[1]`; consider `spacing[1]` (4px) for tag paddingVertical for better touch targets | 0.5 | 3 |
| SPACE-007 | Medium | spacing | ActiveWorkoutScreen set input hardcoded values | `app/screens/training/ActiveWorkoutScreen.tsx` | `setInput.paddingVertical: 4/2` (platform-specific), `setInput.paddingHorizontal: 4`, `setInput.borderRadius: 4`, `setRow.minHeight: 36` | Replace padding with `spacing[1]`, borderRadius with `radius.sm / 2` or define a constant | 1 | 3 |
| SPACE-008 | Medium | density | DashboardScreen top-half density — no section gaps between major content blocks | `app/screens/dashboard/DashboardScreen.tsx` | MacroRingsRow, BudgetBar, MealSlotDiary flow with only item-level gaps (12px); no section-level separation (24–32px) | Add `spacing[6]` (24px) marginTop to BudgetBar and MealSlotDiary sections to create visual breathing room between major dashboard sections | 1 | 3 |
| SPACE-009 | Medium | density | AnalyticsScreen slightly tight section separation | `app/screens/analytics/AnalyticsScreen.tsx` | Section titles use `marginTop: spacing[5]` (20px) — between item and section tiers | Increase to `spacing[6]` (24px) for clearer section boundaries when scrolling through charts | 0.5 | 3 |
| SPACE-010 | High | density | ActiveWorkoutScreen flat spacing hierarchy — no section-level gaps | `app/screens/training/ActiveWorkoutScreen.tsx` | All exercise cards separated by uniform `spacing[4]` (16px); no visual grouping for supersets or exercise groups | Add `spacing[6]` (24px) gap before superset groups; consider visual dividers between exercise blocks during long workouts | 1.5 | 2 |
| SPACE-011 | High | thumb-zone | DashboardScreen Quick Actions not in thumb zone | `app/screens/dashboard/DashboardScreen.tsx` | Quick Action buttons (Log Food, Training, Bodyweight) are in the top 30% of scroll content — requires reaching up for one-handed use | Consider adding a FAB or sticky bottom quick-action bar similar to LogsScreen's FAB pattern | 3 | 3 |
| SPACE-012 | Medium | thumb-zone | Tab bar iconWrap below 44pt minimum | `app/navigation/BottomTabNavigator.tsx` | `iconWrap: { width: 32, height: 28 }` — visual icon area is 32×28px | Increase `iconWrap` to `width: 44, height: 44` or add `hitSlop` to ensure 44×44pt effective touch area (note: tab bar container may already provide adequate touch area) | 1 | 2 |

### Summary

| Category | Count | Severity Distribution |
|----------|-------|--------------------|
| Spacing scale violations | 5 (SPACE-003 through SPACE-007) | All Medium |
| Density problems | 3 (SPACE-008, SPACE-009, SPACE-010) | 1 High, 2 Medium |
| Thumb-zone | 2 (SPACE-011, SPACE-012) | 1 High, 1 Medium |
| Padding inconsistencies | 0 | — (all 4 screens consistent) |
| **Total** | **12** | **2 High, 10 Medium** |

**Total estimated effort: 11 hours**

