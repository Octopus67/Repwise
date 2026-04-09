/**
 * HUFloatingPill — Floating pill showing cumulative session HU.
 *
 * Positioned above the exercise list. Color-coded by volume status:
 * green = optimal, yellow = below MEV, orange = approaching MRV, red = above MRV.
 *
 * Requirements: Feature 6, Step 4
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { typography, spacing, radius, shadows } from '../../theme/tokens';
import { useThemeColors, getThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import type { VolumeStatus } from '../../utils/wnsRecommendations';

export interface HUFloatingPillProps {
  /** Cumulative HU keyed by muscle group */
  huByMuscle: Record<string, number>;
  /** Volume status per muscle (for color coding) */
  statusByMuscle?: Record<string, VolumeStatus>;
  onPress?: () => void;
}

function useStatusColors() {
  const c = useThemeColors();
  return {
    below_mev: { bg: c.semantic.warningSubtle, text: c.semantic.warning },
    optimal: { bg: c.semantic.positiveSubtle, text: c.semantic.positive },
    approaching_mrv: { bg: c.semantic.cautionSubtle, text: c.semantic.caution },
    above_mrv: { bg: c.semantic.negativeSubtle, text: c.semantic.negative },
  } as const;
}

function getBestStatus(statusByMuscle: Record<string, VolumeStatus> | undefined): VolumeStatus {
  if (!statusByMuscle) return 'optimal';
  const statuses = Object.values(statusByMuscle);
  if (statuses.includes('above_mrv')) return 'above_mrv';
  if (statuses.includes('approaching_mrv')) return 'approaching_mrv';
  if (statuses.includes('below_mev')) return 'below_mev';
  return 'optimal';
}

export function HUFloatingPill({ huByMuscle, statusByMuscle, onPress }: HUFloatingPillProps) {
  const STATUS_COLORS = useStatusColors();
  const entries = Object.entries(huByMuscle).filter(([, hu]) => hu > 0);
  if (entries.length === 0) return null;

  const totalHU = entries.reduce((sum, [, hu]) => sum + hu, 0);
  const overallStatus = getBestStatus(statusByMuscle);
  const pillColor = STATUS_COLORS[overallStatus] ?? STATUS_COLORS.optimal;

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: pillColor.bg }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Session stimulus: ${totalHU.toFixed(1)} Hard Units across ${entries.length} muscle groups`}
      accessibilityRole="button"
      accessibilityHint="Tap for HU breakdown"
    >
      <Icon name="chart" size={14} color={pillColor.text} />
      <Text style={[styles.text, { color: pillColor.text }]}>
        {totalHU.toFixed(1)} HU
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    gap: spacing[1],
    ...shadows.sm,
  },
  icon: {
    fontSize: typography.size.sm,
  },
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
});
