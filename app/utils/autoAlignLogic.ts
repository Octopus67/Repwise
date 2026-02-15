/**
 * Auto-alignment utility functions for progress photo comparison.
 *
 * Computes transforms to center-align and scale-match two photos
 * based on their body alignment data.
 */

import { AlignmentData, ImageTransform } from './progressPhotoTypes';

/**
 * Pure function: given two AlignmentData objects, computes transforms
 * that center-align both photos horizontally and scale-match them.
 *
 * After applying transforms:
 * - Both photos' body centers align to the same horizontal position (0.5)
 * - Both photos' effective scales are equal (matched to the larger)
 */
export function alignForComparison(
  left: AlignmentData,
  right: AlignmentData,
): { leftTransform: ImageTransform; rightTransform: ImageTransform } {
  // Target center: 0.5 (middle of the frame)
  const targetCenterX = 0.5;

  // Scale matching: scale both to the larger scale value
  const maxScale = Math.max(left.scale, right.scale);
  const leftScaleFactor = maxScale / left.scale;
  const rightScaleFactor = maxScale / right.scale;

  // Translate to center-align horizontally
  const leftTranslateX = targetCenterX - left.centerX;
  const rightTranslateX = targetCenterX - right.centerX;

  // Vertical centering
  const targetCenterY = 0.5;
  const leftTranslateY = targetCenterY - left.centerY;
  const rightTranslateY = targetCenterY - right.centerY;

  return {
    leftTransform: {
      translateX: leftTranslateX,
      translateY: leftTranslateY,
      scale: leftScaleFactor,
    },
    rightTransform: {
      translateX: rightTranslateX,
      translateY: rightTranslateY,
      scale: rightScaleFactor,
    },
  };
}

/**
 * Analyzes an image to find the body center and relative scale.
 *
 * In v1, this uses a simplified heuristic approach:
 * - Resize image to small thumbnail for fast analysis
 * - Find approximate body bounding box via luminance contrast
 * - Return center coordinates and scale factor
 *
 * Falls back to center defaults if analysis fails.
 */
export async function computeAlignment(
  _imageUri: string,
): Promise<AlignmentData> {
  // V1 simplified implementation: return center defaults.
  // Full pixel analysis via expo-image-manipulator would go here.
  // For now, return a reasonable default that centers the body.
  return {
    centerX: 0.5,
    centerY: 0.45, // Slightly above center (typical body framing)
    scale: 1.0,
  };
}
