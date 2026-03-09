/**
 * Pure logic functions for the micronutrient dashboard.
 */

;
import { getThemeColors, type ThemeColors } from '../hooks/useThemeColors';

export type NutrientStatus = 'deficient' | 'low' | 'adequate' | 'excess' | 'no_data';

export function getStatusColor(status: NutrientStatus, c: ThemeColors = getThemeColors()): string {
  switch (status) {
    case 'deficient': return c.semantic.negative;
    case 'low': return c.semantic.warning;
    case 'adequate': return c.semantic.positive;
    case 'excess': return c.accent.primary;
    case 'no_data': return c.text.muted;
  }
}

export function getStatusLabel(status: NutrientStatus): string {
  switch (status) {
    case 'deficient': return 'Deficient';
    case 'low': return 'Low';
    case 'adequate': return 'Adequate';
    case 'excess': return 'Excess';
    case 'no_data': return 'No Data';
  }
}

export function getScoreColor(score: number, c: ThemeColors = getThemeColors()): string {
  if (score >= 80) return c.semantic.positive;
  if (score >= 60) return c.semantic.positive;
  if (score >= 40) return c.semantic.warning;
  if (score >= 20) return c.semantic.warning;
  return c.semantic.negative;
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Very Poor';
}

export function formatNutrientValue(value: number, unit: string): string {
  if (value >= 1000 && unit === 'mg') return `${(value / 1000).toFixed(1)}g`;
  if (value >= 1000 && unit === 'mcg') return `${(value / 1000).toFixed(1)}mg`;
  if (value < 0.01) return `<0.01${unit}`;
  return `${value.toFixed(value < 1 ? 2 : 1)}${unit}`;
}

export function clampPct(pct: number): number {
  return Math.max(0, Math.min(pct, 100));
}
