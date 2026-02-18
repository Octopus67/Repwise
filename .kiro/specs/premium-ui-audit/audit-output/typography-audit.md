# Typography System Audit — Hypertrophy OS

> Source: Static analysis of `app/theme/tokens.ts` and all screen/component `.tsx` files.
> Reference: Token Baseline (`audit-output/token-baseline.md`), Requirement 4.

---

## 1. Type System Documentation

### 1.1 Font Families (`typography.fontFamily`)

| Token Path | Value | Platform / Usage |
|---|---|---|
| `typography.fontFamily.sans` | `Inter` | Cross-platform primary typeface |
| `typography.fontFamily.sansIOS` | `SF Pro Display` | iOS system font fallback |
| `typography.fontFamily.mono` | `JetBrains Mono` | Monospace for code/data displays |

**Assessment:** Good 3-family system. Inter is an excellent choice for data-dense fitness UI — it has tabular figures built in, wide language support, and excellent legibility at small sizes. SF Pro Display for iOS ensures native feel. JetBrains Mono for monospace data is a strong choice.

### 1.2 Font Weights (`typography.weight`)

| Token Path | Value | Intended Role |
|---|---|---|
| `typography.weight.regular` | `'400'` | Body text, descriptions |
| `typography.weight.medium` | `'500'` | Secondary labels, metadata |
| `typography.weight.semibold` | `'600'` | Section headers, card titles, screen titles |
| `typography.weight.bold` | `'700'` | Primary data values, hero numbers |

**Assessment:** 4-weight scale provides sufficient hierarchy. The gap between regular (400) and medium (500) is subtle but perceptible in Inter. The semibold (600) to bold (700) gap is tighter — consider whether both are needed or if one could be dropped for simplicity.

### 1.3 Font Sizes (`typography.size`)

| Token Path | Value (px) | Role |
|---|---|---|
| `typography.size.xs` | `12` | Captions, badges, timestamps |
| `typography.size.sm` | `13` | Small labels, secondary info |
| `typography.size.base` | `14` | Body text default |
| `typography.size.md` | `16` | Card titles, form labels |
| `typography.size.lg` | `18` | Section headers |
| `typography.size.xl` | `20` | Screen titles |
| `typography.size['2xl']` | `24` | Large display values, avatar text |
| `typography.size['3xl']` | `32` | Hero numbers (RestTimer uses `3xl * 2` = 64px) |

**Assessment:** 8-step scale with a 1.2–1.33× ratio between steps. The xs→sm jump (12→13) is only 1px — barely perceptible. The 3xl (32px) is the largest token, but RestTimer computes `3xl * 2 = 64px` inline, which breaks the token system. This should be a dedicated token (e.g., `typography.size['5xl'] = 64`).

### 1.4 Line Heights (`typography.lineHeight`)

| Token Path | Value (multiplier) | Usage |
|---|---|---|
| `typography.lineHeight.tight` | `1.2` | Headings, large display text |
| `typography.lineHeight.normal` | `1.5` | Body text, descriptions |
| `typography.lineHeight.relaxed` | `1.625` | Long-form content, articles |

**Assessment:** Standard 3-tier line height system. The tight (1.2) is appropriate for headings. Normal (1.5) is the standard for body text readability. Relaxed (1.625) is good for article content. However, **no screen or component was found explicitly setting lineHeight** — React Native defaults are being used everywhere, which means the tokens exist but are unused.

### 1.5 Letter Spacing (`letterSpacing`)

| Token Path | Value (px) | Usage |
|---|---|---|
| `letterSpacing.tighter` | `-0.5` | Large display numbers |
| `letterSpacing.tight` | `-0.25` | Headings |
| `letterSpacing.normal` | `0` | Body text |
| `letterSpacing.wide` | `0.5` | Uppercase labels, badges |

**Assessment:** Good 4-value letter spacing scale. However, **no screen title or section header was found using letterSpacing tokens**. The tokens exist but are not applied to headings, which is a missed opportunity for premium typographic polish.

### 1.6 Numeric Font Variant (`typography.numeric`)

| Token Path | Value |
|---|---|
| `typography.numeric.fontVariant` | `['tabular-nums', 'lining-nums']` |

**Assessment:** The token is defined but **critically underused**. See Section 3 for detailed findings.

---

## 2. Heading Hierarchy Audit

### 2.1 Screen Title Styles — Primary Tab Screens

| Screen | Title Text | fontSize | fontWeight | letterSpacing | color | Pattern |
|---|---|---|---|---|---|---|
| DashboardScreen | *(no explicit title)* | — | — | — | — | Uses PremiumBadge in header row, no screen title text |
| LogsScreen | "Logs" | `typography.size.xl` (20) | `typography.weight.semibold` ('600') | *(none)* | `colors.text.primary` | Inline `<Text style={styles.title}>` |
| AnalyticsScreen | "Analytics" | `typography.size.xl` (20) | `typography.weight.semibold` ('600') | *(none)* | `colors.text.primary` | Inline `<Text style={styles.title}>` |
| ProfileScreen | *(no explicit title)* | — | — | — | — | Uses profile card with avatar, no screen title |

**Finding — TYPO-001 (Medium):** Screen title inconsistency across primary tabs. LogsScreen and AnalyticsScreen use `xl/semibold` titles, but DashboardScreen and ProfileScreen have no screen title at all. This creates an inconsistent navigation experience — users see "Logs" and "Analytics" as headers but the Dashboard and Profile tabs have no equivalent title.

**Finding — TYPO-002 (Medium):** No letterSpacing applied to any screen title. The `letterSpacing.tight` (-0.25) token exists specifically for headings but is unused. Adding tight letter spacing to screen titles would improve typographic polish.

### 2.2 Section Header Styles

The `SectionHeader` component (`app/components/common/SectionHeader.tsx`) is used consistently:
- `fontSize: typography.size.lg` (18)
- `fontWeight: typography.weight.semibold` ('600')
- `color: colors.text.primary`
- No letterSpacing

**Usage locations:**
- DashboardScreen: `<SectionHeader title="Quick Log" />`, `<SectionHeader title="Featured" />`
- ProfileScreen: `<SectionHeader title="Features" />`, `<SectionHeader title="Achievements" />`, `<SectionHeader title="Subscription" />`

**Finding:** SectionHeader is consistent where used. However, AnalyticsScreen uses inline `sectionTitle` style (`lg/semibold`) instead of the SectionHeader component — functionally identical but a consistency gap.

### 2.3 Body Text Styles

Body text across screens consistently uses:
- `fontSize: typography.size.base` (14) for primary body
- `fontSize: typography.size.sm` (13) for secondary/metadata
- `fontSize: typography.size.xs` (12) for captions/timestamps

**Finding:** Body text is well-tokenized across the codebase.

### 2.4 Hardcoded Typography Values

| File | Line Context | Hardcoded Value | Should Be |
|---|---|---|---|
| DashboardScreen.tsx | `nutritionItem` style | `fontSize: 13` | `typography.size.sm` |
| DashboardScreen.tsx | `infoIcon` style | `fontSize: 14` | `typography.size.base` |
| DashboardScreen.tsx | `dateLoadingOverlay` | `borderRadius: 12` | `radius.md` |
| DashboardScreen.tsx | `nutritionSummary` | `gap: 16` | `spacing[4]` |
| LogsScreen.tsx | `entryTimestamp` style | `fontSize: 12` | `typography.size.xs` |
| RestTimer.tsx | `countdown` style | `fontSize: typography.size['3xl'] * 2` | Should be a dedicated token |

---

## 3. Numeric Display Audit — Tabular Nums

### 3.1 Components Checked

| Component | File | Numeric Content | Has `fontVariant: ['tabular-nums']`? | Severity |
|---|---|---|---|---|
| BudgetBar | `components/nutrition/BudgetBar.tsx` | Calorie remaining count (`2xl/bold`), macro values (`sm/semibold`) | **NO** | **High** |
| MacroRingsRow → ProgressRing | `components/common/ProgressRing.tsx` | Center value (`md/bold`), sub-label (`xs`) | **NO** | **High** |
| RestTimer | `components/training/RestTimer.tsx` | Countdown display (`3xl*2/bold` = 64px) | **NO** | **High** |
| StreakIndicator | `components/dashboard/StreakIndicator.tsx` | Streak count (`md/semibold`) | **NO** | **High** |
| TrendLineChart | `components/charts/TrendLineChart.tsx` | Y-axis labels (SVG `fontSize={10}`), tooltip values (`sm/semibold`) | **NO** (SVG text, limited support) | Medium |
| ExpenditureTrendCard | `components/analytics/ExpenditureTrendCard.tsx` | TDEE value (`3xl/bold`), unit label | **NO** | **High** |
| MacroChip (in BudgetBar) | `components/nutrition/BudgetBar.tsx` | Remaining grams per macro | **NO** | **High** |
| MacroPill (in LogsScreen) | `screens/logs/LogsScreen.tsx` | Macro values in entry cards (`base/semibold`) | **NO** | **High** |
| ComparisonItem (in AnalyticsScreen) | `screens/analytics/AnalyticsScreen.tsx` | Actual vs target values (`2xl/bold`) | **NO** | **High** |

### 3.2 Components WITH Tabular Nums (for reference)

Only found in onboarding step components:
- `LifestyleStep.tsx` — session count, activity calories
- `BodyMeasurementsStep.tsx` — height/weight inputs, BMR value
- `BodyCompositionStep.tsx` — body fat percentage, lean mass estimate
- `BodyBasicsStep.tsx` — age/gender selection text

**Finding — TYPO-003 (High):** `fontVariant: ['tabular-nums', 'lining-nums']` is defined as `typography.numeric.fontVariant` but is **not applied to any numeric display in the main app screens**. It is only used in onboarding steps. This causes layout shift when numeric values change (e.g., calorie countdown in BudgetBar, timer in RestTimer, macro values in ProgressRing). This is the single highest-impact typography fix — tabular nums prevent the "jittery numbers" effect that makes apps feel cheap.

**Affected components (9 total):**
1. `BudgetBar.tsx` — `calorieNumber` and `macroValue` styles
2. `ProgressRing.tsx` — `centerText` style
3. `RestTimer.tsx` — `countdown` style
4. `StreakIndicator.tsx` — `count` style
5. `ExpenditureTrendCard.tsx` — `tdeeValue` style
6. `MacroPill` in `LogsScreen.tsx` — `value` style
7. `ComparisonItem` in `AnalyticsScreen.tsx` — `actual` style
8. `TrendLineChart.tsx` — tooltip `tooltipValue` style (SVG axis labels have limited fontVariant support)
9. `MacroChip` in `BudgetBar.tsx` — `macroValue` style

---

## 4. Text Truncation Audit

### 4.1 Components with Proper Truncation

| Component | File | Element | `numberOfLines` | `ellipsizeMode` | Flex Handling |
|---|---|---|---|---|---|
| ExerciseCard | `components/exercise-picker/ExerciseCard.tsx` | Exercise name | `1` | default (tail) | `flex: 1` on info container ✓ |
| ArticleCardCompact | `components/dashboard/ArticleCardCompact.tsx` | Article title | `2` | default (tail) | Fixed width (200px) card ✓ |
| AddNutritionModal | `components/modals/AddNutritionModal.tsx` | Plan card name | `1` | default (tail) | ✓ |
| DashboardScreen | `screens/dashboard/DashboardScreen.tsx` | Milestone text | `1` | default (tail) | `flex: 1` ✓ |

### 4.2 Components MISSING Truncation

| Component | File | Element | Risk | Severity |
|---|---|---|---|---|
| ActiveWorkoutScreen | `screens/training/ActiveWorkoutScreen.tsx` | Exercise names in set rows | Long exercise names (e.g., "Dumbbell Romanian Deadlift") could overflow | **Medium** |
| LogsScreen | `screens/logs/LogsScreen.tsx` | `entryName` in nutrition cards | No `numberOfLines` — long food names could overflow | **Medium** |
| LogsScreen | `screens/logs/LogsScreen.tsx` | `exerciseText` in training cards | No `numberOfLines` — long exercise descriptions could wrap excessively | **Medium** |
| StreakIndicator | `components/dashboard/StreakIndicator.tsx` | Streak count | Numeric, unlikely to overflow, but no protection | Low |

**Finding — TYPO-004 (Medium):** Several components displaying user-generated text (exercise names, food names) lack `numberOfLines` truncation. While the current data may not trigger overflow, edge cases with long names will break layout.

### 4.3 Text Case Convention Audit

| Pattern | Convention | Consistent? |
|---|---|---|
| Screen titles | Title Case ("Logs", "Analytics") | ✓ Yes (where present) |
| Section headers | Title Case ("Quick Log", "Featured", "Features") | ✓ Yes |
| Tab labels | Title Case ("Nutrition", "Training") | ✓ Yes |
| Button labels | Title Case ("Log Food", "Training") | ✓ Yes |
| Empty state titles | Sentence case ("No training sessions yet") | ✓ Yes |
| Metric labels | Title Case ("Protein", "Carbs", "Fat") | ✓ Yes |

**Finding:** Text case conventions are consistent across the app. No violations found.

---

## 5. Benchmark Comparison

### 5.1 Apple Fitness+ Typography

**Qualities to adopt:**
- **Bold condensed headings with tight letter spacing:** Fitness+ uses SF Pro Display Bold with -0.5 to -1.0 letter spacing on ring labels and section headers. HOS has the `letterSpacing.tight` (-0.25) and `letterSpacing.tighter` (-0.5) tokens but doesn't apply them. **Recommendation:** Apply `letterSpacing.tight` to all screen titles and section headers, `letterSpacing.tighter` to hero numbers (RestTimer countdown, TDEE value).
- **Clear size hierarchy with larger jumps:** Fitness+ uses ~14/17/22/28/34px — larger jumps between levels. HOS's xs(12)→sm(13) is only 1px. **Recommendation:** Consider merging xs and sm into a single 12px caption size, or widening the gap.
- **Ring label typography:** Fitness+ centers bold numeric values inside activity rings with a subtle unit label below. HOS's ProgressRing does this but without tabular-nums or letter spacing.

### 5.2 Linear Typography

**Qualities to adopt:**
- **Clean Inter usage with generous whitespace:** Linear uses Inter with ample line-height (1.5–1.6) and generous padding around text blocks. HOS defines `lineHeight.normal` (1.5) and `lineHeight.relaxed` (1.625) but never applies them explicitly.
- **Monospace for data values:** Linear uses monospace for IDs and timestamps. HOS has `JetBrains Mono` defined but it's unclear if it's used anywhere for data display. **Recommendation:** Apply mono font to timer displays and numeric data where alignment matters.
- **Subtle weight differentiation:** Linear relies heavily on color + size for hierarchy rather than weight. HOS uses 4 weights which is fine, but the semibold/bold distinction (600 vs 700) is subtle in Inter.

### 5.3 WHOOP Typography

**Qualities to adopt:**
- **Data-dense numeric displays with monospace alignment:** WHOOP uses tabular figures extensively for strain scores, HRV values, and recovery percentages. Numbers never shift when values change. **Recommendation:** This is exactly what `typography.numeric.fontVariant` provides — apply it everywhere.
- **Large hero numbers with tight tracking:** WHOOP's strain score uses ~48-64px bold with very tight letter spacing (-1.0 to -1.5). HOS's RestTimer countdown (64px) should adopt `letterSpacing.tighter` (-0.5) at minimum.
- **Consistent metric card typography:** Every WHOOP metric card uses the same size/weight/color pattern. HOS's ExpenditureTrendCard, WeeklySummaryCard, and StrengthStandardsCard each use slightly different patterns.

---

## 6. Issue Summary

| ID | Severity | Title | File(s) | Current | Target | Effort |
|---|---|---|---|---|---|---|
| TYPO-001 | Medium | Screen title inconsistency — Dashboard and Profile have no title | `DashboardScreen.tsx`, `ProfileScreen.tsx` | No screen title text | Add `xl/semibold` title matching Logs/Analytics pattern | 1h |
| TYPO-002 | Medium | No letterSpacing on headings | All screen/section headers | `letterSpacing: undefined` | Apply `letterSpacing.tight` (-0.25) to titles, `letterSpacing.tighter` (-0.5) to hero numbers | 2h |
| TYPO-003 | High | Missing tabular-nums on all numeric displays | BudgetBar, ProgressRing, RestTimer, StreakIndicator, ExpenditureTrendCard, LogsScreen MacroPill, AnalyticsScreen ComparisonItem | No `fontVariant` set | Add `fontVariant: typography.numeric.fontVariant` to all numeric text styles | 3h |
| TYPO-004 | Medium | Missing text truncation on user-generated text | ActiveWorkoutScreen, LogsScreen (entryName, exerciseText) | No `numberOfLines` | Add `numberOfLines={1}` with `flex: 1` or `flexShrink: 1` | 1h |
| TYPO-005 | Low | Hardcoded font sizes in DashboardScreen | `DashboardScreen.tsx` | `fontSize: 13`, `fontSize: 14` | `typography.size.sm`, `typography.size.base` | 0.5h |
| TYPO-006 | Medium | RestTimer uses computed font size (`3xl * 2`) | `RestTimer.tsx` | `fontSize: typography.size['3xl'] * 2` (64px) | Add `typography.size['5xl'] = 64` token or similar | 0.5h |
| TYPO-007 | Low | Line height tokens defined but never used | All screens/components | No explicit `lineHeight` in styles | Apply `lineHeight.tight` to headings, `lineHeight.normal` to body | 2h |
| TYPO-008 | Low | Letter spacing tokens defined but never used | All screens/components | No explicit `letterSpacing` in styles | Apply per benchmark recommendations | 2h |
