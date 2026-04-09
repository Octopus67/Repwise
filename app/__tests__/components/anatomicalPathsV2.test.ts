import {
  MUSCLE_REGIONS,
  BODY_OUTLINES,
  VIEWBOX_FRONT,
  VIEWBOX_BACK,
  COMPOSITE_MUSCLE_MAP,
} from '../../components/analytics/anatomicalPathsV2';

/** Backend VALID_MUSCLE_GROUPS (minus full_body which has no region). */
const API_MUSCLE_GROUPS = [
  'chest', 'lats', 'erectors', 'adductors',
  'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
  'traps', 'forearms',
];

describe('anatomicalPathsV2', () => {
  test('has correct viewbox dimensions', () => {
    expect(VIEWBOX_FRONT).toBe('30 140 660 1240');
    expect(VIEWBOX_BACK).toBe('754 140 660 1240');
  });

  test('has front and back body outlines', () => {
    expect(BODY_OUTLINES).toHaveLength(2);
    expect(BODY_OUTLINES[0].view).toBe('front');
    expect(BODY_OUTLINES[1].view).toBe('back');
    expect(BODY_OUTLINES[0].path.length).toBeGreaterThan(1000);
    expect(BODY_OUTLINES[1].path.length).toBeGreaterThan(1000);
  });

  test('has 20 muscle regions (10 front + 10 back)', () => {
    expect(MUSCLE_REGIONS).toHaveLength(20);
    const front = MUSCLE_REGIONS.filter(r => r.view === 'front');
    const back = MUSCLE_REGIONS.filter(r => r.view === 'back');
    expect(front).toHaveLength(10);
    expect(back).toHaveLength(10);
  });

  test('every region has non-empty path data', () => {
    MUSCLE_REGIONS.forEach(r => {
      expect(r.path.length).toBeGreaterThan(10);
      expect(r.id).toBeTruthy();
      expect(r.labelPosition).toBeDefined();
    });
  });

  test('every bilateral region has pathLeft and pathRight', () => {
    MUSCLE_REGIONS.forEach(r => {
      expect(r.pathLeft).toBeTruthy();
      expect(r.pathRight).toBeTruthy();
    });
  });

  test('every API muscle group is covered by regions or composite map', () => {
    const regionIds = new Set(MUSCLE_REGIONS.map(r => r.id));
    const compositeIds = new Set(Object.keys(COMPOSITE_MUSCLE_MAP));

    API_MUSCLE_GROUPS.forEach(group => {
      const covered = regionIds.has(group) || compositeIds.has(group);
      expect(covered).toBe(true);
    });
  });

  test('composite map targets exist as regions', () => {
    const regionIds = new Set(MUSCLE_REGIONS.map(r => r.id));
    Object.values(COMPOSITE_MUSCLE_MAP).flat().forEach(target => {
      expect(regionIds.has(target)).toBe(true);
    });
  });

  test('front paths contain valid SVG path data', () => {
    const front = MUSCLE_REGIONS.filter(r => r.view === 'front');
    front.forEach(r => {
      // Should contain SVG path commands (M, C, Q, L, Z, etc.)
      expect(r.path).toMatch(/[MCQLZmcqlz]/);
    });
  });
});
