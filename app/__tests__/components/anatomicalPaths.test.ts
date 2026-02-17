/**
 * Unit tests for anatomical SVG path data module.
 * Validates structure, completeness, and correctness of muscle region definitions.
 */
import { MUSCLE_REGIONS, BODY_OUTLINES, VIEWBOX } from '../../components/analytics/anatomicalPaths';

describe('Anatomical Path Data', () => {
  describe('VIEWBOX', () => {
    it('equals "0 0 200 440"', () => {
      expect(VIEWBOX).toBe('0 0 200 440');
    });
  });

  describe('BODY_OUTLINES', () => {
    it('has exactly 2 entries (front and back)', () => {
      expect(BODY_OUTLINES).toHaveLength(2);
      const views = BODY_OUTLINES.map(o => o.view);
      expect(views).toContain('front');
      expect(views).toContain('back');
    });
  });

  describe('MUSCLE_REGIONS', () => {
    it('has exactly 15 entries', () => {
      expect(MUSCLE_REGIONS).toHaveLength(15);
    });

    it('has exactly 7 front-view regions', () => {
      const front = MUSCLE_REGIONS.filter(r => r.view === 'front');
      expect(front).toHaveLength(7);
    });

    it('has exactly 8 back-view regions', () => {
      const back = MUSCLE_REGIONS.filter(r => r.view === 'back');
      expect(back).toHaveLength(8);
    });

    it('contains all expected muscle IDs', () => {
      const expectedIds = [
        'chest', 'shoulders', 'biceps', 'forearms', 'abs', 'quads', 'adductors',
        'lats', 'traps', 'erectors', 'triceps', 'glutes', 'hamstrings', 'calves',
      ];
      const uniqueIds = [...new Set(MUSCLE_REGIONS.map(r => r.id))];
      for (const id of expectedIds) {
        expect(uniqueIds).toContain(id);
      }
    });

    it('has shoulders appearing exactly twice (once front, once back)', () => {
      const shoulders = MUSCLE_REGIONS.filter(r => r.id === 'shoulders');
      expect(shoulders).toHaveLength(2);
      expect(shoulders.find(r => r.view === 'front')).toBeDefined();
      expect(shoulders.find(r => r.view === 'back')).toBeDefined();
    });

    it('every region has a non-empty path string (length > 10)', () => {
      for (const region of MUSCLE_REGIONS) {
        expect(typeof region.path).toBe('string');
        expect(region.path.length).toBeGreaterThan(10);
      }
    });

    it('every region has labelPosition with numeric x and y', () => {
      for (const region of MUSCLE_REGIONS) {
        expect(region.labelPosition).toBeDefined();
        expect(typeof region.labelPosition.x).toBe('number');
        expect(typeof region.labelPosition.y).toBe('number');
      }
    });
  });
});
