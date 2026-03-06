/**
 * Unit tests for wnsCalculator.ts
 *
 * Test cases mirror tests/test_wns_engine_unit.py exactly
 * to ensure Python ↔ TypeScript parity.
 */

import {
  rirFromRpe,
  stimulatingRepsPerSet,
  diminishingReturns,
  estimateSessionHU,
  DEFAULT_RIR,
} from '../../utils/wnsCalculator';

// ─── rirFromRpe ──────────────────────────────────────────────────────────────

describe('rirFromRpe', () => {
  test('RPE 10 returns 0', () => {
    expect(rirFromRpe(10.0)).toBe(0.0);
  });

  test('RPE 8 returns 2', () => {
    expect(rirFromRpe(8.0)).toBe(2.0);
  });

  test('RPE 6 returns 4', () => {
    expect(rirFromRpe(6.0)).toBe(4.0);
  });

  test('null returns DEFAULT_RIR', () => {
    expect(rirFromRpe(null)).toBe(DEFAULT_RIR);
  });

  test('RPE clamped above 10', () => {
    expect(rirFromRpe(12.0)).toBe(0.0);
  });

  test('RPE clamped below 1', () => {
    expect(rirFromRpe(-5.0)).toBe(9.0);
  });
});

// ─── stimulatingRepsPerSet ───────────────────────────────────────────────────

describe('stimulatingRepsPerSet', () => {
  test('at failure returns max stim reps', () => {
    expect(stimulatingRepsPerSet(10, 0.0, 0.75)).toBe(5.0);
  });

  test('RIR 1 returns 4', () => {
    expect(stimulatingRepsPerSet(10, 1.0, 0.75)).toBe(4.0);
  });

  test('RIR 2 returns 3', () => {
    expect(stimulatingRepsPerSet(10, 2.0, 0.75)).toBe(3.0);
  });

  test('RIR 3 returns 2', () => {
    expect(stimulatingRepsPerSet(10, 3.0, 0.75)).toBe(2.0);
  });

  test('RIR 4 returns zero (junk volume)', () => {
    expect(stimulatingRepsPerSet(10, 4.0, 0.75)).toBe(0.0);
  });

  test('RIR 5 returns zero', () => {
    expect(stimulatingRepsPerSet(10, 5.0, 0.75)).toBe(0.0);
  });

  test('heavy load all reps stimulating', () => {
    expect(stimulatingRepsPerSet(3, 2.0, 0.90)).toBe(3.0);
  });

  test('heavy load capped at max', () => {
    expect(stimulatingRepsPerSet(8, 0.0, 0.90)).toBe(5.0);
  });

  test('low reps capped by actual reps', () => {
    expect(stimulatingRepsPerSet(2, 0.0, 0.75)).toBe(2.0);
  });

  test('zero reps returns zero', () => {
    expect(stimulatingRepsPerSet(0, 0.0, 0.75)).toBe(0.0);
  });

  test('null RIR uses default', () => {
    // DEFAULT_RIR = 2.0 (RPE 8) → min(3.0, 10) = 3.0
    expect(stimulatingRepsPerSet(10, null, 0.75)).toBe(2.0);
  });

  test('null intensity uses default', () => {
    // default intensity 0.75 < 0.85, RIR 0 → min(5.0, 10) = 5.0
    expect(stimulatingRepsPerSet(10, 0.0, null)).toBe(5.0);
  });
});

// ─── diminishingReturns ──────────────────────────────────────────────────────

describe('diminishingReturns', () => {
  test('empty list returns zero', () => {
    expect(diminishingReturns([])).toBe(0.0);
  });

  test('single set returns full value', () => {
    expect(diminishingReturns([5.0])).toBe(5.0);
  });

  test('two sets less than double', () => {
    const result = diminishingReturns([5.0, 5.0]);
    expect(result).toBeLessThan(10.0);
    expect(result).toBeGreaterThan(5.0);
  });

  test('six sets produce ~2x stimulus of one set (Schoenfeld)', () => {
    const oneSet = diminishingReturns([5.0]);
    const sixSets = diminishingReturns([5.0, 5.0, 5.0, 5.0, 5.0, 5.0]);
    const ratio = sixSets / oneSet;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  test('order matters', () => {
    const a = diminishingReturns([5.0, 1.0]);
    const b = diminishingReturns([1.0, 5.0]);
    expect(a).not.toBe(b);
  });
});

// ─── estimateSessionHU ───────────────────────────────────────────────────────

describe('estimateSessionHU', () => {
  test('empty sets returns zero', () => {
    expect(estimateSessionHU([])).toBe(0.0);
  });

  test('single direct set', () => {
    const result = estimateSessionHU([{ stimReps: 5.0, coefficient: 1.0 }]);
    expect(result).toBe(5.0);
  });

  test('fractional coefficient reduces contribution', () => {
    const direct = estimateSessionHU([{ stimReps: 5.0, coefficient: 1.0 }]);
    const fractional = estimateSessionHU([{ stimReps: 5.0, coefficient: 0.5 }]);
    expect(fractional).toBe(direct * 0.5);
  });
});
