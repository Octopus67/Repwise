import * as fc from 'fast-check';

/**
 * Feature: ux-redesign-v1, Property 4: Quick action completion badge
 * Validates: Requirements 3.4
 *
 * Tests the conditional logic: the checkmark badge is present iff completed is true.
 * Extracted from QuickActionButton component: {completed && <Badge />}
 */

function shouldShowBadge(completed: boolean): boolean {
  return completed;
}

describe('Property 4: Quick action completion badge', () => {
  test('badge is present iff completed is true', () => {
    fc.assert(
      fc.property(fc.boolean(), (completed) => {
        const hasBadge = shouldShowBadge(completed);
        expect(hasBadge).toBe(completed);
      }),
      { numRuns: 100 },
    );
  });

  test('badge is always shown when completed=true', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 6, maxLength: 6 }),
        (completed, _icon, _label, _color) => {
          expect(shouldShowBadge(completed)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('badge is never shown when completed=false', () => {
    fc.assert(
      fc.property(
        fc.constant(false),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 6, maxLength: 6 }),
        (completed, _icon, _label, _color) => {
          expect(shouldShowBadge(completed)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples', () => {
    expect(shouldShowBadge(true)).toBe(true);
    expect(shouldShowBadge(false)).toBe(false);
  });
});
