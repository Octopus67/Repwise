# Implementation Plan: Muscle Heat Map Redesign

## Overview

Replace the blocky stick-figure `BodyHeatMap` with anatomical SVG silhouettes. Four files change: new `anatomicalPaths.ts`, updated `getHeatMapColor` in `muscleVolumeLogic.ts`, redesigned `BodyHeatMap.tsx`, and token extensions in `tokens.ts`. The `HeatMapCard`, `DrillDownModal`, and `WeekNavigator` remain untouched.

## Pre-Flight

- [x] 0. Baseline verification and environment readiness
  - [x] 0.1 Record current test counts — run `npx jest --passWithNoTests 2>&1 | tail -5` in `app/` and capture pass/fail/skip counts. Save output to a scratch note for comparison at final checkpoint.
    - _Risk:_ Tests may already be failing. _Mitigation:_ Note pre-existing failures so they are not attributed to this work.
    - _Rollback:_ N/A — read-only step.

  - [x] 0.2 Verify `react-native-svg` is installed — confirm `react-native-svg` appears in `app/package.json` dependencies (currently `^15.15.3`). Run `npx react-native-svg --version` or check `node_modules/react-native-svg/package.json` exists.
    - _Risk:_ Missing or outdated version. _Mitigation:_ `npm install react-native-svg@^15` if missing.
    - _Rollback:_ N/A — read-only step.

  - [x] 0.3 Verify `fast-check` is installed — confirm `fast-check` appears in `app/package.json` devDependencies (currently `^4.5.3`). Run a trivial `fc.assert(fc.property(fc.nat(), () => true))` in a scratch test to confirm it loads.
    - _Risk:_ Missing or incompatible version. _Mitigation:_ `npm install --save-dev fast-check@^4` if missing.
    - _Rollback:_ N/A — read-only step.

  - [x] 0.4 Create a git checkpoint — `git add -A && git commit -m "chore: baseline before muscle-heatmap-redesign"`.
    - _Risk:_ Uncommitted work from other features. _Mitigation:_ Stash or commit unrelated changes first.
    - _Rollback:_ N/A — this IS the rollback anchor.

## Tasks

- [x] 1. Extend design tokens and add color mapping function
  - [x] 1.1 Add `heatmap` color tokens to `app/theme/tokens.ts`
    - Inside the `colors` object (after the `macro` block, before the closing `} as const`), add:
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
    - Do NOT modify any existing token — append only.
    - _Requirements: 3.7, 6.2_
    - _Risk:_ TypeScript `as const` assertion may need the new block to also be `as const`-compatible (no mutable types). _Mitigation:_ All values are literals — no issue.
    - _Rollback:_ `git checkout -- app/theme/tokens.ts`

  - [x] 1.2 Add `getHeatMapColor(effectiveSets: number, mev: number, mrv: number): string` to `app/utils/muscleVolumeLogic.ts`
    - Import `colors` from `../../theme/tokens` (relative path: `../theme/tokens` from utils).
    - Pure function implementing the 5-tier decision table:
      1. If `mev <= 0 || mrv <= 0 || mev > mrv` → return `colors.heatmap.untrained`
      2. Clamp `effectiveSets` to `Math.max(0, effectiveSets)`
      3. If `effectiveSets === 0` → `colors.heatmap.untrained`
      4. If `effectiveSets > 0 && effectiveSets < mev` → `colors.heatmap.belowMev`
      5. If `effectiveSets >= mev && effectiveSets <= mrv * 0.8` → `colors.heatmap.optimal`
      6. If `effectiveSets > mrv * 0.8 && effectiveSets <= mrv` → `colors.heatmap.nearMrv`
      7. If `effectiveSets > mrv` → `colors.heatmap.aboveMrv`
    - Keep existing `getStatusColor`, `getStatusLabel`, and all other functions untouched — `DrillDownModal` still uses them.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
    - _Risk:_ Import path for tokens from utils folder. _Mitigation:_ Existing file already has no token import — verify relative path `../theme/tokens` resolves. Check with `getDiagnostics`.
    - _Rollback:_ `git checkout -- app/utils/muscleVolumeLogic.ts`

  - [x] 1.3 Write property tests for `getHeatMapColor` in `app/__tests__/utils/muscleHeatmapColor.test.ts`
    - Import `{ getHeatMapColor }` from `../../utils/muscleVolumeLogic`
    - Import `fc` from `fast-check`
    - Import `{ colors }` from `../../theme/tokens`
    - **Property 1: Color mapping returns correct tier for all valid inputs**
      - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 5.6**
      - Generator: `fc.record({ sets: fc.integer({ min: 0, max: 100 }), mev: fc.integer({ min: 1, max: 30 }), mrv: fc.integer({ min: 1, max: 50 }) })` filtered by `mrv >= mev`
      - Assert output matches expected tier per decision table for each generated triple
      - Config: `{ numRuns: 100 }`
    - **Property 2: Invalid landmarks always produce untrained color**
      - **Validates: Requirements 5.7**
      - Generator: `fc.record({ sets: fc.integer({ min: -10, max: 100 }), mev: fc.integer({ min: -10, max: 0 }), mrv: fc.integer({ min: -10, max: 50 }) })` UNION `fc.record({ sets: fc.integer(), mev: fc.integer({ min: 1, max: 30 }), mrv: fc.integer({ min: -10, max: 0 }) })`
      - Assert output is always `colors.heatmap.untrained`
      - Config: `{ numRuns: 100 }`
    - **Unit tests (boundary values):**
      - `getHeatMapColor(0, 10, 20)` → untrained
      - `getHeatMapColor(1, 10, 20)` → belowMev
      - `getHeatMapColor(10, 10, 20)` → optimal (sets === mev)
      - `getHeatMapColor(16, 10, 20)` → optimal (sets === mrv * 0.8)
      - `getHeatMapColor(17, 10, 20)` → nearMrv (sets > mrv * 0.8)
      - `getHeatMapColor(20, 10, 20)` → nearMrv (sets === mrv)
      - `getHeatMapColor(21, 10, 20)` → aboveMrv
      - `getHeatMapColor(-5, 10, 20)` → untrained (negative clamp)
      - `getHeatMapColor(10, 20, 10)` → untrained (mev > mrv)
    - _Risk:_ `fast-check` import resolution. _Mitigation:_ Already confirmed in `devDependencies`.
    - _Rollback:_ Delete `app/__tests__/utils/muscleHeatmapColor.test.ts`

  - [x] 1.4 Write property test for `mev > mrv` edge case
    - **Property 3: mev > mrv always produces untrained color**
    - **Validates: Requirements 5.7 (extended)**
    - Generator: `fc.record({ sets: fc.integer({ min: 0, max: 100 }), mev: fc.integer({ min: 2, max: 50 }), mrv: fc.integer({ min: 1, max: 49 }) })` filtered by `mev > mrv`
    - Assert output is always `colors.heatmap.untrained`
    - Add to the same test file `app/__tests__/utils/muscleHeatmapColor.test.ts`
    - _Risk:_ None — additive test. _Rollback:_ Remove the test block.

- [x] 2. Create anatomical SVG path data module
  - [x] 2.1 Create `app/components/analytics/anatomicalPaths.ts`
    - Export `AnatomicalRegion` interface: `{ id: string; view: 'front' | 'back'; path: string; labelPosition: { x: number; y: number } }`
    - Export `BodyOutline` interface: `{ view: 'front' | 'back'; path: string }`
    - Export `const VIEWBOX = '0 0 200 440'`
    - Export `const BODY_OUTLINES: BodyOutline[]` — 2 entries (front silhouette, back silhouette) with smooth anatomical curve paths
    - Export `const MUSCLE_REGIONS: AnatomicalRegion[]` — 12 entries:
      - Front (6): `chest`, `shoulders` (view: 'front'), `biceps`, `forearms`, `abs`, `quads`
      - Back (6): `back`, `shoulders` (view: 'back'), `triceps`, `glutes`, `hamstrings`, `calves`
    - Each `id` must match the API `muscle_group` field exactly (lowercase, e.g., `'chest'`, `'shoulders'`)
    - Note: `shoulders` appears twice (once per view). The `view` field disambiguates.
    - Note: The old file has `traps` as a separate back region. The new design merges traps into `back`. If the API returns a `traps` muscle group, it will be silently ignored (no SVG region for it). This is acceptable per the design doc.
    - _Requirements: 2.1, 2.2, 2.3_
    - _Risk:_ SVG path authoring is the most labor-intensive step. Paths must look anatomically correct. _Mitigation:_ Use reference SVG body outlines (e.g., from open-source fitness apps or SVG editors). Test visually in the simulator before proceeding.
    - _Rollback:_ Delete `app/components/analytics/anatomicalPaths.ts`

  - [x] 2.2 Write unit tests for anatomical path data in `app/__tests__/components/anatomicalPaths.test.ts`
    - Import `{ MUSCLE_REGIONS, BODY_OUTLINES, VIEWBOX }` from `../../components/analytics/anatomicalPaths`
    - Test: `MUSCLE_REGIONS` has exactly 12 entries
    - Test: Exactly 6 regions have `view === 'front'`
    - Test: Exactly 6 regions have `view === 'back'`
    - Test: All expected IDs present: `['chest', 'shoulders', 'biceps', 'forearms', 'abs', 'quads', 'back', 'triceps', 'glutes', 'hamstrings', 'calves']` (shoulders counted once since it appears in both views)
    - Test: `shoulders` appears exactly twice (once front, once back)
    - Test: Every region has a non-empty `path` string (length > 10)
    - Test: Every region has `labelPosition` with numeric `x` and `y`
    - Test: `BODY_OUTLINES` has exactly 2 entries (front, back)
    - Test: `VIEWBOX` equals `'0 0 200 440'`
    - _Requirements: 2.1, 2.2_
    - _Risk:_ None — pure data validation. _Rollback:_ Delete test file.

- [x] 3. CHECKPOINT A — Tokens, color logic, and path data verified
  - Run: `npx jest muscleHeatmapColor anatomicalPaths --passWithNoTests` from `app/`
  - Run: `npx tsc --noEmit` to verify no type errors in new/modified files
  - Gate: All property tests pass (100+ iterations each). All unit tests pass. Zero TypeScript errors.
  - If failing: Fix before proceeding. Do not start Phase 4 with broken foundations.
  - _Risk:_ Type errors from token additions. _Mitigation:_ `getDiagnostics` on `tokens.ts` and `muscleVolumeLogic.ts`.

- [x] 4. Redesign BodyHeatMap component
  - [x] 4.1 Create `app/components/analytics/HeatMapLegend.tsx`
    - Import `{ View, Text, StyleSheet }` from `react-native`
    - Import `{ colors, spacing, typography }` from `../../theme/tokens`
    - Define `LEGEND_ITEMS` array:
      ```typescript
      const LEGEND_ITEMS = [
        { color: colors.heatmap.untrained, label: 'Untrained' },
        { color: colors.heatmap.belowMev, label: 'Below MEV' },
        { color: colors.heatmap.optimal, label: 'Optimal' },
        { color: colors.heatmap.nearMrv, label: 'Near MRV' },
        { color: colors.heatmap.aboveMrv, label: 'Above MRV' },
      ];
      ```
    - Export `function HeatMapLegend()` — renders horizontal `flexWrap` row of 5 color-dot + label pairs
    - Dot: 10×10, `borderRadius: 5`, `backgroundColor: item.color`
    - Label: `colors.text.secondary`, `typography.size.xs`
    - _Requirements: 3.6, 6.2_
    - _Risk:_ None — new file, no dependencies beyond tokens. _Rollback:_ Delete file.

  - [x] 4.2 Create `app/components/analytics/BodySilhouette.tsx`
    - Import `{ Animated }` from `react-native`
    - Import `Svg, { Path, G }` from `react-native-svg`
    - Import `{ AnatomicalRegion, BodyOutline, VIEWBOX }` from `./anatomicalPaths`
    - Import `{ getHeatMapColor }` from `../../utils/muscleVolumeLogic`
    - Import `{ colors }` from `../../theme/tokens`
    - Import `MuscleGroupVolume` type (define locally or import from shared types)
    - Props interface:
      ```typescript
      interface BodySilhouetteProps {
        view: 'front' | 'back';
        regions: AnatomicalRegion[];
        outline: BodyOutline;
        volumeMap: Map<string, MuscleGroupVolume>;
        onRegionPress: (muscleGroup: string) => void;
      }
      ```
    - Render 4 SVG layers inside `<Svg viewBox={VIEWBOX}>`:
      1. Base outline: `<Path d={outline.path} fill="none" stroke={colors.heatmap.silhouetteStroke} strokeWidth={1} />`
      2. Muscle fills: For each region, lookup `volumeMap.get(region.id)`, call `getHeatMapColor(vol?.effective_sets ?? 0, vol?.mev ?? 0, vol?.mrv ?? 0)`, render `<Path d={region.path} fill={color} opacity={colors.heatmap.regionOpacity} />`
      3. Region borders: `<Path d={region.path} fill="none" stroke={colors.heatmap.regionBorder} strokeWidth={0.8} />`
      4. Touch targets: `<Path d={region.path} fill="transparent" onPress={() => onRegionPress(region.id)} />`
    - Tap feedback: `Animated.Value` opacity pulse (0.85 → 0.5 → 0.85, 150ms) on the fill layer when pressed
    - _Requirements: 1.1, 1.3, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.2, 4.3_
    - _Risk:_ `onPress` on SVG `<Path>` requires `react-native-svg` ≥ 13. _Mitigation:_ Already on v15.15.3.
    - _Risk:_ Animated opacity on individual paths may cause re-renders. _Mitigation:_ Use `useRef` for `Animated.Value` per region, not state. Keep it lightweight.
    - _Rollback:_ Delete file.

  - [x] 4.3 Rewrite `app/components/analytics/BodyHeatMap.tsx`
    - Keep the same exported interface: `BodyHeatMapProps { muscleVolumes: MuscleGroupVolume[]; onMusclePress: (muscleGroup: string) => void; isLoading?: boolean; error?: string | null; }`
    - Remove imports from `./bodySvgPaths` and `getStatusColor`
    - Add imports:
      ```typescript
      import { MUSCLE_REGIONS, BODY_OUTLINES } from './anatomicalPaths';
      import { BodySilhouette } from './BodySilhouette';
      import { HeatMapLegend } from './HeatMapLegend';
      ```
    - Build `volumeMap: Map<string, MuscleGroupVolume>` from `muscleVolumes` with `Array.isArray()` guard
    - Handle `shoulders` mapping: The API returns one `shoulders` entry. `volumeMap.get('shoulders')` will match both front and back shoulder regions since both have `id: 'shoulders'`. No special mapping code needed — the `Map` lookup handles it.
    - Filter regions: `const frontRegions = MUSCLE_REGIONS.filter(r => r.view === 'front')`, same for back
    - Get outlines: `const frontOutline = BODY_OUTLINES.find(o => o.view === 'front')!`, same for back
    - Render: loading skeleton → error state → content:
      - "Front" label + `<BodySilhouette view="front" regions={frontRegions} outline={frontOutline} volumeMap={volumeMap} onRegionPress={onMusclePress} />`
      - "Back" label + `<BodySilhouette view="back" regions={backRegions} outline={backOutline} volumeMap={volumeMap} onRegionPress={onMusclePress} />`
      - `<HeatMapLegend />`
    - Show "No training data for this week" when `safeVolumes.every(v => v.effective_sets === 0)` or `safeVolumes.length === 0`
    - _Requirements: 1.1, 1.2, 1.4, 4.1, 6.1, 6.3_
    - _Risk:_ Breaking the `HeatMapCard` → `BodyHeatMap` interface contract. _Mitigation:_ Props interface is identical. `HeatMapCard` passes `muscleVolumes`, `onMusclePress`, `isLoading` — all unchanged.
    - _Risk:_ Old `bodySvgPaths.ts` import removed but file still exists. _Mitigation:_ Cleanup in step 5.
    - _Rollback:_ `git checkout -- app/components/analytics/BodyHeatMap.tsx`

  - [x] 4.4 Write unit tests for HeatMapLegend in `app/__tests__/components/HeatMapLegend.test.tsx`
    - Import `{ render }` from `@testing-library/react-native`
    - Test: renders 5 legend items with labels "Untrained", "Below MEV", "Optimal", "Near MRV", "Above MRV"
    - _Requirements: 3.6_
    - _Risk:_ None. _Rollback:_ Delete test file.

  - [x] 4.5 Write unit tests for BodyHeatMap in `app/__tests__/components/BodyHeatMap.test.tsx`
    - Import `{ render, fireEvent }` from `@testing-library/react-native`
    - Test: renders "Front" and "Back" labels
    - Test: empty `muscleVolumes=[]` shows "No training data" text
    - Test: tapping a region calls `onMusclePress` with correct muscle group string
    - Test: single `shoulders` API entry maps to both front and back shoulder regions (verify `getHeatMapColor` is called for both)
    - Test: `isLoading=true` renders skeleton
    - Test: `error="fail"` renders error text
    - **Property 4: Tap callback receives correct muscle group identifier**
      - **Validates: Requirements 4.1**
      - For each region in `MUSCLE_REGIONS`, simulate press and assert `onMusclePress` was called with `region.id`
    - _Requirements: 1.4, 4.1_
    - _Risk:_ Mocking `react-native-svg` in Jest. _Mitigation:_ Use `jest.mock('react-native-svg', ...)` with simple View/Text stubs. This is a common pattern in RN testing.
    - _Rollback:_ Delete test file.

- [x] 5. CHECKPOINT B — Full component integration verified
  - Run: `npx jest muscleHeatmap anatomicalPaths HeatMapLegend BodyHeatMap --passWithNoTests` from `app/`
  - Run: `npx tsc --noEmit` — zero type errors
  - Visual check: Run the app in simulator, navigate to Analytics → Training tab → Muscle Volume Heat Map. Verify:
    - Front and back silhouettes render with anatomical shapes
    - Regions are colored based on volume data (or all gray if no data)
    - Tapping a region opens the DrillDownModal
    - Legend shows 5 tiers
  - Gate: All tests pass. Visual rendering is acceptable. DrillDownModal still works.
  - If failing: Fix before proceeding to cleanup.

- [x] 6. Clean up old path data
  - [x] 6.1 Remove `app/components/analytics/bodySvgPaths.ts`
    - Confirmed: Only `BodyHeatMap.tsx` imported from `bodySvgPaths.ts` (verified via grep). `BodyHeatMap.tsx` was rewritten in step 4.3 to import from `anatomicalPaths.ts` instead.
    - Delete the file.
    - _Requirements: 1.2_
    - _Risk:_ Another file may have been added that imports `bodySvgPaths` between when we checked and now. _Mitigation:_ Run `grep -r "bodySvgPaths" app/` one more time before deleting.
    - _Rollback:_ `git checkout -- app/components/analytics/bodySvgPaths.ts`

- [x] 7. CHECKPOINT C — Final verification
  - Run full test suite: `npx jest --passWithNoTests` from `app/`
  - Compare pass/fail counts against baseline from step 0.1. No new failures allowed.
  - Run: `npx tsc --noEmit` — zero type errors
  - Gate: All tests pass. No regressions. No type errors.
  - Final git commit: `git add -A && git commit -m "feat: muscle heatmap redesign — anatomical SVG silhouettes with 5-tier color gradient"`

## Post-Launch Monitoring

After merging to main:

1. **Crash monitoring** — Watch for `react-native-svg` rendering crashes on low-end Android devices (SVG path parsing failures). Check Sentry/Crashlytics for errors in `BodySilhouette` or `BodyHeatMap` within 48 hours.
2. **Tap accuracy** — Monitor if users are successfully opening DrillDownModal from the heat map. If tap-through rate drops significantly vs. the old implementation, the touch targets may be too small. Metric: `drill_down_modal_opened` events from analytics.
3. **Render performance** — If users report jank on the Training tab, profile SVG render time. 98 SVG paths should be fine, but monitor for frame drops on devices with < 3GB RAM.
4. **Visual QA** — Collect screenshots from 3 device classes (small phone 320px, standard 375px, tablet 768px) to verify proportional scaling.

## Notes

- Tasks marked with `*` are property/unit test tasks — strongly recommended but can be deferred for faster MVP
- `HeatMapCard.tsx`, `DrillDownModal.tsx`, and `WeekNavigator.tsx` require zero changes — the interface contract is preserved
- The SVG path data in task 2.1 is the most labor-intensive part — anatomical paths need to look good visually
- Property tests use `fast-check` library (already in devDependencies at `^4.5.3`)
- Each property test runs minimum 100 iterations
- The old `getStatusColor()` function is NOT removed — `DrillDownModal` still uses it for the status badge color
- The old `bodySvgPaths.ts` had a `traps` region that the new design merges into `back`. If the API returns `traps`, it will be silently ignored (untrained gray for that region). This is acceptable — the API's primary muscle groups don't include standalone `traps`.
