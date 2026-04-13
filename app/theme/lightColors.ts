/**
 * Light Mode Color Palette
 *
 * Mirrors the dark theme structure from tokens.ts.
 * Designed for outdoor / daytime readability with WCAG AA contrast.
 */

export const lightColors = {
  bg: {
    base: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceRaised: '#F1F5F9',
    overlay: 'rgba(0,0,0,0.4)',
  },

  border: {
    subtle: 'rgba(0,0,0,0.06)',
    default: '#E2E8F0',
    hover: 'rgba(0,0,0,0.12)',
    focus: '#0369A1',
    highlight: 'rgba(0,0,0,0.04)',
  },

  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#64748B',
    inverse: '#F8FAFC',
    onAccent: '#FFFFFF',
  },

  accent: {
    primary: '#0369A1',
    primaryHover: '#0369A1',
    primaryMuted: 'rgba(2,132,199,0.12)',
  },

  semantic: {
    positive: '#15803D',
    positiveSubtle: 'rgba(21,128,61,0.10)',
    negative: '#DC2626',
    negativeSubtle: 'rgba(220,38,38,0.10)',
    warning: '#B45309',
    warningSubtle: 'rgba(180,83,9,0.10)',
    caution: '#EA580C',
    cautionSubtle: 'rgba(234,88,12,0.10)',
    overTarget: '#4B6A9B',
    overTargetSubtle: 'rgba(75,106,155,0.12)',
    info: '#0EA5E9',
    infoSubtle: 'rgba(14,165,233,0.10)',
  },

  premium: {
    gold: '#B8960C',
    goldSubtle: 'rgba(184,150,12,0.10)',
  },

  gradient: {
    premiumCta: ['#0369A1', '#075985'] as const,
    start: '#0369A1',
    end: '#0369A1',
  },

  gradientArrays: {
    primary: ['#0891B2', '#0E7490'],
    premium: ['#0369A1', '#075985'],
    calories: ['#0891B2', '#0E7490'],
    protein: ['#16A34A', '#15803D'],
    carbs: ['#D97706', '#B45309'],
    fat: ['#DC2626', '#B91C1C'],
    volume: ['#8B5CF6', '#7C3AED'],
  },

  chart: {
    calories: '#0369A1',
    positiveTrend: '#15803D',
    negativeDev: '#DC2626',
    warningThreshold: '#B45309',
    neutral: '#9CA3AF',
    // Light-mode specific: darker/more saturated for white bg contrast
    gridLine: '#E2E8F0',
    axisLabel: '#64748B',
  },

  macro: {
    calories: '#0369A1',
    caloriesSubtle: 'rgba(3,105,161,0.10)',
    protein: '#15803D',
    proteinSubtle: 'rgba(21,128,61,0.10)',
    carbs: '#B45309',
    carbsSubtle: 'rgba(180,83,9,0.10)',
    fat: '#DC2626',
    fatSubtle: 'rgba(220,38,38,0.10)',
  },

  error: '#DC2626',
  warning: '#B45309',
  success: '#15803D',

  heatmap: {
    untrained: '#E2E8F0',
    belowMev: '#15803D',
    optimal: '#0369A1',
    nearMrv: '#B45309',
    aboveMrv: '#DC2626',
    silhouetteStroke: 'rgba(0,0,0,0.10)',
    regionBorder: 'rgba(0,0,0,0.15)',
    regionOpacity: 0.85,
  },
} as const;
