/**
 * Types for body measurements feature.
 * All values stored in metric (kg, cm). Display conversion is handled by unitConversion utils.
 */

export interface BodyMeasurement {
  id: string;
  measuredAt: string; // ISO datetime string
  weightKg: number | null;
  bodyFatPct: number | null;
  waistCm: number | null;
  neckCm: number | null;
  hipsCm: number | null;
  chestCm: number | null;
  bicepLeftCm: number | null;
  bicepRightCm: number | null;
  thighLeftCm: number | null;
  thighRightCm: number | null;
  calfLeftCm: number | null;
  calfRightCm: number | null;
  notes: string;
}

export interface MeasurementFormData {
  measuredAt: string;
  weight: string;
  bodyFatPct: string;
  waist: string;
  neck: string;
  hips: string;
  chest: string;
  bicepLeft: string;
  bicepRight: string;
  thighLeft: string;
  thighRight: string;
  calfLeft: string;
  calfRight: string;
  notes: string;
}

export interface NavyBFInput {
  sex: 'male' | 'female';
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipsCm: number; // used for females only
}

export type MeasurementUnit = 'metric' | 'imperial';
