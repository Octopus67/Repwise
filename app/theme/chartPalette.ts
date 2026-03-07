/**
 * Chart Color Palettes — theme-aware colors for charts and data visualization.
 *
 * Dark mode: lighter, less saturated (contrast on dark bg).
 * Light mode: darker, more saturated (contrast on white bg).
 */

import { useThemeStore } from '../store/useThemeStore';

export interface ChartPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
  positive: string;
  negative: string;
  warning: string;
  neutral: string;
  gridLine: string;
  axisLabel: string;
  tooltipBg: string;
  tooltipText: string;
}

const darkChartPalette: ChartPalette = {
  primary: '#06B6D4',
  secondary: '#22C55E',
  tertiary: '#F59E0B',
  quaternary: '#F472B6',
  positive: '#22C55E',
  negative: '#EF4444',
  warning: '#F59E0B',
  neutral: '#6B7280',
  gridLine: 'rgba(255,255,255,0.06)',
  axisLabel: '#94A3B8',
  tooltipBg: '#1A2029',
  tooltipText: '#F1F5F9',
};

const lightChartPalette: ChartPalette = {
  primary: '#0284C7',
  secondary: '#15803D',
  tertiary: '#B45309',
  quaternary: '#BE185D',
  positive: '#16A34A',
  negative: '#DC2626',
  warning: '#D97706',
  neutral: '#9CA3AF',
  gridLine: '#E2E8F0',
  axisLabel: '#64748B',
  tooltipBg: '#FFFFFF',
  tooltipText: '#0F172A',
};

export function getChartPalette(theme?: 'dark' | 'light'): ChartPalette {
  const t = theme ?? useThemeStore.getState().theme;
  return t === 'dark' ? darkChartPalette : lightChartPalette;
}

export function useChartPalette(): ChartPalette {
  const theme = useThemeStore((s) => s.theme);
  return theme === 'dark' ? darkChartPalette : lightChartPalette;
}
