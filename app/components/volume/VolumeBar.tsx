/**
 * VolumeBar — Horizontal bar showing current volume relative to landmarks.
 *
 * 4 colored zones: MV→MEV (yellow), MEV→MAV (green), MAV→MRV (orange), >MRV (red).
 * Indicator dot at currentVolume position.
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import type { WNSLandmarks } from '../../types/volume';

export interface VolumeBarProps {
  landmarks: WNSLandmarks;
  currentVolume: number;
  muscleGroup: string;
}

/** Zone colors derived from theme semantic tokens. */
const ZONE_COLORS = {
  belowMev: colors.semantic.warning,        // MV → MEV: yellow
  optimal: colors.semantic.positive,         // MEV → MAV: green
  approachingMrv: colors.semantic.caution,   // MAV → MRV: orange
  aboveMrv: colors.semantic.negative,        // > MRV: red
} as const;

const DOT_SIZE = 14;
const BAR_HEIGHT = 12;

function getZoneLabel(volume: number, landmarks: WNSLandmarks): string {
  if (volume < landmarks.mev) return 'Below MEV';
  if (volume <= landmarks.mav_high) return 'Optimal';
  if (volume <= landmarks.mrv) return 'Approaching MRV';
  return 'Above MRV';
}

export function VolumeBar({ landmarks, currentVolume, muscleGroup }: VolumeBarProps) {
  const { mv, mev, mav_high, mrv } = landmarks;
  // Total range extends 20% past MRV to show overflow
  const maxRange = mrv * 1.2;
  const pct = (v: number) => Math.max(0, Math.min((v / maxRange) * 100, 100));

  const mvPct = pct(mv);
  const mevPct = pct(mev);
  const mavPct = pct(mav_high);
  const mrvPct = pct(mrv);
  const dotPct = pct(currentVolume);

  const zone = getZoneLabel(currentVolume, landmarks);

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${muscleGroup} volume: ${currentVolume} sets. ${zone}. MV ${mv}, MEV ${mev}, MAV ${mav_high}, MRV ${mrv}`}
      accessibilityRole="progressbar"
    >
      {/* Zone bar */}
      <View style={styles.barTrack}>
        {/* MV → MEV zone */}
        <View
          style={[
            styles.zone,
            { left: `${mvPct}%`, width: `${mevPct - mvPct}%`, backgroundColor: ZONE_COLORS.belowMev },
          ]}
        />
        {/* MEV → MAV zone */}
        <View
          style={[
            styles.zone,
            { left: `${mevPct}%`, width: `${mavPct - mevPct}%`, backgroundColor: ZONE_COLORS.optimal },
          ]}
        />
        {/* MAV → MRV zone */}
        <View
          style={[
            styles.zone,
            { left: `${mavPct}%`, width: `${mrvPct - mavPct}%`, backgroundColor: ZONE_COLORS.approachingMrv },
          ]}
        />
        {/* > MRV zone */}
        <View
          style={[
            styles.zone,
            { left: `${mrvPct}%`, width: `${100 - mrvPct}%`, backgroundColor: ZONE_COLORS.aboveMrv },
          ]}
        />

        {/* Indicator dot */}
        <View
          style={[
            styles.dot,
            { left: `${dotPct}%` },
          ]}
        />
      </View>

      {/* Landmark labels */}
      <View style={styles.labels}>
        <Text style={[styles.label, { left: `${mevPct}%` }]}>MEV</Text>
        <Text style={[styles.label, { left: `${mavPct}%` }]}>MAV</Text>
        <Text style={[styles.label, { left: `${mrvPct}%` }]}>MRV</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[2],
  },
  barTrack: {
    height: BAR_HEIGHT,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'visible',
    position: 'relative',
  },
  zone: {
    position: 'absolute',
    top: 0,
    height: BAR_HEIGHT,
    opacity: 0.7,
  },
  dot: {
    position: 'absolute',
    top: (BAR_HEIGHT - DOT_SIZE) / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.text.primary,
    borderWidth: 2,
    borderColor: colors.bg.base,
    marginLeft: -(DOT_SIZE / 2),
  },
  labels: {
    position: 'relative',
    height: 16,
    marginTop: spacing[1],
  },
  label: {
    position: 'absolute',
    fontSize: typography.size.xs - 2,
    color: colors.text.muted,
    fontWeight: typography.weight.medium,
    transform: [{ translateX: -12 }],
  },
});
