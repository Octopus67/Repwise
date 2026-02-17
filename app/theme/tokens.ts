/**
 * HypertrophyOS Design Token System
 *
 * Bloomberg Terminal × modern fintech × elite training brand.
 * Dark-first with layered depth. Institutional, trustworthy, engineered.
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
  bg: {
    base: '#0A0E13',
    surface: '#12171F',
    surfaceRaised: '#1A2029',
    overlay: 'rgba(0,0,0,0.6)',
  },

  border: {
    subtle: 'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.08)',
    hover: 'rgba(255,255,255,0.12)',
    focus: '#06B6D4',
  },

  text: {
    primary: '#F1F5F9',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverse: '#0B0F14',
  },

  accent: {
    primary: '#06B6D4',
    primaryHover: '#0891B2',
    primaryMuted: 'rgba(6,182,212,0.12)',
  },

  semantic: {
    positive: '#22C55E',
    positiveSubtle: 'rgba(34,197,94,0.12)',
    negative: '#EF4444',
    negativeSubtle: 'rgba(239,68,68,0.12)',
    warning: '#F59E0B',
    warningSubtle: 'rgba(245,158,11,0.12)',
    overTarget: '#6B8FBF',
    overTargetSubtle: 'rgba(107,143,191,0.15)',
  },

  premium: {
    gold: '#D4AF37',
    goldSubtle: 'rgba(212,175,55,0.12)',
  },

  gradient: {
    premiumCta: ['#06B6D4', '#0E7490'] as const,
    start: '#06B6D4',
    end: '#0E7490',
  },

  chart: {
    calories: '#06B6D4',
    positiveTrend: '#22C55E',
    negativeDev: '#EF4444',
    warningThreshold: '#F59E0B',
    neutral: '#6B7280',
  },

  macro: {
    calories: '#06B6D4',
    caloriesSubtle: 'rgba(6,182,212,0.10)',
    protein: '#22C55E',
    proteinSubtle: 'rgba(34,197,94,0.10)',
    carbs: '#F59E0B',
    carbsSubtle: 'rgba(245,158,11,0.10)',
    fat: '#F472B6',
    fatSubtle: 'rgba(244,114,182,0.10)',
  },

  heatmap: {
    untrained: '#1E293B',
    belowMev: '#22C55E',
    optimal: '#06B6D4',
    nearMrv: '#F59E0B',
    aboveMrv: '#EF4444',
    silhouetteStroke: 'rgba(255,255,255,0.08)',
    regionBorder: 'rgba(255,255,255,0.12)',
    regionOpacity: 0.85,
  },
} as const;


// ─── Elevation ───────────────────────────────────────────────────────────────

export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 12px rgba(0,0,0,0.4)',
  lg: '0 8px 24px rgba(0,0,0,0.5)',
  button: '0 2px 12px rgba(0,0,0,0.4)',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: 'Inter',
    sansIOS: 'SF Pro Display',
    mono: 'JetBrains Mono',
  },

  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  size: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
  },

  numeric: {
    fontVariant: ['tabular-nums', 'lining-nums'] as const,
  },
} as const;

// ─── Spacing (8px grid) ─────────────────────────────────────────────────────

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    fast: 100,
    default: 200,
    slow: 300,
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
  },
} as const;

// ─── Letter Spacing ──────────────────────────────────────────────────────────

export const letterSpacing = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.5,
} as const;

// ─── Shadows (React Native format) ──────────────────────────────────────────

export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
} as const;

/** Creates a glow shadow style for a given color. Use for accent highlights. */
export function glowShadow(color: string, glowRadius = 12, glowOpacity = 0.3) {
  return { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: glowOpacity, shadowRadius: glowRadius, elevation: 0 };
}

// ─── Animation Spring Configs ────────────────────────────────────────────────

export const springs = {
  gentle: { damping: 20, stiffness: 200, mass: 0.5 },
  snappy: { damping: 15, stiffness: 400, mass: 0.3 },
  bouncy: { damping: 10, stiffness: 300, mass: 0.5 },
} as const;

// ─── Opacity Scale ───────────────────────────────────────────────────────────

export const opacityScale = {
  disabled: 0.4,
  muted: 0.6,
  subtle: 0.08,
  hover: 0.12,
} as const;

// ─── Convenience re-export ───────────────────────────────────────────────────

export const theme = {
  colors,
  elevation,
  typography,
  spacing,
  radius,
  motion,
  letterSpacing,
  shadows,
  springs,
  opacityScale,
} as const;

export type Theme = typeof theme;
