import * as fc from 'fast-check';
import { formatTimer } from '../utils/formatTimer';

const NUM_RUNS = 100;

describe('Timer Display Formatting Property Tests', () => {
  /**
   * Property 17: Timer display formatting
   * For any non-negative integer seconds, output matches /^\d+:\d{2}$/
   * and minutes × 60 + parsed seconds equals input.
   * **Validates: Requirements 8.6**
   */
  it('Property 17: Timer display formatting — output matches M:SS and round-trips', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        (seconds) => {
          const result = formatTimer(seconds);

          // Must match M:SS pattern (one or more digits, colon, exactly two digits)
          if (!/^\d+:\d{2}$/.test(result)) return false;

          // Parse back and verify round-trip
          const [minStr, secStr] = result.split(':');
          const parsedMinutes = parseInt(minStr, 10);
          const parsedSeconds = parseInt(secStr, 10);

          // Seconds portion must be 0-59
          if (parsedSeconds < 0 || parsedSeconds > 59) return false;

          // Round-trip: minutes * 60 + seconds === input
          return parsedMinutes * 60 + parsedSeconds === seconds;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
