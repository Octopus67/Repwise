/**
 * WNS Recommendations — Generate user-facing recommendations based on volume status.
 *
 * Compares current HU per muscle against volume landmarks (MEV, MAV, MRV)
 * and produces friendly, actionable recommendation strings.
 */

export interface VolumeLandmarks {
  mev: number;
  mavLow: number;
  mavHigh: number;
  mrv: number;
}

export type VolumeStatus = 'below_mev' | 'optimal' | 'approaching_mrv' | 'above_mrv';

/** Determine volume status for a muscle given current HU and landmarks. */
export function getVolumeStatus(currentHU: number, landmarks: VolumeLandmarks): VolumeStatus {
  if (currentHU > landmarks.mrv) return 'above_mrv';
  if (currentHU > landmarks.mavHigh) return 'approaching_mrv';
  if (currentHU >= landmarks.mev) return 'optimal';
  return 'below_mev';
}

/** Generate recommendation strings for each muscle group. */
export function generateRecommendations(
  huByMuscle: Record<string, number>,
  landmarksByMuscle: Record<string, VolumeLandmarks>,
): string[] {
  const recs: string[] = [];

  for (const [muscle, hu] of Object.entries(huByMuscle)) {
    const lm = landmarksByMuscle[muscle];
    if (!lm) continue;

    const label = formatMuscle(muscle);
    const status = getVolumeStatus(hu, lm);

    switch (status) {
      case 'below_mev':
        recs.push(`Consider adding volume for ${label} — you're below the effective threshold.`);
        break;
      case 'optimal':
        recs.push(`Great work on ${label}! You're in the optimal stimulus range.`);
        break;
      case 'approaching_mrv':
        recs.push(`${label} is near your recovery limit. Maintain or slightly reduce volume.`);
        break;
      case 'above_mrv':
        recs.push(`Warning: ${label} volume is very high. Consider deloading next session.`);
        break;
    }
  }

  return recs;
}

function formatMuscle(muscle: string): string {
  return muscle
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
