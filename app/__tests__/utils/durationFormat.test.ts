import * as fc from 'fast-check';
import { formatDuration, formatRestTimer } from '../../utils/durationFormat';

const NUM_RUNS = 100;

/**
 * Property 14: Duration formatting is correct
 * **Validates: Requirements 9.2**
 */
describe('Duration Format Property Tests', () => {
  it('returns MM:SS format for seconds < 3600', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3599 }),
        (seconds) => {
          const result = formatDuration(seconds);
          return /^\d{2}:\d{2}$/.test(result);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('returns H:MM:SS format for seconds >= 3600', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3600, max: 359999 }),
        (seconds) => {
          const result = formatDuration(seconds);
          return /^\d+:\d{2}:\d{2}$/.test(result);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('values are mathematically correct for < 3600', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3599 }),
        (seconds) => {
          const result = formatDuration(seconds);
          const [mm, ss] = result.split(':').map(Number);
          return mm * 60 + ss === seconds;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('values are mathematically correct for >= 3600', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3600, max: 359999 }),
        (seconds) => {
          const result = formatDuration(seconds);
          const [h, mm, ss] = result.split(':').map(Number);
          return h * 3600 + mm * 60 + ss === seconds;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

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
  it('formatDuration(3661) === "1:01:01"', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('formatDuration(0) === "00:00"', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formatDuration(3599) === "59:59"', () => {
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('formatDuration(3600) === "1:00:00"', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });

  it('formatDuration(61) === "01:01"', () => {
    expect(formatDuration(61)).toBe('01:01');
  });

  it('formatRestTimer(90) === "1:30"', () => {
    expect(formatRestTimer(90)).toBe('1:30');
  });

  it('formatRestTimer(5) === "0:05"', () => {
    expect(formatRestTimer(5)).toBe('0:05');
  });

  it('formatDuration handles negative input gracefully', () => {
    expect(formatDuration(-1)).toBe('00:00');
  });

  it('formatRestTimer handles negative input gracefully', () => {
    expect(formatRestTimer(-1)).toBe('0:00');
  });
});
