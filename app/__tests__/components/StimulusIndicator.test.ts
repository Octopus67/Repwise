/**
 * StimulusIndicator traffic light logic tests.
 * Tests the getLevel algorithm and VOLUME_DEFAULTS data integrity.
 * Cannot import component directly (react-native), so we test the pure logic.
 */

// Mirror of getLevel from StimulusIndicator.tsx (not exported)
function getLevel(hu: number, mev: number, mav: number, mrv: number) {
  if (hu >= mrv) return 'red';
  if (hu >= mav) return 'green';
  if (hu >= mev) return 'yellow';
  return 'gray';
}

// Mirror of VOLUME_DEFAULTS for data integrity validation
const VOLUME_DEFAULTS: Record<string, { mev: number; mav: number; mrv: number }> = {
  chest: { mev: 8, mav: 14, mrv: 20 },
  back: { mev: 8, mav: 14, mrv: 22 },
  quads: { mev: 6, mav: 12, mrv: 18 },
  hamstrings: { mev: 4, mav: 10, mrv: 16 },
  shoulders: { mev: 6, mav: 14, mrv: 22 },
  biceps: { mev: 4, mav: 12, mrv: 20 },
  triceps: { mev: 4, mav: 10, mrv: 16 },
  glutes: { mev: 4, mav: 12, mrv: 16 },
  calves: { mev: 6, mav: 10, mrv: 16 },
  abs: { mev: 4, mav: 10, mrv: 16 },
};

describe('StimulusIndicator — VOLUME_DEFAULTS', () => {
  it('contains all 10 muscle groups', () => {
    const expected = ['chest','back','quads','hamstrings','shoulders','biceps','triceps','glutes','calves','abs'];
    expect(Object.keys(VOLUME_DEFAULTS)).toHaveLength(10);
    for (const g of expected) expect(VOLUME_DEFAULTS[g]).toBeDefined();
  });

  it('every group has mev < mav < mrv', () => {
    for (const [, v] of Object.entries(VOLUME_DEFAULTS)) {
      expect(v.mev).toBeLessThan(v.mav);
      expect(v.mav).toBeLessThan(v.mrv);
    }
  });
});

describe('StimulusIndicator — traffic light logic', () => {
  it('HU >= MRV → red', () => {
    expect(getLevel(20, 8, 14, 20)).toBe('red');
    expect(getLevel(25, 8, 14, 20)).toBe('red');
  });

  it('HU >= MAV and < MRV → green', () => {
    expect(getLevel(14, 8, 14, 20)).toBe('green');
    expect(getLevel(19, 8, 14, 20)).toBe('green');
  });

  it('HU >= MEV and < MAV → yellow', () => {
    expect(getLevel(8, 8, 14, 20)).toBe('yellow');
    expect(getLevel(13, 8, 14, 20)).toBe('yellow');
  });

  it('HU < MEV → gray', () => {
    expect(getLevel(7, 8, 14, 20)).toBe('gray');
    expect(getLevel(0, 8, 14, 20)).toBe('gray');
  });

  it('edge: HU = 0', () => expect(getLevel(0, 8, 14, 20)).toBe('gray'));

  it('edge: HU exactly at each boundary', () => {
    expect(getLevel(8, 8, 14, 20)).toBe('yellow');
    expect(getLevel(14, 8, 14, 20)).toBe('green');
    expect(getLevel(20, 8, 14, 20)).toBe('red');
  });

  it('works with custom landmarks', () => {
    expect(getLevel(4, 5, 10, 15)).toBe('gray');
    expect(getLevel(5, 5, 10, 15)).toBe('yellow');
    expect(getLevel(10, 5, 10, 15)).toBe('green');
    expect(getLevel(15, 5, 10, 15)).toBe('red');
  });
});
