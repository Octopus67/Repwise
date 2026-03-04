import {
  getStatusColor,
  getStatusLabel,
  getScoreColor,
  getScoreLabel,
  formatNutrientValue,
  clampPct,
} from '../../utils/microDashboardLogic';

describe('getStatusColor', () => {
  test('deficient is red', () => expect(getStatusColor('deficient')).toBe('#EF4444'));
  test('low is yellow', () => expect(getStatusColor('low')).toBe('#F59E0B'));
  test('adequate is green', () => expect(getStatusColor('adequate')).toBe('#22C55E'));
  test('excess is blue', () => expect(getStatusColor('excess')).toBe('#06B6D4'));
});

describe('getScoreColor', () => {
  test('80+ is green', () => expect(getScoreColor(85)).toBe('#22C55E'));
  test('60-79 is green', () => expect(getScoreColor(65)).toBe('#22C55E'));
  test('40-59 is yellow', () => expect(getScoreColor(45)).toBe('#F59E0B'));
  test('20-39 is yellow', () => expect(getScoreColor(25)).toBe('#F59E0B'));
  test('<20 is red', () => expect(getScoreColor(10)).toBe('#EF4444'));
});

describe('getScoreLabel', () => {
  test('80+ is Excellent', () => expect(getScoreLabel(90)).toBe('Excellent'));
  test('40-59 is Fair', () => expect(getScoreLabel(50)).toBe('Fair'));
  test('<20 is Very Poor', () => expect(getScoreLabel(5)).toBe('Very Poor'));
});

describe('formatNutrientValue', () => {
  test('large mg converts to g', () => expect(formatNutrientValue(1500, 'mg')).toBe('1.5g'));
  test('small mg stays', () => expect(formatNutrientValue(8.5, 'mg')).toBe('8.5mg'));
  test('large mcg converts to mg', () => expect(formatNutrientValue(2000, 'mcg')).toBe('2.0mg'));
  test('tiny value shows <0.01', () => expect(formatNutrientValue(0.001, 'mg')).toBe('<0.01mg'));
  test('sub-1 shows 2 decimals', () => expect(formatNutrientValue(0.45, 'mg')).toBe('0.45mg'));
});

describe('clampPct', () => {
  test('clamps above 100', () => expect(clampPct(150)).toBe(100));
  test('clamps below 0', () => expect(clampPct(-10)).toBe(0));
  test('passes through normal', () => expect(clampPct(75)).toBe(75));
});
