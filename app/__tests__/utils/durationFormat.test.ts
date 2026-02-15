import * as fc from 'fast-check';
import { formatDuration, formatRestTimer } from '../../utils/durationFormat';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.1
 * **Validates: Requirements 1.2, 4.3**
 */

describe('Duration Format Property Tests', () => {
  /**
   * Property: For any non-negative integer seconds, formatDuration returns
   * a string matching /^\d{2}:\d{2}:\d{2}$/
   * **Validates: Requirements 1.2**
   */
  it('formatDuration always returns HH:MM:SS format for non-negative integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 359999 }),
        (seconds) => {
          const result = formatDuration(seconds);
          return /^\d{2}:\d{2}:\d{2}$/.test(result);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: For any non-negative integer seconds, formatRestTimer returns
   * a string matching /^\d+:\d{2}$/
   * **Validates: Requirements 4.3**
   */
  it('formatRestTimer always returns M:SS format for non-negative integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        (seconds) => {
          const result = formatRestTimer(seconds);
          return /^\d+:\d{2}$/.test(result);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Duration Format — specific value tests', () => {
  it('formatDuration(3661) === "01:01:01"', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('formatDuration(0) === "00:00:00"', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formatDuration(3599) === "00:59:59"', () => {
    expect(formatDuration(3599)).toBe('00:59:59');
  });

  it('formatRestTimer(90) === "1:30"', () => {
    expect(formatRestTimer(90)).toBe('1:30');
  });

  it('formatRestTimer(5) === "0:05"', () => {
    expect(formatRestTimer(5)).toBe('0:05');
  });

  it('formatDuration handles negative input gracefully', () => {
    expect(formatDuration(-1)).toBe('00:00:00');
  });

  it('formatRestTimer handles negative input gracefully', () => {
    expect(formatRestTimer(-1)).toBe('0:00');
  });
});
