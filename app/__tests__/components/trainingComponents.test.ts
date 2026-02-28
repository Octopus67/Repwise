/**
 * Unit tests for leaf training component logic.
 *
 * Since Jest runs in a node environment (no React Native renderer),
 * we test the pure logic functions these components depend on.
 *
 * Feature: training-log-redesign, Task 12.6
 */

import { formatDuration, formatRestTimer } from '../../utils/durationFormat';
import { getTimerColor } from '../../utils/restDurationV2';
import { orderTemplates } from '../../utils/templateConversion';
import { SET_TYPE_ABBREVIATIONS } from '../../utils/setTypeLabels';
import type { SetType, WorkoutTemplateResponse } from '../../types/training';

// ─── formatDuration edge cases ──────────────────────────────────────────────

describe('formatDuration edge cases', () => {
  it('0 seconds → "00:00"', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('3599 seconds → "59:59"', () => {
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('3600 seconds → "1:00:00"', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });

  it('86399 seconds → "23:59:59"', () => {
    expect(formatDuration(86399)).toBe('23:59:59');
  });

  it('negative input → "00:00"', () => {
    expect(formatDuration(-5)).toBe('00:00');
  });

  it('NaN input → "00:00"', () => {
    expect(formatDuration(NaN)).toBe('00:00');
  });

  it('Infinity input → "00:00"', () => {
    expect(formatDuration(Infinity)).toBe('00:00');
  });
});

// ─── getTimerColor boundary values ──────────────────────────────────────────

describe('getTimerColor boundary values', () => {
  it('0 seconds → "red"', () => {
    expect(getTimerColor(0)).toBe('red');
  });

  it('5 seconds → "red" (≤5 is red)', () => {
    expect(getTimerColor(5)).toBe('red');
  });

  it('6 seconds → "yellow" (>5 and ≤10 is yellow)', () => {
    expect(getTimerColor(6)).toBe('yellow');
  });

  it('10 seconds → "yellow"', () => {
    expect(getTimerColor(10)).toBe('yellow');
  });

  it('11 seconds → "green" (>10 is green)', () => {
    expect(getTimerColor(11)).toBe('green');
  });

  it('negative seconds → "red"', () => {
    expect(getTimerColor(-1)).toBe('red');
  });
});

// ─── SetType abbreviation mapping ───────────────────────────────────────────

describe('SetType abbreviation mapping', () => {
  it('normal → "N"', () => {
    expect(SET_TYPE_ABBREVIATIONS['normal']).toBe('N');
  });

  it('warm-up → "W"', () => {
    expect(SET_TYPE_ABBREVIATIONS['warm-up']).toBe('W');
  });

  it('drop-set → "D"', () => {
    expect(SET_TYPE_ABBREVIATIONS['drop-set']).toBe('D');
  });

  it('amrap → "A"', () => {
    expect(SET_TYPE_ABBREVIATIONS['amrap']).toBe('A');
  });

  it('all 4 set types have abbreviations', () => {
    const types: SetType[] = ['normal', 'warm-up', 'drop-set', 'amrap'];
    for (const t of types) {
      expect(SET_TYPE_ABBREVIATIONS[t]).toBeDefined();
      expect(SET_TYPE_ABBREVIATIONS[t].length).toBe(1);
    }
  });
});

// ─── orderTemplates with mixed user/system templates ────────────────────────

describe('orderTemplates with mixed user/system templates', () => {
  const makeTemplate = (
    id: string,
    name: string,
    isSystem: boolean,
  ): WorkoutTemplateResponse => ({
    id,
    name,
    description: null,
    exercises: [
      {
        exercise_name: 'Bench Press',
        sets: [{ reps: 5, weight_kg: 60, rpe: null }],
      },
    ],
    is_system: isSystem,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });

  it('user templates appear before system templates', () => {
    const user = [makeTemplate('u1', 'My Push', false), makeTemplate('u2', 'My Pull', false)];
    const system = [makeTemplate('s1', 'Push', true), makeTemplate('s2', 'Pull', true)];

    const result = orderTemplates(user, system);

    expect(result.length).toBe(4);
    expect(result[0].is_system).toBe(false);
    expect(result[1].is_system).toBe(false);
    expect(result[2].is_system).toBe(true);
    expect(result[3].is_system).toBe(true);
  });

  it('empty user templates → only system templates', () => {
    const system = [makeTemplate('s1', 'Push', true)];
    const result = orderTemplates([], system);

    expect(result.length).toBe(1);
    expect(result[0].is_system).toBe(true);
  });

  it('empty system templates → only user templates', () => {
    const user = [makeTemplate('u1', 'My Push', false)];
    const result = orderTemplates(user, []);

    expect(result.length).toBe(1);
    expect(result[0].is_system).toBe(false);
  });

  it('both empty → empty result', () => {
    expect(orderTemplates([], [])).toEqual([]);
  });

  it('preserves order within each group', () => {
    const user = [makeTemplate('u1', 'A', false), makeTemplate('u2', 'B', false)];
    const system = [makeTemplate('s1', 'X', true), makeTemplate('s2', 'Y', true)];

    const result = orderTemplates(user, system);

    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
    expect(result[2].name).toBe('X');
    expect(result[3].name).toBe('Y');
  });
});
