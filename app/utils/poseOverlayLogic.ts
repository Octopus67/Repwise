/**
 * Pose overlay utility functions.
 *
 * Maps pose types to SVG asset paths and computes overlay dimensions
 * that maintain the original aspect ratio within a container.
 */

import { PoseType } from './progressPhotoTypes';

const ASSET_MAP: Record<PoseType, string> = {
  front_relaxed: 'app/assets/pose-overlays/front-relaxed.svg',
  front_double_bicep: 'app/assets/pose-overlays/front-double-bicep.svg',
  side: 'app/assets/pose-overlays/side.svg',
  back: 'app/assets/pose-overlays/back.svg',
};

/**
 * Maps a pose type to its corresponding SVG asset path.
 * Each pose type maps to a unique asset.
 */
export function poseToAssetPath(poseType: PoseType): string {
  return ASSET_MAP[poseType];
}

/**
 * Computes overlay dimensions that fit within the container while
 * maintaining the original aspect ratio of the silhouette asset.
 *
 * Uses "contain" scaling — the overlay fills as much of the container
 * as possible without exceeding either dimension.
 */
export function computeOverlayDimensions(
  containerWidth: number,
  containerHeight: number,
  assetAspectRatio: number, // width / height
): { width: number; height: number } {
  if (containerWidth <= 0 || containerHeight <= 0 || assetAspectRatio <= 0) {
    return { width: 0, height: 0 };
  }

  const containerAspect = containerWidth / containerHeight;

  if (containerAspect > assetAspectRatio) {
    // Container is wider than asset — height-constrained
    const height = containerHeight;
    const width = height * assetAspectRatio;
    return { width, height };
  } else {
    // Container is taller than asset — width-constrained
    const width = containerWidth;
    const height = width / assetAspectRatio;
    return { width, height };
  }
}
