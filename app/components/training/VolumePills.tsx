/**
 * VolumePills — Horizontal scrollable pills showing weekly muscle volume.
 *
 * Each pill: "Chest: 8/16 (MAV: 14-18)"
 * Color coding: green within MAV, yellow approaching, red exceeding.
 *
 * Requirements: 5.1, 5.4
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { MuscleVolumeEntry } from '../../utils/volumeAggregator';
import { colors, typography, spacing, radius } from '../../theme/tokens';

export interface VolumePillsProps {
  muscleVolumes: MuscleVolumeEntry[];
}

function getPillColor(current: number, mavLow: number, mavHigh: number) {
  if (mavHigh <= 0) return { bg: colors.bg.surfaceRaised, text: colors.text.secondary };
  if (current > mavHigh) return { bg: colors.semantic.negativeSubtle, text: colors.semantic.negative };
  if (current >= mavHigh * 0.9) return { bg: colors.semantic.warningSubtle, text: colors.semantic.warning };
  if (current >= mavLow) return { bg: colors.semantic.positiveSubtle, text: colors.semantic.positive };
  return { bg: colors.bg.surfaceRaised, text: colors.text.secondary };
}

export const VolumePills: React.FC<VolumePillsProps> = ({ muscleVolumes }) => {
  if (!muscleVolumes.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {muscleVolumes.map((entry) => {
        const pillColor = getPillColor(entry.currentSets, entry.mavLow, entry.mavHigh);
        return (
          <View
            key={entry.muscleGroup}
            style={[styles.pill, { backgroundColor: pillColor.bg }]}
            accessibilityLabel={`${entry.muscleGroup}: ${entry.currentSets} sets, MAV ${entry.mavLow} to ${entry.mavHigh}`}
            accessibilityRole="text"
          >
            <Text style={[styles.pillText, { color: pillColor.text }]}>
              {entry.muscleGroup}: {entry.currentSets}
              {entry.mavHigh > 0 ? ` (MAV: ${entry.mavLow}-${entry.mavHigh})` : ''}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  pill: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});

export default VolumePills;
