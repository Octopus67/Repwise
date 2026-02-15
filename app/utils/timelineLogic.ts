/**
 * Timeline utility functions for progress photo browsing.
 *
 * Pure functions for sorting, filtering, and formatting photo metadata.
 */

import { PhotoMeta, PoseType } from './progressPhotoTypes';

/**
 * Sorts photos by capture_date in ascending (chronological) order.
 * Stable sort — photos with the same date maintain their relative order.
 */
export function sortPhotosByDate(photos: PhotoMeta[]): PhotoMeta[] {
  return [...photos].sort((a, b) => {
    if (a.capture_date < b.capture_date) return -1;
    if (a.capture_date > b.capture_date) return 1;
    return 0;
  });
}

/**
 * Filters photos by pose type. When filter is 'all', returns all photos.
 * Returns only photos whose pose_type exactly matches the filter.
 */
export function filterByPoseType(
  photos: PhotoMeta[],
  filter: PoseType | 'all',
): PhotoMeta[] {
  if (filter === 'all') return photos;
  return photos.filter((p) => p.pose_type === filter);
}

/**
 * Formats photo metadata for display below the timeline slider.
 * Returns a formatted date label and optional weight label.
 */
export function formatPhotoInfo(photo: PhotoMeta): {
  dateLabel: string;
  weightLabel: string | null;
} {
  const date = new Date(photo.capture_date);
  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const weightLabel =
    photo.bodyweight_kg != null
      ? `${photo.bodyweight_kg.toFixed(1)}kg`
      : null;

  return { dateLabel, weightLabel };
}
