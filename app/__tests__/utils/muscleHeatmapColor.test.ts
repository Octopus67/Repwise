import fc from 'fast-check';
import { getHeatMapColor } from '../../utils/muscleVolumeLogic';
import { colors } from '../../theme/tokens';

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('getHeatMapColor — property-based tests', () => {
  /**
   * Property 1: Color mapping returns correct tier for all valid inputs
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 5.6**
   */
  test('returns correct tier for all valid (sets, mev, mrv) triples', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            sets: fc.integer({ min: 0, max: 100 }),
            mev: fc.integer({ min: 1, max: 30 }),
            mrv: fc.integer({ min: 1, max: 50 }),
          })
          .filter(({ mev, mrv }) => mrv >= mev),
        ({ sets, mev, mrv }) => {
          const result = getHeatMapColor(sets, mev, mrv);

          if (sets === 0) {
            expect(result).toBe(colors.heatmap.untrained);
          } else if (sets > 0 && sets < mev) {
            expect(result).toBe(colors.heatmap.belowMev);
          } else if (sets >= mev && sets <= mrv * 0.8) {
            expect(result).toBe(colors.heatmap.optimal);
          } else if (sets > mrv * 0.8 && sets <= mrv) {
            expect(result).toBe(colors.heatmap.nearMrv);
          } else if (sets > mrv) {
            expect(result).toBe(colors.heatmap.aboveMrv);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Invalid landmarks always produce untrained color
   * **Validates: Requirements 5.7**
   */
  test('invalid landmarks (mev <= 0 or mrv <= 0) always return untrained', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            sets: fc.integer({ min: -10, max: 100 }),
            mev: fc.integer({ min: -10, max: 0 }),
            mrv: fc.integer({ min: -10, max: 50 }),
          }),
          fc.record({
            sets: fc.integer({ min: -10, max: 100 }),
            mev: fc.integer({ min: 1, max: 30 }),
            mrv: fc.integer({ min: -10, max: 0 }),
          }),
        ),
        ({ sets, mev, mrv }) => {
          expect(getHeatMapColor(sets, mev, mrv)).toBe(colors.heatmap.untrained);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: mev > mrv always produces untrained color
   * **Validates: Requirements 5.7 (extended)**
   */
  test('mev > mrv always returns untrained', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            sets: fc.integer({ min: 0, max: 100 }),
            mev: fc.integer({ min: 2, max: 50 }),
            mrv: fc.integer({ min: 1, max: 49 }),
          })
          .filter(({ mev, mrv }) => mev > mrv),
        ({ sets, mev, mrv }) => {
          expect(getHeatMapColor(sets, mev, mrv)).toBe(colors.heatmap.untrained);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Unit Tests (Boundary Values) ───────────────────────────────────────────

describe('getHeatMapColor — boundary values', () => {
  test('sets=0 → untrained', () => {
    expect(getHeatMapColor(0, 10, 20)).toBe(colors.heatmap.untrained);
  });

  test('sets=1 (below mev) → belowMev', () => {
    expect(getHeatMapColor(1, 10, 20)).toBe(colors.heatmap.belowMev);
  });

  test('sets=mev (10) → optimal', () => {
    expect(getHeatMapColor(10, 10, 20)).toBe(colors.heatmap.optimal);
  });

  test('sets=mrv*0.8 (16) → optimal', () => {
    expect(getHeatMapColor(16, 10, 20)).toBe(colors.heatmap.optimal);
  });

  test('sets=17 (above mrv*0.8) → nearMrv', () => {
    expect(getHeatMapColor(17, 10, 20)).toBe(colors.heatmap.nearMrv);
  });

  test('sets=mrv (20) → nearMrv', () => {
    expect(getHeatMapColor(20, 10, 20)).toBe(colors.heatmap.nearMrv);
  });

  test('sets=21 (above mrv) → aboveMrv', () => {
    expect(getHeatMapColor(21, 10, 20)).toBe(colors.heatmap.aboveMrv);
  });

  test('negative sets (-5) → untrained (clamped to 0)', () => {
    expect(getHeatMapColor(-5, 10, 20)).toBe(colors.heatmap.untrained);
  });

  test('mev > mrv (20, 10) → untrained', () => {
    expect(getHeatMapColor(10, 20, 10)).toBe(colors.heatmap.untrained);
  });
});
