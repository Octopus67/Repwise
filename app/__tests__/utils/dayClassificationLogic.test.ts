import { formatMuscleGroup, formatMuscleGroups } from '../../utils/dayClassificationLogic';

/**
 * Feature: training-day-indicator
 * Validates: Requirements 2.1, 2.2
 */

describe('formatMuscleGroup', () => {
  test('capitalizes single word', () => {
    expect(formatMuscleGroup('quads')).toBe('Quads');
  });

  test('splits underscores and title-cases each word', () => {
    expect(formatMuscleGroup('full_body')).toBe('Full Body');
  });

  test('handles already capitalized input', () => {
    expect(formatMuscleGroup('Other')).toBe('Other');
  });

  test('handles single character', () => {
    expect(formatMuscleGroup('a')).toBe('A');
  });

  test('returns empty string for null input', () => {
    expect(formatMuscleGroup(null)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(formatMuscleGroup(undefined)).toBe('');
  });

  test('returns empty string for empty string input', () => {
    expect(formatMuscleGroup('')).toBe('');
  });

  test('returns empty string for whitespace-only input', () => {
    expect(formatMuscleGroup('   ')).toBe('');
  });

  test('trims leading/trailing whitespace', () => {
    expect(formatMuscleGroup('  chest  ')).toBe('Chest');
  });

  test('handles non-string input gracefully', () => {
    // @ts-expect-error testing runtime safety
    expect(formatMuscleGroup(42)).toBe('');
  });
});

describe('formatMuscleGroups', () => {
  test('formats array of muscle groups', () => {
    expect(formatMuscleGroups(['chest', 'back'])).toEqual(['Chest', 'Back']);
  });

  test('returns empty array for empty input', () => {
    expect(formatMuscleGroups([])).toEqual([]);
  });

  test('handles mixed formats', () => {
    expect(formatMuscleGroups(['full_body', 'quads', 'Other'])).toEqual([
      'Full Body',
      'Quads',
      'Other',
    ]);
  });

  test('filters out null and undefined entries', () => {
    expect(formatMuscleGroups(['chest', null, undefined, 'back'])).toEqual(['Chest', 'Back']);
  });

  test('filters out empty string entries', () => {
    expect(formatMuscleGroups(['chest', '', '  ', 'back'])).toEqual(['Chest', 'Back']);
  });

  test('returns empty array for non-array input', () => {
    // @ts-expect-error testing runtime safety
    expect(formatMuscleGroups(null)).toEqual([]);
    // @ts-expect-error testing runtime safety
    expect(formatMuscleGroups(undefined)).toEqual([]);
  });
});
