/**
 * Edit Plan Logic — Pure functions for the EditPlanPanel.
 *
 * All unit conversion, draft initialization, validation, payload building,
 * and summary formatting live here. No React dependency.
 */

import {
  formatWeight,
  formatHeight,
  parseWeightInput,
  convertWeight,
  cmToFtIn,
  ftInToCm,
} from './unitConversion';
import type { UnitSystem } from './unitConversion';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'cutting' | 'maintaining' | 'bulking';

export interface EditDraft {
  weight: string;
  heightCm: string;
  heightFeet: string;
  heightInches: string;
  bodyFatPct: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetWeight: string;
  goalRate: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof EditDraft, string>>;
}

export interface SummaryFields {
  weight: string;
  height: string;
  bodyFat: string;
  activityLevel: string;
  goalType: string;
  targetWeight: string;
  goalRate: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export interface RecalculatePayload {
  metrics: {
    weight_kg: number;
    height_cm: number;
    body_fat_pct?: number;
    activity_level: string;
  };
  goals: {
    goal_type: string;
    target_weight_kg?: number;
    goal_rate_per_week?: number;
  };
}

// ─── Prop shapes (matching store slices) ─────────────────────────────────────

type Metrics = {
  id: string;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  activityLevel: string | null;
  recordedAt: string;
} | null;

type Goals = {
  id: string;
  userId: string;
  goalType: string;
  targetWeightKg: number | null;
  goalRatePerWeek: number | null;
} | null;

type AdaptiveTargets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} | null;

// ─── Constants ───────────────────────────────────────────────────────────────

const KG_TO_LBS = 2.20462;

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very Active',
};

const GOAL_LABELS: Record<string, string> = {
  cutting: 'Cutting',
  maintaining: 'Maintaining',
  bulking: 'Bulking',
};

// ─── formatSummaryFields ─────────────────────────────────────────────────────

export function formatSummaryFields(
  metrics: Metrics,
  goals: Goals,
  targets: AdaptiveTargets,
  unitSystem: UnitSystem,
): SummaryFields {
  const DASH = '—';

  // Weight
  const weight =
    metrics?.weightKg != null ? formatWeight(metrics.weightKg, unitSystem) : DASH;

  // Height
  const height =
    metrics?.heightCm != null ? formatHeight(metrics.heightCm, unitSystem) : DASH;

  // Body fat
  const bodyFat =
    metrics?.bodyFatPct != null ? `${metrics.bodyFatPct}%` : DASH;

  // Activity level
  const activityLevel =
    metrics?.activityLevel != null
      ? ACTIVITY_LABELS[metrics.activityLevel] ?? DASH
      : DASH;

  // Goal type
  const goalType =
    goals?.goalType != null ? GOAL_LABELS[goals.goalType] ?? DASH : DASH;

  // Target weight
  const targetWeight =
    goals?.targetWeightKg != null
      ? formatWeight(goals.targetWeightKg, unitSystem)
      : DASH;

  // Goal rate
  let goalRate: string = DASH;
  if (goals?.goalRatePerWeek != null) {
    const rate = goals.goalRatePerWeek;
    const unitSuffix = unitSystem === 'imperial' ? 'lbs/week' : 'kg/week';
    const displayRate =
      unitSystem === 'imperial'
        ? Math.round(rate * KG_TO_LBS * 10) / 10
        : Math.round(rate * 10) / 10;
    const sign = displayRate > 0 ? '+' : '';
    goalRate = `${sign}${displayRate} ${unitSuffix}`;
  }

  // Macro targets
  const calories =
    targets != null ? Math.round(targets.calories).toLocaleString('en-US') : DASH;
  const protein = targets != null ? `${Math.round(targets.protein_g)}g` : DASH;
  const carbs = targets != null ? `${Math.round(targets.carbs_g)}g` : DASH;
  const fat = targets != null ? `${Math.round(targets.fat_g)}g` : DASH;

  return {
    weight,
    height,
    bodyFat,
    activityLevel,
    goalType,
    targetWeight,
    goalRate,
    calories,
    protein,
    carbs,
    fat,
  };
}

// ─── initializeDraft ─────────────────────────────────────────────────────────

export function initializeDraft(
  metrics: Metrics,
  goals: Goals,
  unitSystem: UnitSystem,
): EditDraft {
  const draft: EditDraft = {
    weight: '',
    heightCm: '',
    heightFeet: '',
    heightInches: '',
    bodyFatPct: '',
    activityLevel: 'moderate',
    goalType: 'maintaining',
    targetWeight: '',
    goalRate: '',
  };

  if (metrics != null) {
    // Activity level
    if (metrics.activityLevel != null) {
      draft.activityLevel = metrics.activityLevel as ActivityLevel;
    }

    // Weight
    if (metrics.weightKg != null) {
      const converted = convertWeight(metrics.weightKg, unitSystem);
      draft.weight = formatDecimal(converted);
    }

    // Height
    if (metrics.heightCm != null) {
      if (unitSystem === 'imperial') {
        const { feet, inches } = cmToFtIn(metrics.heightCm);
        draft.heightFeet = String(feet);
        draft.heightInches = String(inches);
      } else {
        draft.heightCm = String(Math.round(metrics.heightCm));
      }
    }

    // Body fat
    if (metrics.bodyFatPct != null) {
      draft.bodyFatPct = formatDecimal(metrics.bodyFatPct);
    }
  }

  if (goals != null) {
    if (goals.goalType != null) {
      draft.goalType = goals.goalType as GoalType;
    }

    // Target weight
    if (goals.targetWeightKg != null) {
      const converted = convertWeight(goals.targetWeightKg, unitSystem);
      draft.targetWeight = formatDecimal(converted);
    }

    // Goal rate (kg/week → display unit)
    if (goals.goalRatePerWeek != null) {
      const rate =
        unitSystem === 'imperial'
          ? goals.goalRatePerWeek * KG_TO_LBS
          : goals.goalRatePerWeek;
      draft.goalRate = formatDecimal(Math.round(rate * 10) / 10);
    }
  }

  return draft;
}

/** Format a number as a string with up to 1 decimal, no trailing ".0". */
function formatDecimal(n: number): string {
  const fixed = n.toFixed(1);
  // Strip trailing .0 but keep e.g. "0.5"
  return fixed.endsWith('.0') ? String(Math.round(n)) : fixed;
}

// ─── validateDraft ───────────────────────────────────────────────────────────

export function validateDraft(
  draft: EditDraft,
  unitSystem: UnitSystem,
): ValidationResult {
  const errors: Partial<Record<keyof EditDraft, string>> = {};

  // Weight — required, must be positive
  const w = parseFloat(draft.weight);
  if (!draft.weight.trim() || isNaN(w) || w <= 0) {
    errors.weight = 'Enter a valid weight';
  }

  // Height
  if (unitSystem === 'imperial') {
    const ft = parseFloat(draft.heightFeet);
    const inches = parseFloat(draft.heightInches);
    if (!draft.heightFeet.trim() || isNaN(ft) || ft < 0) {
      errors.heightFeet = 'Enter a valid height';
    }
    if (!draft.heightInches.trim() || isNaN(inches) || inches < 0 || inches > 11) {
      errors.heightInches = 'Enter a valid height';
    }
  } else {
    const h = parseFloat(draft.heightCm);
    if (!draft.heightCm.trim() || isNaN(h) || h <= 0) {
      errors.heightCm = 'Enter a valid height';
    }
  }

  // Body fat % — optional, but if provided must be 0–100
  if (draft.bodyFatPct.trim() !== '') {
    const bf = parseFloat(draft.bodyFatPct);
    if (isNaN(bf) || bf < 0 || bf > 100) {
      errors.bodyFatPct = 'Must be between 0 and 100';
    }
  }

  // Target weight — optional, skipped for maintaining
  if (draft.goalType !== 'maintaining' && draft.targetWeight.trim() !== '') {
    const tw = parseFloat(draft.targetWeight);
    if (isNaN(tw) || tw <= 0) {
      errors.targetWeight = 'Enter a valid weight';
    }
  }

  // Goal rate — optional, skipped for maintaining
  if (draft.goalType !== 'maintaining' && draft.goalRate.trim() !== '') {
    const gr = parseFloat(draft.goalRate);
    if (isNaN(gr) || !isFinite(gr)) {
      errors.goalRate = 'Enter a valid rate';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── buildRecalculatePayload ─────────────────────────────────────────────────

export function buildRecalculatePayload(
  draft: EditDraft,
  unitSystem: UnitSystem,
): RecalculatePayload {
  // Weight → kg
  const weight_kg = parseWeightInput(parseFloat(draft.weight), unitSystem);

  // Height → cm
  const height_cm =
    unitSystem === 'imperial'
      ? ftInToCm(parseInt(draft.heightFeet, 10), parseInt(draft.heightInches, 10))
      : Math.round(parseFloat(draft.heightCm));

  // Metrics
  const metrics: RecalculatePayload['metrics'] = {
    weight_kg,
    height_cm,
    activity_level: draft.activityLevel,
  };

  // Body fat — optional
  if (draft.bodyFatPct.trim() !== '') {
    metrics.body_fat_pct = parseFloat(draft.bodyFatPct);
  }

  // Goals
  const goals: RecalculatePayload['goals'] = {
    goal_type: draft.goalType,
  };

  // Target weight — omit for maintaining or empty
  if (draft.goalType !== 'maintaining' && draft.targetWeight.trim() !== '') {
    goals.target_weight_kg = parseWeightInput(parseFloat(draft.targetWeight), unitSystem);
  }

  // Goal rate — omit for maintaining or empty; convert to kg/week
  if (draft.goalType !== 'maintaining' && draft.goalRate.trim() !== '') {
    const rateDisplay = parseFloat(draft.goalRate);
    const rateKg =
      unitSystem === 'imperial'
        ? Math.round((rateDisplay / KG_TO_LBS) * 100) / 100
        : Math.round(rateDisplay * 100) / 100;
    goals.goal_rate_per_week = rateKg;
  }

  return { metrics, goals };
}
