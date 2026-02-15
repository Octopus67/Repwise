/**
 * Property tests for SourceBadge component logic.
 *
 * Tests the pure helper functions exported from SourceBadge.tsx
 * rather than rendering the React component.
 */
import * as fc from 'fast-check';
import {
  getSourceBadgeColor,
  getSourceBadgeIcon,
  getSourceTooltip,
  FoodSource,
} from '../../utils/sourceBadgeLogic';

const VALID_SOURCES: FoodSource[] = ['usda', 'verified', 'community', 'custom'];
const sourceArb = fc.constantFrom(...VALID_SOURCES);

/**
 * Property 19: Source-based badge rendering
 *
 * For any source value in {'usda', 'verified', 'community', 'custom'},
 * the badge function returns the correct color:
 *   - green (#22C55E) for usda/verified
 *   - gray (#9CA3AF) for community/custom
 *
 * **Validates: Requirements 8.1.2**
 */
describe('Property 19: Source-based badge rendering', () => {
  test('usda and verified sources always produce green color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('usda' as FoodSource, 'verified' as FoodSource),
        (source) => {
          expect(getSourceBadgeColor(source)).toBe('#22C55E');
        },
      ),
    );
  });

  test('community and custom sources always produce gray color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('community' as FoodSource, 'custom' as FoodSource),
        (source) => {
          expect(getSourceBadgeColor(source)).toBe('#9CA3AF');
        },
      ),
    );
  });

  test('for any valid source, color is either green or gray', () => {
    fc.assert(
      fc.property(sourceArb, (source) => {
        const color = getSourceBadgeColor(source);
        expect(['#22C55E', '#9CA3AF']).toContain(color);
      }),
    );
  });

  test('usda/verified get checkmark icon, community/custom get ellipse icon', () => {
    fc.assert(
      fc.property(sourceArb, (source) => {
        const icon = getSourceBadgeIcon(source);
        if (source === 'usda' || source === 'verified') {
          expect(icon).toBe('checkmark-circle');
        } else {
          expect(icon).toBe('ellipse-outline');
        }
      }),
    );
  });

  test('every valid source has a non-empty tooltip string', () => {
    fc.assert(
      fc.property(sourceArb, (source) => {
        const tooltip = getSourceTooltip(source);
        expect(typeof tooltip).toBe('string');
        expect(tooltip.length).toBeGreaterThan(0);
      }),
    );
  });
});
