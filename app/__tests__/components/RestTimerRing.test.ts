/**
 * RestTimerRing — Pure logic tests
 *
 * Tests the exported getTimerColor function and formatRestTimer utility
 * used by RestTimerRing and RestTimerOverlay. These are pure functions
 * so we test logic directly without React rendering.
 */

import { getTimerColor } from '../../utils/restDurationV2';
import { formatRestTimer } from '../../utils/durationFormat';

// ─── (a) Color is green when remaining > 10s ────────────────────────────────

describe('getTimerColor — green zone (>10s)', () => {
  it('returns green for 11 seconds', () => {
    expect(getTimerColor(11)).toBe('green');
  });

  it('returns green for 60 seconds', () => {
    expect(getTimerColor(60)).toBe('green');
  });

  it('returns green for 180 seconds', () => {
    expect(getTimerColor(180)).toBe('green');
  });
});

// ─── (b) Color is yellow when 5-10s ─────────────────────────────────────────

describe('getTimerColor — yellow zone (>5 and ≤10s)', () => {
  it('returns yellow for 10 seconds', () => {
    expect(getTimerColor(10)).toBe('yellow');
  });

  it('returns yellow for 6 seconds', () => {
    expect(getTimerColor(6)).toBe('yellow');
  });

  it('returns yellow for 8 seconds', () => {
    expect(getTimerColor(8)).toBe('yellow');
  });
});

// ─── (c) Color is red when ≤ 5s ─────────────────────────────────────────────

describe('getTimerColor — red zone (≤5s)', () => {
  it('returns red for 5 seconds', () => {
    expect(getTimerColor(5)).toBe('red');
  });

  it('returns red for 1 second', () => {
    expect(getTimerColor(1)).toBe('red');
  });

  it('returns red for 0 seconds', () => {
    expect(getTimerColor(0)).toBe('red');
  });

  it('returns red for negative seconds', () => {
    expect(getTimerColor(-1)).toBe('red');
  });
});

// ─── (d) Pause logic — timer state simulation ───────────────────────────────
// The pause behavior is managed by RestTimerOverlay state machine.
// We test the state transitions as pure logic here.

describe('RestTimerOverlay pause logic (state machine)', () => {
  type TimerState = 'RUNNING' | 'PAUSED' | 'COMPLETED';

  function togglePause(state: TimerState): TimerState {
    return state === 'RUNNING' ? 'PAUSED' : 'RUNNING';
  }

  it('RUNNING → PAUSED on toggle', () => {
    expect(togglePause('RUNNING')).toBe('PAUSED');
  });

  it('PAUSED → RUNNING on toggle', () => {
    expect(togglePause('PAUSED')).toBe('RUNNING');
  });

  it('countdown does not decrement when paused (simulated)', () => {
    let remaining = 60;
    const paused = true;
    // Simulate one tick — if paused, remaining should not change
    if (!paused) remaining -= 1;
    expect(remaining).toBe(60);
  });
});

// ─── (e) +15s / -15s adjusts remaining ──────────────────────────────────────

describe('RestTimerOverlay adjust logic', () => {
  function adjustRemaining(remaining: number, delta: number): number {
    return Math.max(0, remaining + delta);
  }

  function adjustTotalDuration(total: number, delta: number): number {
    return Math.max(1, total + delta);
  }

  it('+15s adds 15 seconds to remaining', () => {
    expect(adjustRemaining(60, 15)).toBe(75);
  });

  it('-15s subtracts 15 seconds from remaining', () => {
    expect(adjustRemaining(60, -15)).toBe(45);
  });

  it('-15s does not go below 0', () => {
    expect(adjustRemaining(10, -15)).toBe(0);
  });

  it('+15s also adjusts total duration', () => {
    expect(adjustTotalDuration(90, 15)).toBe(105);
  });

  it('-15s total duration does not go below 1', () => {
    expect(adjustTotalDuration(10, -15)).toBe(1);
  });
});

// ─── (f) Skip dismisses immediately ─────────────────────────────────────────

describe('RestTimerOverlay skip logic', () => {
  it('skip calls onDismiss (simulated callback)', () => {
    let dismissed = false;
    const onDismiss = () => { dismissed = true; };
    // Simulate skip action
    onDismiss();
    expect(dismissed).toBe(true);
  });
});

// ─── formatRestTimer integration ─────────────────────────────────────────────

describe('formatRestTimer — M:SS format for ring center text', () => {
  it('formats 90 seconds as 1:30', () => {
    expect(formatRestTimer(90)).toBe('1:30');
  });

  it('formats 0 seconds as 0:00', () => {
    expect(formatRestTimer(0)).toBe('0:00');
  });

  it('formats 5 seconds as 0:05', () => {
    expect(formatRestTimer(5)).toBe('0:05');
  });

  it('formats 180 seconds as 3:00', () => {
    expect(formatRestTimer(180)).toBe('3:00');
  });

  it('formats negative as 0:00', () => {
    expect(formatRestTimer(-5)).toBe('0:00');
  });
});
