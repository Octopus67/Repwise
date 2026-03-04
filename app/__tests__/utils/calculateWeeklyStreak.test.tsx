import { calculateWeeklyStreak } from '../../utils/calculateWeeklyStreak';

describe('calculateWeeklyStreak', () => {
  it('returns 0 for empty training dates', () => {
    const result = calculateWeeklyStreak([], '2024-01-15');
    expect(result).toBe(0);
  });

  it('returns 0 when current week has no training', () => {
    const trainedDates = ['2024-01-01', '2024-01-02']; // Previous weeks
    const result = calculateWeeklyStreak(trainedDates, '2024-01-15'); // Monday of different week
    expect(result).toBe(0);
  });

  it('returns 1 for current week only', () => {
    const trainedDates = ['2024-01-15']; // Monday of current week
    const result = calculateWeeklyStreak(trainedDates, '2024-01-15');
    expect(result).toBe(1);
  });

  it('calculates consecutive weekly streak correctly', () => {
    const trainedDates = [
      '2024-01-15', // Current week (Mon)
      '2024-01-08', // Previous week (Mon)
      '2024-01-01', // Week before (Mon)
    ];
    const result = calculateWeeklyStreak(trainedDates, '2024-01-15');
    expect(result).toBe(3);
  });

  it('stops at first week without training', () => {
    const trainedDates = [
      '2024-01-15', // Current week
      '2024-01-08', // Previous week
      // Gap: no training in week of 2024-01-01
      '2023-12-25', // Earlier week
    ];
    const result = calculateWeeklyStreak(trainedDates, '2024-01-15');
    expect(result).toBe(2); // Only current and previous week
  });

  it('handles multiple training days in same week', () => {
    const trainedDates = [
      '2024-01-15', // Monday
      '2024-01-17', // Wednesday
      '2024-01-19', // Friday - all same week
      '2024-01-08', // Previous week
    ];
    const result = calculateWeeklyStreak(trainedDates, '2024-01-15');
    expect(result).toBe(2); // Current week + previous week
  });

  it('handles invalid date strings', () => {
    const trainedDates = ['invalid-date', '2024-01-15'];
    const result = calculateWeeklyStreak(trainedDates, '2024-01-15');
    expect(result).toBe(1); // Only valid date counts
  });
});