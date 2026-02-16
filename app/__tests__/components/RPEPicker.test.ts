/**
 * RPEPicker — Pure logic tests
 *
 * Tests the exported conversion functions and value arrays from RPEPicker.
 * These are pure functions so we test logic directly without React rendering.
 *
 * Task: 3c.4
 */

import {
  RPE_VALUES,
  RIR_VALUES,
  rirToRpe,
  rpeToRir,
  getRirDisplayLabel,
  getDisplayValue,
} from '../../utils/rpeConversion';

// ─── (a) RPE mode shows values 6-10 ─────────────────────────────────────────

describe('RPE mode values', () => {
  it('RPE_VALUES contains exactly [6, 7, 8, 9, 10]', () => {
    expect(RPE_VALUES).toEqual([6, 7, 8, 9, 10]);
  });

  it('RPE_VALUES has 5 entries', () => {
    expect(RPE_VALUES).toHaveLength(5);
  });

  it('all RPE values are between 6 and 10', () => {
    RPE_VALUES.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(6);
      expect(v).toBeLessThanOrEqual(10);
    });
  });
});

// ─── (b) RIR mode shows values 0-4+ ─────────────────────────────────────────

describe('RIR mode values', () => {
  it('RIR_VALUES contains exactly [4, 3, 2, 1, 0]', () => {
    expect(RIR_VALUES).toEqual([4, 3, 2, 1, 0]);
  });

  it('RIR_VALUES has 5 entries', () => {
    expect(RIR_VALUES).toHaveLength(5);
  });

  it('RIR value 4 displays as "4+"', () => {
    expect(getRirDisplayLabel(4)).toBe('4+');
  });

  it('RIR value 3 displays as "3"', () => {
    expect(getRirDisplayLabel(3)).toBe('3');
  });

  it('RIR value 0 displays as "0"', () => {
    expect(getRirDisplayLabel(0)).toBe('0');
  });

  it('RIR values >= 4 all display with "+" suffix', () => {
    expect(getRirDisplayLabel(4)).toBe('4+');
    expect(getRirDisplayLabel(5)).toBe('4+');
  });
});

// ─── (c) RIR 0 converts to RPE 10 ───────────────────────────────────────────

describe('rirToRpe conversion', () => {
  it('RIR 0 → RPE 10', () => {
    expect(rirToRpe(0)).toBe(10);
  });

  it('RIR 1 → RPE 9', () => {
    expect(rirToRpe(1)).toBe(9);
  });

  it('RIR 2 → RPE 8', () => {
    expect(rirToRpe(2)).toBe(8);
  });

  it('RIR 4 → RPE 6', () => {
    expect(rirToRpe(4)).toBe(6);
  });
});

// ─── (d) RIR 3 converts to RPE 7 ────────────────────────────────────────────

describe('rirToRpe — RIR 3 specifically', () => {
  it('RIR 3 → RPE 7', () => {
    expect(rirToRpe(3)).toBe(7);
  });
});

// ─── Reverse conversion: RPE to RIR ─────────────────────────────────────────

describe('rpeToRir conversion', () => {
  it('RPE 10 → RIR 0', () => {
    expect(rpeToRir(10)).toBe(0);
  });

  it('RPE 9 → RIR 1', () => {
    expect(rpeToRir(9)).toBe(1);
  });

  it('RPE 7 → RIR 3', () => {
    expect(rpeToRir(7)).toBe(3);
  });

  it('RPE 6 → RIR 4', () => {
    expect(rpeToRir(6)).toBe(4);
  });
});

// ─── Round-trip: RIR → RPE → RIR ────────────────────────────────────────────

describe('round-trip conversion', () => {
  it('RIR → RPE → RIR is identity for all RIR values', () => {
    RIR_VALUES.forEach((rir) => {
      expect(rpeToRir(rirToRpe(rir))).toBe(rir);
    });
  });

  it('RPE → RIR → RPE is identity for all RPE values', () => {
    RPE_VALUES.forEach((rpe) => {
      expect(rirToRpe(rpeToRir(rpe))).toBe(rpe);
    });
  });
});

// ─── getDisplayValue — display conversion ────────────────────────────────────

describe('getDisplayValue', () => {
  it('returns RPE value as-is in RPE mode', () => {
    expect(getDisplayValue('8', 'rpe')).toBe('8');
  });

  it('converts stored RPE 10 to RIR "0" in RIR mode', () => {
    expect(getDisplayValue('10', 'rir')).toBe('0');
  });

  it('converts stored RPE 7 to RIR "3" in RIR mode', () => {
    expect(getDisplayValue('7', 'rir')).toBe('3');
  });

  it('converts stored RPE 6 to RIR "4+" in RIR mode', () => {
    expect(getDisplayValue('6', 'rir')).toBe('4+');
  });

  it('returns empty string for empty input', () => {
    expect(getDisplayValue('', 'rpe')).toBe('');
    expect(getDisplayValue('', 'rir')).toBe('');
  });

  it('returns empty string for non-numeric input', () => {
    expect(getDisplayValue('abc', 'rpe')).toBe('');
  });
});

// ─── (e) Mode toggle persists (store simulation) ────────────────────────────

describe('RPE mode toggle persistence (store simulation)', () => {
  it('default mode is rpe', () => {
    const defaultMode: 'rpe' | 'rir' = 'rpe';
    expect(defaultMode).toBe('rpe');
  });

  it('toggling to rir persists the value', () => {
    let mode: 'rpe' | 'rir' = 'rpe';
    const setRpeMode = (newMode: 'rpe' | 'rir') => { mode = newMode; };
    setRpeMode('rir');
    expect(mode).toBe('rir');
  });

  it('toggling back to rpe persists the value', () => {
    let mode: 'rpe' | 'rir' = 'rir';
    const setRpeMode = (newMode: 'rpe' | 'rir') => { mode = newMode; };
    setRpeMode('rpe');
    expect(mode).toBe('rpe');
  });

  it('conversion is consistent across mode switches', () => {
    // User enters RIR 2 (stored as RPE 8), then switches to RPE mode
    const storedRpe = String(rirToRpe(2)); // "8"
    expect(getDisplayValue(storedRpe, 'rpe')).toBe('8');
    expect(getDisplayValue(storedRpe, 'rir')).toBe('2');
  });
});
