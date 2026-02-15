import * as fc from 'fast-check';
import { getGreeting } from '../../utils/greeting';

/**
 * Feature: ux-redesign-v1, Property 1: Greeting personalization
 * Validates: Requirements 2.1
 */

describe('Property 1: Greeting personalization', () => {
  const VALID_GREETINGS = ['Good morning', 'Good afternoon', 'Good evening'];

  test('result is never empty for any displayName and hour', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 50 }),
        ),
        fc.integer({ min: 0, max: 23 }),
        (displayName, hour) => {
          const result = getGreeting(displayName, hour);
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('contains displayName when non-empty', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 23 }),
        (displayName, hour) => {
          const result = getGreeting(displayName, hour);
          expect(result).toContain(displayName);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('contains one of the valid greeting prefixes', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 50 }),
        ),
        fc.integer({ min: 0, max: 23 }),
        (displayName, hour) => {
          const result = getGreeting(displayName, hour);
          const hasGreeting = VALID_GREETINGS.some((g) => result.includes(g));
          expect(hasGreeting).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('morning when hour < 12, afternoon when 12 <= hour < 17, evening when hour >= 17', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 50 }),
        ),
        fc.integer({ min: 0, max: 23 }),
        (displayName, hour) => {
          const result = getGreeting(displayName, hour);
          if (hour < 12) {
            expect(result).toContain('Good morning');
          } else if (hour < 17) {
            expect(result).toContain('Good afternoon');
          } else {
            expect(result).toContain('Good evening');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples', () => {
    expect(getGreeting('Alex', 8)).toBe('Good morning, Alex');
    expect(getGreeting('Alex', 14)).toBe('Good afternoon, Alex');
    expect(getGreeting('Alex', 20)).toBe('Good evening, Alex');
    expect(getGreeting(undefined, 8)).toBe('Good morning');
    expect(getGreeting(null, 14)).toBe('Good afternoon');
    expect(getGreeting('', 20)).toBe('Good evening');
  });
});
