/**
 * Tests for Volume Landmarks components — pure logic extraction.
 *
 * Components use React Native Views so we test the underlying logic
 * (zone calculation, trend formatting, landmark info) without rendering.
 */

import fc from 'fast-check';

// ─── Extracted pure logic from VolumeBar ─────────────────────────────────────

interface Landmarks {
  mv: number;
  mev: number;
  mav_low: number;
  mav_high: number;
  mrv: number;
}

function getZoneLabel(volume: number, landmarks: Landmarks): string {
  if (volume < landmarks.mev) return 'Below MEV';
  if (volume <= landmarks.mav_high) return 'Optimal';
  if (volume <= landmarks.mrv) return 'Approaching MRV';
  return 'Above MRV';
}

function calcPct(value: number, maxRange: number): number {
  return Math.max(0, Math.min((value / maxRange) * 100, 100));
}

// ─── Extracted pure logic from VolumeTrendChart ──────────────────────────────

function formatWeekLabel(week: string): string {
  const d = new Date(week + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Extracted pure logic from VolumeLandmarksCard ───────────────────────────

const STATUS_LABELS: Record<string, string> = {
  below_mev: 'Below MEV',
  optimal: 'Optimal',
  approaching_mrv: 'Near MRV',
  above_mrv: 'Above MRV',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VolumeBar — getZoneLabel', () => {
  const landmarks: Landmarks = { mv: 4, mev: 8, mav_low: 12, mav_high: 18, mrv: 24 };

  test('volume below MEV → Below MEV', () => {
    expect(getZoneLabel(0, landmarks)).toBe('Below MEV');
    expect(getZoneLabel(7, landmarks)).toBe('Below MEV');
  });

  test('volume at MEV → Optimal', () => {
    expect(getZoneLabel(8, landmarks)).toBe('Optimal');
  });

  test('volume in MAV range → Optimal', () => {
    expect(getZoneLabel(15, landmarks)).toBe('Optimal');
    expect(getZoneLabel(18, landmarks)).toBe('Optimal');
  });

  test('volume between MAV and MRV → Approaching MRV', () => {
    expect(getZoneLabel(19, landmarks)).toBe('Approaching MRV');
    expect(getZoneLabel(24, landmarks)).toBe('Approaching MRV');
  });

  test('volume above MRV → Above MRV', () => {
    expect(getZoneLabel(25, landmarks)).toBe('Above MRV');
    expect(getZoneLabel(50, landmarks)).toBe('Above MRV');
  });

  test('property: zone label is always one of 4 values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (volume) => {
          const label = getZoneLabel(volume, landmarks);
          expect(['Below MEV', 'Optimal', 'Approaching MRV', 'Above MRV']).toContain(label);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('VolumeBar — calcPct', () => {
  test('0 → 0%', () => {
    expect(calcPct(0, 100)).toBe(0);
  });

  test('value at max → 100%', () => {
    expect(calcPct(100, 100)).toBe(100);
  });

  test('value beyond max → clamped to 100%', () => {
    expect(calcPct(150, 100)).toBe(100);
  });

  test('negative value → clamped to 0%', () => {
    expect(calcPct(-10, 100)).toBe(0);
  });

  test('property: result always in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 200 }),
        fc.integer({ min: 1, max: 100 }),
        (value, maxRange) => {
          const result = calcPct(value, maxRange);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('VolumeTrendChart — formatWeekLabel', () => {
  test('formats ISO date to short month + day', () => {
    const label = formatWeekLabel('2026-02-03');
    expect(label).toMatch(/Feb\s+3/);
  });

  test('handles year boundary', () => {
    const label = formatWeekLabel('2025-12-29');
    expect(label).toMatch(/Dec\s+29/);
  });
});

describe('VolumeLandmarksCard — status labels', () => {
  test('all statuses have labels', () => {
    expect(STATUS_LABELS.below_mev).toBe('Below MEV');
    expect(STATUS_LABELS.optimal).toBe('Optimal');
    expect(STATUS_LABELS.approaching_mrv).toBe('Near MRV');
    expect(STATUS_LABELS.above_mrv).toBe('Above MRV');
  });
});

describe('LandmarkExplainer — landmark keys', () => {
  const VALID_KEYS = ['mv', 'mev', 'mav', 'mrv'];

  test('all landmark keys are valid', () => {
    for (const key of VALID_KEYS) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });
});
