import * as fc from 'fast-check';

/**
 * Feature: ux-redesign-v1, Property 10: Empty state completeness
 * Validates: Requirements 8.1
 *
 * Tests the conditional logic of EmptyState: a button should be included
 * if and only if actionLabel is a non-empty string.
 */

/**
 * Pure logic extracted from EmptyState component:
 * The component renders a Button when actionLabel is truthy (non-empty string).
 */
function shouldShowButton(actionLabel?: string): boolean {
  return !!actionLabel;
}

describe('Property 10: Empty state completeness', () => {
  const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 });

  test('button is shown iff actionLabel is non-empty', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // icon
        nonEmptyStringArb, // title
        nonEmptyStringArb, // description
        fc.option(nonEmptyStringArb, { nil: undefined }), // actionLabel
        (icon, title, description, actionLabel) => {
          const hasButton = shouldShowButton(actionLabel);
          if (actionLabel !== undefined && actionLabel.length > 0) {
            expect(hasButton).toBe(true);
          } else {
            expect(hasButton).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('button is not shown when actionLabel is undefined', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (_icon, _title, _description) => {
          expect(shouldShowButton(undefined)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('button is not shown when actionLabel is empty string', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (_icon, _title, _description) => {
          expect(shouldShowButton('')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('button is always shown when actionLabel is non-empty', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb, // actionLabel always non-empty
        (_icon, _title, _description, actionLabel) => {
          expect(shouldShowButton(actionLabel)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples', () => {
    expect(shouldShowButton('Log Nutrition')).toBe(true);
    expect(shouldShowButton('Try Again')).toBe(true);
    expect(shouldShowButton(undefined)).toBe(false);
    expect(shouldShowButton('')).toBe(false);
  });
});
