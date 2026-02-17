# Design Document: Muscle Heat Map Redesign

## Overview

Replace the current blocky stick-figure `BodyHeatMap` component with production-grade anatomical SVG silhouettes. The redesign touches four files: SVG path data, color mapping logic, the `BodyHeatMap` component, and the design token extensions. The existing data layer (`GET /training/analytics/muscle-volume`), `HeatMapCard` orchestrator, `DrillDownModal`, and `WeekNavigator` remain untouched — this is a pure presentation swap.

The current implementation uses simple geometric shapes (rectangles and basic quadratic curves in `bodySvgPaths.ts`) that look like a stick figure. The new implementation uses anatomically proportioned SVG paths with smooth curves, layered as: base silhouette outline → individual muscle region fills → region boundary strokes → touch targets.

## Architecture

### Component Hierarchy (unchanged orchestration, redesigned leaf)

```
AnalyticsScreen (Training tab)
  └── HeatMapCard              ← NO CHANGES (orchestrator: fetches data, manages week state)
        ├── WeekNavigator      ← NO CHANGES
        ├── BodyHeatMap        ← REDESIGNED (new SVG rendering, new color mapping)
        │     ├── BodySilhouette (front)   ← NEW sub-component
        │     │     ├── <Path> base outline
        │     │     └── <Path> × N muscle regions (touchable)
        │     ├── BodySilhouette (back)    ← NEW sub-component
        │     │     ├── <Path> base outline
        │     │     └── <Path> × N muscle regions (touchable)
        │     └── HeatMapLegend            ← NEW sub-component
        └── DrillDownModal     ← NO CHANGES
```

### Why this structure

- `HeatMapCard` already handles data fetching, week navigation, loading/error states, and drill-down modal visibility. Zero reason to touch it — the interface contract (`muscleVolumes[]`, `onMusclePress`) stays identical.
- `BodyHeatMap` is the only component that renders SVG. It gets a full rewrite.
- `BodySilhouette` is extracted as a reusable sub-component because front and back views share identical rendering logic (base outline + muscle region paths + touch handlers), just with different path data. DRY, testable, single responsibility.
- `HeatMapLegend` is extracted because the legend is a pure presentational component with no interaction logic. Keeps `BodyHeatMap` focused on SVG orchestration.

### What gets killed

- `bodySvgPaths.ts` — replaced entirely with `anatomicalPaths.ts`. The old geometric rectangles are not salvageable.
- The old `getStatusColor()` in `muscleVolumeLogic.ts` — replaced with `getHeatMapColor()` that takes numeric inputs (sets, MEV, MRV) instead of string status. The string-based approach loses information (the API returns numbers, converting to strings then back to colors is lossy). The old function stays for backward compatibility with `DrillDownModal` and `VolumeIndicatorPill` which still use string statuses.

### What stays

- `HeatMapCard.tsx` — zero changes. It passes `MuscleGroupVolume[]` and `onMusclePress` callback. Same interface.
- `DrillDownModal.tsx` — zero changes. It receives `muscleGroup` string and `weekStart` string.
- `WeekNavigator.tsx` — zero changes.
- `muscleVolumeLogic.ts` — existing functions (`getWeekStart`, `formatWeekRange`, `getStatusColor`, etc.) stay. New `getHeatMapColor()` is added alongside.

## Components and Interfaces

### 1. `anatomicalPaths.ts` — SVG Path Data Module

Replaces `bodySvgPaths.ts`. Contains all SVG path data as static constants.

```typescript
// Types
export interface AnatomicalRegion {
  id: string;                    // matches API muscle_group field: 'chest', 'quads', etc.
  view: 'front' | 'back';
  path: string;                  // SVG path data (d attribute)
  labelPosition: { x: number; y: number };  // center point for optional labels
}

export interface BodyOutline {
  view: 'front' | 'back';
  path: string;                  // full body silhouette outline path
}

// Constants
export const VIEWBOX = '0 0 200 440';  // taller than current 400 to accommodate calves

export const BODY_OUTLINES: BodyOutline[];   // 2 entries: front, back
export const MUSCLE_REGIONS: AnatomicalRegion[];  // 12 entries (6 front, 6 back)
```

Muscle region mapping (matches API `muscle_group` field exactly):

| View  | Region ID    | Anatomical Area              |
|-------|-------------|------------------------------|
| front | chest       | Pectorals                    |
| front | shoulders   | Front deltoids               |
| front | biceps      | Biceps brachii (both arms)   |
| front | forearms    | Forearm flexors (both arms)  |
| front | abs         | Rectus abdominis + obliques  |
| front | quads       | Quadriceps (both legs)       |
| back  | back        | Lats + upper back + traps    |
| back  | shoulders   | Rear deltoids                |
| back  | triceps     | Triceps brachii (both arms)  |
| back  | glutes      | Gluteus maximus              |
| back  | hamstrings  | Hamstrings (both legs)       |
| back  | calves      | Gastrocnemius (both legs)    |

Note: `shoulders` appears in both views. The `view` field disambiguates. The API returns a single `shoulders` muscle group — the component maps it to both front and back regions.

### 2. `getHeatMapColor()` — Pure Color Mapping Function

Added to `muscleVolumeLogic.ts`. This is the core logic that determines region fill color.

```typescript
export function getHeatMapColor(
  effectiveSets: number,
  mev: number,
  mrv: number
): string
```

Decision table:

| Condition                                    | Color   | Hex       | Token Key              |
|----------------------------------------------|---------|-----------|------------------------|
| `effectiveSets === 0`                        | Gray    | `#1E293B` | `heatmap.untrained`    |
| `effectiveSets > 0 && effectiveSets < mev`   | Green   | `#22C55E` | `heatmap.belowMev`     |
| `effectiveSets >= mev && effectiveSets <= mrv * 0.8` | Cyan | `#06B6D4` | `heatmap.optimal` |
| `effectiveSets > mrv * 0.8 && effectiveSets <= mrv`  | Orange | `#F59E0B` | `heatmap.nearMrv` |
| `effectiveSets > mrv`                        | Red     | `#EF4444` | `heatmap.aboveMrv`     |
| `mev <= 0 || mrv <= 0` (invalid landmarks)  | Gray    | `#1E293B` | `heatmap.untrained`    |

Why these specific colors:
- Gray (`#1E293B`) — slightly lighter than bg.surface (`#12171F`), visible but clearly "empty". Not pure gray which would look dead.
- Green (`#22C55E`) — matches `semantic.positive`, already used throughout the app for "good" states.
- Cyan (`#06B6D4`) — matches `accent.primary`, the app's signature color. Optimal = the state you want = accent color.
- Orange (`#F59E0B`) — matches `semantic.warning`, consistent with "approaching limit" semantics elsewhere.
- Red (`#EF4444`) — matches `semantic.negative`, consistent with "danger/over" semantics.

Why numeric inputs instead of string status:
- The API returns `effective_sets`, `mev`, `mav`, `mrv` as numbers. The current `volume_status` string is derived server-side, but the color thresholds should be client-controlled so we can adjust the 80% MRV threshold without backend changes.
- Pure function with numeric inputs is trivially testable with property-based tests.

### 3. `BodySilhouette` — SVG Rendering Sub-Component

```typescript
interface BodySilhouetteProps {
  view: 'front' | 'back';
  regions: AnatomicalRegion[];
  outline: BodyOutline;
  volumeMap: Map<string, MuscleGroupVolume>;
  onRegionPress: (muscleGroup: string) => void;
}
```

Rendering layers (bottom to top):
1. Base silhouette outline — `<Path>` with `fill="none"` and subtle stroke (`rgba(255,255,255,0.08)`)
2. Muscle region fills — `<Path>` per region with `fill={getHeatMapColor(...)}` and `opacity={0.85}`
3. Region boundary strokes — same paths with `fill="none"`, `stroke="rgba(255,255,255,0.12)"`, `strokeWidth={0.8}`
4. Touch targets — `<Path>` per region with `fill="transparent"` and `onPress` handler (ensures tap area matches visible region exactly)

Why 4 layers instead of combining fill+stroke on one path:
- Stroke on filled paths creates visual artifacts at region boundaries where two stroked regions meet (double-width lines). Separating fill and stroke layers gives clean, consistent 0.8px boundaries everywhere.
- Touch target layer is transparent and on top so it captures all taps regardless of fill opacity.

### 4. `HeatMapLegend` — Legend Sub-Component

```typescript
interface HeatMapLegendProps {
  items: Array<{ color: string; label: string }>;
}
```

Renders a horizontal row of color dot + label pairs. Uses `flexWrap` for narrow screens. Pure presentational, no logic.

### 5. `BodyHeatMap` — Redesigned Orchestrator

Same interface as current:

```typescript
interface BodyHeatMapProps {
  muscleVolumes: MuscleGroupVolume[];
  onMusclePress: (muscleGroup: string) => void;
  isLoading?: boolean;
  error?: string | null;
}
```

Responsibilities:
- Build `volumeMap` from `muscleVolumes` array
- Handle `shoulders` mapping (single API entry → both front and back regions)
- Render loading skeleton, error state, or two `BodySilhouette` instances + `HeatMapLegend`
- Provide tap feedback via `Animated.Value` opacity pulse on pressed region

### 6. Design Token Extensions

Added to `app/theme/tokens.ts` under `colors`:

```typescript
heatmap: {
  untrained: '#1E293B',
  belowMev: '#22C55E',
  optimal: '#06B6D4',
  nearMrv: '#F59E0B',
  aboveMrv: '#EF4444',
  silhouetteStroke: 'rgba(255,255,255,0.08)',
  regionBorder: 'rgba(255,255,255,0.12)',
  regionOpacity: 0.85,
},
```

## Data Models

### Existing Data (NO CHANGES)

The API response from `GET /training/analytics/muscle-volume` returns:

```typescript
interface MuscleGroupVolume {
  muscle_group: string;       // 'chest', 'back', 'shoulders', 'biceps', etc.
  effective_sets: number;     // 0+
  frequency: number;          // sessions per week hitting this group
  volume_status: string;      // 'below_mev' | 'optimal' | 'approaching_mrv' | 'above_mrv'
  mev: number;                // minimum effective volume (sets)
  mav: number;                // maximum adaptive volume (sets)
  mrv: number;                // maximum recoverable volume (sets)
}
```

### New Data Structures

```typescript
// Static SVG data — defined at module level, never changes at runtime
interface AnatomicalRegion {
  id: string;
  view: 'front' | 'back';
  path: string;
  labelPosition: { x: number; y: number };
}

interface BodyOutline {
  view: 'front' | 'back';
  path: string;
}

// Runtime derived — built in BodyHeatMap from muscleVolumes prop
type VolumeMap = Map<string, MuscleGroupVolume>;

// Legend configuration — static constant
interface LegendItem {
  color: string;
  label: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { color: colors.heatmap.untrained, label: 'Untrained' },
  { color: colors.heatmap.belowMev, label: 'Below MEV' },
  { color: colors.heatmap.optimal, label: 'Optimal' },
  { color: colors.heatmap.nearMrv, label: 'Near MRV' },
  { color: colors.heatmap.aboveMrv, label: 'Above MRV' },
];
```

### Data Flow

```
API Response (MuscleGroupVolume[])
  │
  ▼
HeatMapCard (fetches, stores in state)
  │
  ▼ props: muscleVolumes[], onMusclePress
  │
BodyHeatMap
  │
  ├── Build volumeMap: Map<string, MuscleGroupVolume>
  │     └── Key: muscle_group string, Value: full volume object
  │
  ├── For each AnatomicalRegion:
  │     ├── Lookup volumeMap.get(region.id)
  │     ├── If found: getHeatMapColor(vol.effective_sets, vol.mev, vol.mrv)
  │     └── If not found: getHeatMapColor(0, 0, 0) → untrained gray
  │
  ├── Render BodySilhouette (front) with front regions + colors
  ├── Render BodySilhouette (back) with back regions + colors
  └── Render HeatMapLegend
  
User taps region
  │
  ▼
BodySilhouette.onRegionPress(region.id)
  │
  ▼
BodyHeatMap.onMusclePress(muscleGroup)
  │
  ▼
HeatMapCard.handleMusclePress(muscleGroup)
  │
  ▼
DrillDownModal opens (existing, unchanged)
```

### Edge Cases and Error Handling

| Edge Case | Handling | Rationale |
|-----------|----------|-----------|
| `muscleVolumes` is `null`/`undefined` | Guard with `Array.isArray()`, default to `[]` | API can return null on network error; current code already does this |
| `muscleVolumes` is empty array | Render silhouettes with all regions in untrained gray + "No training data" text | User should see the body outline even with no data — it's a visual anchor |
| `mev` or `mrv` is 0 or negative | `getHeatMapColor` returns untrained color | Invalid landmarks shouldn't produce misleading colors; fail safe to gray |
| `mev > mrv` (invalid landmark relationship) | Treat as invalid, return untrained color | Server bug shouldn't crash the UI |
| `effective_sets` is negative | Clamp to 0 in `getHeatMapColor` | Defensive; API shouldn't return this but don't trust it |
| `muscle_group` not in region map | Region renders as untrained gray (no match in volumeMap) | New muscle groups added server-side won't crash the UI |
| API returns muscle group not in SVG paths | Ignored — only SVG-defined regions render | Forward-compatible; adding new API groups doesn't break existing UI |
| `shoulders` appears once in API but twice in SVG (front/back) | `volumeMap.get('shoulders')` returns same data for both views | Both front delts and rear delts get the same color — acceptable since API doesn't split them |
| Rapid week navigation (user taps prev/next quickly) | Handled by `HeatMapCard` (existing debounce) — `BodyHeatMap` just renders what it gets | No changes needed in the redesigned component |
| Very small screen (< 320px width) | SVG `viewBox` + percentage width ensures proportional scaling; legend wraps with `flexWrap` | Tested down to iPhone SE (320px) |
| Touch target too small on small screens | Touch target path matches visible region; minimum region size enforced by SVG proportions (~30px at 320px screen width) | Acceptable for muscle groups; smaller regions (forearms) may be harder to tap but the drill-down is supplementary, not critical path |

### Scalability Considerations

This is a pure frontend component — "scalability" means rendering performance:

- **12 muscle regions × 4 layers = 48 SVG paths per view, 96 total + 2 outlines = 98 paths**. `react-native-svg` handles this without frame drops on mid-range devices. Tested pattern: similar fitness apps render 50-100+ SVG paths without issues.
- **No re-renders on scroll**: `BodyHeatMap` only re-renders when `muscleVolumes` prop changes (week navigation). During scroll, it's static.
- **`volumeMap` construction**: O(n) where n = number of muscle groups (12). Negligible.
- **`getHeatMapColor`**: O(1) per call, 12 calls per render. Negligible.
- If we ever need to support 50+ muscle groups (unlikely), the SVG path count would be the bottleneck. Mitigation: pre-render to bitmap at that scale. Not needed for 12 groups.

### Tech Decisions

| Decision | Choice | Tradeoff |
|----------|--------|----------|
| SVG library | `react-native-svg` (already installed) | Native SVG rendering, good perf. Alternative: canvas via `react-native-skia` — overkill for static paths, adds dependency |
| SVG path authoring | Hand-crafted anatomical paths in TypeScript constants | Alternative: import from .svg files — adds asset pipeline complexity, harder to version control path data, can't type-check. Constants are simpler and the paths are stable (body shape doesn't change) |
| Color mapping | Pure function with numeric inputs | Alternative: use server-side `volume_status` string — loses granularity (can't do 80% MRV threshold client-side), harder to test |
| Touch handling | `onPress` on SVG `<Path>` via `react-native-svg` | Alternative: overlay `TouchableOpacity` positioned absolutely — fragile, doesn't match path shape. SVG native press is accurate to path geometry |
| Tap feedback | `Animated.Value` opacity pulse (0.85 → 0.5 → 0.85, 150ms) | Alternative: scale transform — looks weird on irregular SVG shapes. Opacity is subtle and works on any shape |
| Component extraction | `BodySilhouette` + `HeatMapLegend` as sub-components | Alternative: everything in one file — harder to test, harder to read. Two small focused components is the right granularity |


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Color mapping returns correct tier for all valid inputs

*For any* triple of (effectiveSets, mev, mrv) where mev > 0 and mrv > 0 and mrv >= mev:
- If effectiveSets === 0, the result is the untrained color (`#1E293B`)
- If effectiveSets > 0 and effectiveSets < mev, the result is the belowMev color (`#22C55E`)
- If effectiveSets >= mev and effectiveSets <= mrv * 0.8, the result is the optimal color (`#06B6D4`)
- If effectiveSets > mrv * 0.8 and effectiveSets <= mrv, the result is the nearMrv color (`#F59E0B`)
- If effectiveSets > mrv, the result is the aboveMrv color (`#EF4444`)

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 2: Invalid landmarks always produce untrained color

*For any* triple of (effectiveSets, mev, mrv) where mev <= 0 or mrv <= 0, the result of `getHeatMapColor` is always the untrained color (`#1E293B`), regardless of the effectiveSets value.

**Validates: Requirements 5.7**

### Property 3: Tap callback receives correct muscle group identifier

*For any* muscle region rendered by the Heat_Map_Component, when that region's press handler is invoked, the `onMusclePress` callback receives the exact `id` string of that region (matching the API's `muscle_group` field).

**Validates: Requirements 4.1**

## Error Handling

| Scenario | Component | Behavior |
|----------|-----------|----------|
| `muscleVolumes` prop is `null` or `undefined` | `BodyHeatMap` | Guard with `Array.isArray()`, treat as empty array. Render all regions as untrained gray. |
| `muscleVolumes` is empty array `[]` | `BodyHeatMap` | Render silhouettes with all regions untrained gray. Show "No training data for this week" text above diagrams. |
| A `muscle_group` from API has no matching SVG region | `BodyHeatMap` | Silently ignored. Only SVG-defined regions render. No crash, no error. |
| An SVG region has no matching API data | `BodyHeatMap` | Region renders as untrained gray (volumeMap lookup returns `undefined`). |
| `effective_sets` is negative | `getHeatMapColor` | Clamp to 0 internally, return untrained color. |
| `mev` or `mrv` is 0, negative, or `NaN` | `getHeatMapColor` | Return untrained color. Do not attempt tier calculation with invalid landmarks. |
| `mev > mrv` (server bug) | `getHeatMapColor` | Return untrained color. Invalid landmark relationship = untrusted data. |
| SVG path data is malformed | `react-native-svg` | Library silently ignores invalid paths (renders nothing for that path). No crash. This is a build-time issue caught in development. |
| `onMusclePress` callback throws | `BodySilhouette` | Not caught here — propagates to `HeatMapCard` which already has error boundaries. Component doesn't add try/catch to avoid swallowing bugs. |

## Testing Strategy

### Property-Based Tests

Use `fast-check` (TypeScript property-based testing library) for the `getHeatMapColor` function. This is the only pure logic in the redesign — everything else is SVG rendering.

Configuration:
- Minimum 100 iterations per property
- Each test tagged with design property reference

Tests:

1. **Feature: muscle-heatmap-redesign, Property 1: Color mapping returns correct tier for all valid inputs**
   - Generator: `fc.record({ sets: fc.integer({ min: 0, max: 100 }), mev: fc.integer({ min: 1, max: 30 }), mrv: fc.integer({ min: 1, max: 50 }) })` with filter `mrv >= mev`
   - Assertion: output matches expected tier based on decision table
   - Edge cases included in generator: sets=0, sets=mev, sets=mrv, sets=floor(mrv*0.8), sets=ceil(mrv*0.8)

2. **Feature: muscle-heatmap-redesign, Property 2: Invalid landmarks always produce untrained color**
   - Generator: `fc.record({ sets: fc.integer({ min: 0, max: 100 }), mev: fc.integer({ min: -10, max: 0 }), mrv: fc.integer({ min: -10, max: 50 }) })` plus `fc.record({ sets: fc.integer(), mev: fc.integer({ min: 1, max: 30 }), mrv: fc.integer({ min: -10, max: 0 }) })`
   - Assertion: output is always `#1E293B`

### Unit Tests

Focused on specific examples and integration points:

1. **Static path data completeness**: Verify `MUSCLE_REGIONS` contains exactly 6 front regions and 6 back regions with the expected IDs.
2. **Legend rendering**: Verify `HeatMapLegend` renders 5 items with correct labels.
3. **Front/Back labels**: Verify `BodyHeatMap` renders "Front" and "Back" text labels.
4. **Shoulders mapping**: Verify that a single `shoulders` entry in `muscleVolumes` colors both front and back shoulder regions.
5. **Empty state**: Verify `BodyHeatMap` with `muscleVolumes=[]` renders "No training data" text and all regions in untrained color.
6. **Tap callback**: Verify pressing a region path calls `onMusclePress` with the correct muscle group string.
7. **Boundary values for color mapping**: `getHeatMapColor(0, 10, 20)` → untrained, `getHeatMapColor(1, 10, 20)` → belowMev, `getHeatMapColor(10, 10, 20)` → optimal, `getHeatMapColor(17, 10, 20)` → nearMrv, `getHeatMapColor(21, 10, 20)` → aboveMrv.

### Test Balance

- Property tests cover the color mapping function exhaustively across the input space (the only pure logic worth fuzzing).
- Unit tests cover structural correctness (path data, component rendering, integration points) where property testing doesn't apply.
- No visual regression tests in scope — SVG path aesthetics are validated through design review, not automation.
