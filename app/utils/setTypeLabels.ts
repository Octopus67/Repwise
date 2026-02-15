/**
 * Set Type Labels & Abbreviations
 *
 * Pure data mapping for SetType display. Shared between components and tests.
 */

import type { SetType } from '../types/training';

/** Single-character abbreviation for compact display in Set_Row */
export const SET_TYPE_ABBREVIATIONS: Record<SetType, string> = {
  normal: 'N',
  'warm-up': 'W',
  'drop-set': 'D',
  amrap: 'A',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normal',
  'warm-up': 'Warm-up',
  'drop-set': 'Drop Set',
  amrap: 'AMRAP',
};
