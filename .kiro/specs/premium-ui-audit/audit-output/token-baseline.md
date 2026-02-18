# Token Baseline — Hypertrophy OS Design System

> Source: `app/theme/tokens.ts`
> Generated from static analysis of the token file. This document is the single reference for all subsequent audit phases.

---

## 1. Colors (`colors`)

10 top-level groups, 48 total values.

### 1.1 Backgrounds (`colors.bg`) — 4 values

| Token Path | Value | Description |
|---|---|---|
| `colors.bg.base` | `#0A0E13` | App base background — dark charcoal |
| `colors.bg.surface` | `#12171F` | Card/surface background — slightly lighter |
| `colors.bg.surfaceRaised` | `#1A2029` | Raised surface (elevated cards, popovers) |
| `colors.bg.overlay` | `rgba(0,0,0,0.6)` | Modal/sheet backdrop overlay |

### 1.2 Borders (`colors.border`) — 4 values

| Token Path | Value | Description |
|---|---|---|
| `colors.border.subtle` | `rgba(255,255,255,0.06)` | Lightest border — flat card dividers |
| `colors.border.default` | `rgba(255,255,255,0.08)` | Default border — raised cards, inputs |
| `colors.border.hover` | `rgba(255,255,255,0.12)` | Hover/active border state |
| `colors.border.focus` | `#06B6D4` | Focus ring — accent cyan |

### 1.3 Text (`colors.text`) — 4 values

| Token Path | Value | Description |
|---|---|---|
| `colors.text.primary` | `#F1F5F9` | Primary text — headings, data values |
| `colors.text.secondary` | `#94A3B8` | Secondary text — labels, descriptions |
| `colors.text.muted` | `#64748B` | Muted text — captions, timestamps |
| `colors.text.inverse` | `#0B0F14` | Inverse text — on light/accent backgrounds |

### 1.4 Accent (`colors.accent`) — 3 values

| Token Path | Value | Description |
|---|---|---|
| `colors.accent.primary` | `#06B6D4` | Primary accent — cyan, CTAs, links |
| `colors.accent.primaryHover` | `#0891B2` | Accent hover state — slightly darker cyan |
| `colors.accent.primaryMuted` | `rgba(6,182,212,0.12)` | Accent muted — subtle backgrounds, badges |

### 1.5 Semantic (`colors.semantic`) — 8 values

| Token Path | Value | Description |
|---|---|---|
| `colors.semantic.positive` | `#22C55E` | Success/positive — green |
| `colors.semantic.positiveSubtle` | `rgba(34,197,94,0.12)` | Positive subtle background |
| `colors.semantic.negative` | `#EF4444` | Error/negative — red |
| `colors.semantic.negativeSubtle` | `rgba(239,68,68,0.12)` | Negative subtle background |
| `colors.semantic.warning` | `#F59E0B` | Warning — amber |
| `colors.semantic.warningSubtle` | `rgba(245,158,11,0.12)` | Warning subtle background |
| `colors.semantic.overTarget` | `#6B8FBF` | Over-target indicator — muted blue |
| `colors.semantic.overTargetSubtle` | `rgba(107,143,191,0.15)` | Over-target subtle background |

### 1.6 Premium (`colors.premium`) — 2 values

| Token Path | Value | Description |
|---|---|---|
| `colors.premium.gold` | `#D4AF37` | Premium gold accent |
| `colors.premium.goldSubtle` | `rgba(212,175,55,0.12)` | Premium gold subtle background |

### 1.7 Gradient (`colors.gradient`) — 3 values

| Token Path | Value | Description |
|---|---|---|
| `colors.gradient.premiumCta` | `['#06B6D4', '#0E7490']` | Premium CTA gradient (tuple, `as const`) |
| `colors.gradient.start` | `#06B6D4` | Gradient start — cyan |
| `colors.gradient.end` | `#0E7490` | Gradient end — darker cyan |

### 1.8 Chart (`colors.chart`) — 5 values

| Token Path | Value | Description |
|---|---|---|
| `colors.chart.calories` | `#06B6D4` | Chart calories line — cyan |
| `colors.chart.positiveTrend` | `#22C55E` | Positive trend line — green |
| `colors.chart.negativeDev` | `#EF4444` | Negative deviation — red |
| `colors.chart.warningThreshold` | `#F59E0B` | Warning threshold line — amber |
| `colors.chart.neutral` | `#6B7280` | Neutral/baseline — gray |

### 1.9 Macro (`colors.macro`) — 8 values

| Token Path | Value | Description |
|---|---|---|
| `colors.macro.calories` | `#06B6D4` | Calories ring/bar — cyan |
| `colors.macro.caloriesSubtle` | `rgba(6,182,212,0.10)` | Calories subtle background |
| `colors.macro.protein` | `#22C55E` | Protein ring/bar — green |
| `colors.macro.proteinSubtle` | `rgba(34,197,94,0.10)` | Protein subtle background |
| `colors.macro.carbs` | `#F59E0B` | Carbs ring/bar — amber |
| `colors.macro.carbsSubtle` | `rgba(245,158,11,0.10)` | Carbs subtle background |
| `colors.macro.fat` | `#F472B6` | Fat ring/bar — pink |
| `colors.macro.fatSubtle` | `rgba(244,114,182,0.10)` | Fat subtle background |

### 1.10 Heatmap (`colors.heatmap`) — 8 values

| Token Path | Value | Type | Description |
|---|---|---|---|
| `colors.heatmap.untrained` | `#1E293B` | hex | Untrained muscle group |
| `colors.heatmap.belowMev` | `#22C55E` | hex | Below MEV — green |
| `colors.heatmap.optimal` | `#06B6D4` | hex | Optimal volume — cyan |
| `colors.heatmap.nearMrv` | `#F59E0B` | hex | Near MRV — amber |
| `colors.heatmap.aboveMrv` | `#EF4444` | hex | Above MRV — red |
| `colors.heatmap.silhouetteStroke` | `rgba(255,255,255,0.08)` | rgba | Body silhouette outline |
| `colors.heatmap.regionBorder` | `rgba(255,255,255,0.12)` | rgba | Muscle region border |
| `colors.heatmap.regionOpacity` | `0.85` | number | Region fill opacity |

---

## 2. Elevation (`elevation`)

CSS box-shadow strings for web. 5 levels.

| Token Path | Value |
|---|---|
| `elevation.none` | `none` |
| `elevation.sm` | `0 1px 2px rgba(0,0,0,0.3)` |
| `elevation.md` | `0 4px 12px rgba(0,0,0,0.4)` |
| `elevation.lg` | `0 8px 24px rgba(0,0,0,0.5)` |
| `elevation.button` | `0 2px 12px rgba(0,0,0,0.4)` |

---

## 3. Typography (`typography`)

### 3.1 Font Family (`typography.fontFamily`) — 3 families

| Token Path | Value | Platform |
|---|---|---|
| `typography.fontFamily.sans` | `Inter` | Cross-platform primary |
| `typography.fontFamily.sansIOS` | `SF Pro Display` | iOS system font |
| `typography.fontFamily.mono` | `JetBrains Mono` | Monospace for code/data |

### 3.2 Font Weight (`typography.weight`) — 4 values

| Token Path | Value | Usage |
|---|---|---|
| `typography.weight.regular` | `'400'` | Body text, descriptions |
| `typography.weight.medium` | `'500'` | Secondary labels |
| `typography.weight.semibold` | `'600'` | Section headers, card titles |
| `typography.weight.bold` | `'700'` | Screen titles, primary data values |

### 3.3 Font Size (`typography.size`) — 8 values

| Token Path | Value (px) | Role |
|---|---|---|
| `typography.size.xs` | `12` | Captions, badges |
| `typography.size.sm` | `13` | Small labels |
| `typography.size.base` | `14` | Body text default |
| `typography.size.md` | `16` | Card titles, form labels |
| `typography.size.lg` | `18` | Section headers |
| `typography.size.xl` | `20` | Screen subtitles |
| `typography.size['2xl']` | `24` | Screen titles |
| `typography.size['3xl']` | `32` | Hero numbers, large displays |

### 3.4 Line Height (`typography.lineHeight`) — 3 values

| Token Path | Value (multiplier) |
|---|---|
| `typography.lineHeight.tight` | `1.2` |
| `typography.lineHeight.normal` | `1.5` |
| `typography.lineHeight.relaxed` | `1.625` |

### 3.5 Numeric (`typography.numeric`)

| Token Path | Value |
|---|---|
| `typography.numeric.fontVariant` | `['tabular-nums', 'lining-nums']` |

---

## 4. Spacing (`spacing`)

8px grid system. 11 steps (keys 0–16, non-contiguous).

| Key | Value (px) | Common Usage |
|---|---|---|
| `spacing[0]` | `0` | Reset |
| `spacing[1]` | `4` | Tight internal gaps |
| `spacing[2]` | `8` | Component internal padding |
| `spacing[3]` | `12` | Item gaps within sections |
| `spacing[4]` | `16` | Card padding, standard gap |
| `spacing[5]` | `20` | Medium section gap |
| `spacing[6]` | `24` | Section dividers |
| `spacing[8]` | `32` | Major section gaps |
| `spacing[10]` | `40` | Large spacing |
| `spacing[12]` | `48` | Extra large spacing |
| `spacing[16]` | `64` | Maximum spacing |

> Note: Keys 7, 9, 11, 13, 14, 15 are not defined. The scale jumps from 6→8→10→12→16.

---

## 5. Border Radius (`radius`)

| Token Path | Value (px) | Usage |
|---|---|---|
| `radius.sm` | `8` | Small elements, badges, chips |
| `radius.md` | `12` | Cards, inputs, buttons |
| `radius.lg` | `16` | Large cards, modals |
| `radius.full` | `9999` | Circles, pills |

---

## 6. Motion (`motion`)

### 6.1 Duration (`motion.duration`) — 3 values

| Token Path | Value (ms) | Usage |
|---|---|---|
| `motion.duration.fast` | `100` | Micro-interactions, hover |
| `motion.duration.default` | `200` | Standard transitions |
| `motion.duration.slow` | `300` | Entrance animations, modals |

### 6.2 Easing (`motion.easing`) — 3 curves

| Token Path | Value | Usage |
|---|---|---|
| `motion.easing.default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard ease-in-out |
| `motion.easing.in` | `cubic-bezier(0.4, 0, 1, 1)` | Accelerate (exit) |
| `motion.easing.out` | `cubic-bezier(0, 0, 0.2, 1)` | Decelerate (entrance) |

---

## 7. Letter Spacing (`letterSpacing`)

| Token Path | Value (px) | Usage |
|---|---|---|
| `letterSpacing.tighter` | `-0.5` | Large display numbers |
| `letterSpacing.tight` | `-0.25` | Headings |
| `letterSpacing.normal` | `0` | Body text |
| `letterSpacing.wide` | `0.5` | Uppercase labels, badges |

---

## 8. Shadows (`shadows`)

React Native shadow format. 3 levels.

### `shadows.sm`

| Property | Value |
|---|---|
| `shadowColor` | `#000` |
| `shadowOffset` | `{ width: 0, height: 1 }` |
| `shadowOpacity` | `0.2` |
| `shadowRadius` | `3` |
| `elevation` | `2` |

### `shadows.md`

| Property | Value |
|---|---|
| `shadowColor` | `#000` |
| `shadowOffset` | `{ width: 0, height: 4 }` |
| `shadowOpacity` | `0.3` |
| `shadowRadius` | `8` |
| `elevation` | `4` |

### `shadows.lg`

| Property | Value |
|---|---|
| `shadowColor` | `#000` |
| `shadowOffset` | `{ width: 0, height: 8 }` |
| `shadowOpacity` | `0.4` |
| `shadowRadius` | `16` |
| `elevation` | `8` |

---

## 9. Springs (`springs`)

Reanimated spring animation configs. 3 presets.

| Token Path | Damping | Stiffness | Mass | Usage |
|---|---|---|---|---|
| `springs.gentle` | `20` | `200` | `0.5` | Progress fills, value animations |
| `springs.snappy` | `15` | `400` | `0.3` | Press feedback, interaction response |
| `springs.bouncy` | `10` | `300` | `0.5` | Celebrations, attention-grabbing |

---

## 10. Opacity Scale (`opacityScale`)

| Token Path | Value | Usage |
|---|---|---|
| `opacityScale.disabled` | `0.4` | Disabled state opacity |
| `opacityScale.muted` | `0.6` | Muted/inactive elements |
| `opacityScale.subtle` | `0.08` | Subtle backgrounds, overlays |
| `opacityScale.hover` | `0.12` | Hover state backgrounds |

---

## 11. `glowShadow` Function

```typescript
export function glowShadow(color: string, glowRadius = 12, glowOpacity = 0.3) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity,
    shadowRadius: glowRadius,
    elevation: 0,
  };
}
```

**Parameters:**
- `color: string` — The glow color (hex or rgba)
- `glowRadius: number` (default: `12`) — Shadow blur radius
- `glowOpacity: number` (default: `0.3`) — Shadow opacity

**Returns:** React Native shadow style object with centered (0,0) offset for omnidirectional glow effect.

---

## 12. Theme Re-export (`theme`)

Convenience object bundling all tokens:

```typescript
export const theme = {
  colors,
  elevation,
  typography,
  spacing,
  radius,
  motion,
  letterSpacing,
  shadows,
  springs,
  opacityScale,
} as const;

export type Theme = typeof theme;
```

---

## Summary Statistics

| Category | Count |
|---|---|
| Color groups | 10 |
| Total color values | 48 |
| Spacing steps | 11 (keys 0,1,2,3,4,5,6,8,10,12,16) |
| Typography sizes | 8 |
| Typography weights | 4 |
| Font families | 3 |
| Line heights | 3 |
| Letter spacing values | 4 |
| Radius values | 4 |
| Shadow levels | 3 |
| Elevation levels | 5 |
| Spring presets | 3 |
| Opacity scale values | 4 |
| Motion durations | 3 |
| Motion easings | 3 |
| Utility functions | 1 (`glowShadow`) |
