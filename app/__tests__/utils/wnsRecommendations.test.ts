/**
 * Unit tests for wnsRecommendations.ts
 */

import {
  getVolumeStatus,
  generateRecommendations,
  type VolumeLandmarks,
} from '../../utils/wnsRecommendations';

const LANDMARKS: VolumeLandmarks = { mev: 4, mavLow: 8, mavHigh: 14, mrv: 18 };

describe('getVolumeStatus', () => {
  test('below MEV', () => {
    expect(getVolumeStatus(2, LANDMARKS)).toBe('below_mev');
  });

  test('at MEV = optimal', () => {
    expect(getVolumeStatus(4, LANDMARKS)).toBe('optimal');
  });

  test('in optimal range', () => {
    expect(getVolumeStatus(10, LANDMARKS)).toBe('optimal');
  });

  test('near MRV (≥90% of mavHigh)', () => {
    expect(getVolumeStatus(13, LANDMARKS)).toBe('near_mrv');
  });

  test('above MRV', () => {
    expect(getVolumeStatus(18, LANDMARKS)).toBe('above_mrv');
  });

  test('well above MRV', () => {
    expect(getVolumeStatus(25, LANDMARKS)).toBe('above_mrv');
  });
});

describe('generateRecommendations', () => {
  test('empty input returns empty array', () => {
    expect(generateRecommendations({}, {})).toEqual([]);
  });

  test('generates recommendation for below MEV', () => {
    const recs = generateRecommendations({ chest: 2 }, { chest: LANDMARKS });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toContain('Chest');
    expect(recs[0]).toContain('adding volume');
  });

  test('generates recommendation for optimal', () => {
    const recs = generateRecommendations({ chest: 10 }, { chest: LANDMARKS });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toContain('Great work');
  });

  test('generates recommendation for near MRV', () => {
    const recs = generateRecommendations({ chest: 13 }, { chest: LANDMARKS });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toContain('near your recovery limit');
  });

  test('generates recommendation for above MRV', () => {
    const recs = generateRecommendations({ chest: 20 }, { chest: LANDMARKS });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toContain('deloading');
  });

  test('skips muscles without landmarks', () => {
    const recs = generateRecommendations({ chest: 10 }, {});
    expect(recs).toHaveLength(0);
  });

  test('multiple muscles generate multiple recommendations', () => {
    const recs = generateRecommendations(
      { chest: 10, back: 2 },
      { chest: LANDMARKS, back: LANDMARKS },
    );
    expect(recs).toHaveLength(2);
  });

  test('formats multi-word muscle names', () => {
    const recs = generateRecommendations(
      { front_delts: 10 },
      { front_delts: LANDMARKS },
    );
    expect(recs[0]).toContain('Front Delts');
  });
});
