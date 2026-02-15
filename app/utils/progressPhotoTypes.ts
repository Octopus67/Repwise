/**
 * Shared types and constants for the smart progress photos feature.
 */

export type PoseType = 'front_relaxed' | 'front_double_bicep' | 'side' | 'back';

export const POSE_TYPES: PoseType[] = [
  'front_relaxed',
  'front_double_bicep',
  'side',
  'back',
];

export interface AlignmentData {
  centerX: number; // 0-1 normalized horizontal center
  centerY: number; // 0-1 normalized vertical center
  scale: number;   // relative scale factor (1.0 = baseline)
}

export interface ImageTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

export interface PhotoMeta {
  id: string;
  capture_date: string;
  bodyweight_kg: number | null;
  pose_type: string;
  notes: string | null;
  alignment_data: AlignmentData | null;
}

export interface PhotoPathMap {
  [photoId: string]: string;
}
