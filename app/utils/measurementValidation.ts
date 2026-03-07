/**
 * Validation helpers for body measurement form inputs.
 * All ranges are in metric (kg, cm).
 */

import type { MeasurementFormData } from '../types/measurements';

interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof MeasurementFormData, string>>;
}

const RANGES = {
  weight: { min: 20, max: 350, label: 'Weight' },
  bodyFatPct: { min: 2, max: 60, label: 'Body fat' },
  waist: { min: 40, max: 200, label: 'Waist' },
  neck: { min: 20, max: 70, label: 'Neck' },
  hips: { min: 50, max: 200, label: 'Hips' },
  chest: { min: 50, max: 200, label: 'Chest' },
  bicepLeft: { min: 15, max: 70, label: 'Bicep (Left)' },
  bicepRight: { min: 15, max: 70, label: 'Bicep (Right)' },
  thighLeft: { min: 25, max: 100, label: 'Thigh (Left)' },
  thighRight: { min: 25, max: 100, label: 'Thigh (Right)' },
  calfLeft: { min: 15, max: 70, label: 'Calf (Left)' },
  calfRight: { min: 15, max: 70, label: 'Calf (Right)' },
} as const;

function validateNumericField(
  value: string,
  field: keyof typeof RANGES,
): string | null {
  if (!value.trim()) return null; // optional field
  const num = parseFloat(value);
  if (isNaN(num)) return `${RANGES[field].label} must be a number`;
  const { min, max, label } = RANGES[field];
  if (num < min || num > max) return `${label} must be ${min}–${max}`;
  return null;
}

export function validateMeasurementForm(data: MeasurementFormData): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  if (!data.measuredAt.trim()) {
    errors.measuredAt = 'Date is required';
  }

  // At least weight or one circumference must be provided
  const numericFields: (keyof typeof RANGES)[] = [
    'weight', 'bodyFatPct', 'waist', 'neck', 'hips', 'chest',
    'bicepLeft', 'bicepRight', 'thighLeft', 'thighRight', 'calfLeft', 'calfRight',
  ];

  for (const field of numericFields) {
    const err = validateNumericField(data[field], field);
    if (err) errors[field] = err;
  }

  const hasAnyValue = numericFields.some((f) => data[f].trim() !== '');
  if (!hasAnyValue) {
    errors.weight = 'Enter at least one measurement';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
