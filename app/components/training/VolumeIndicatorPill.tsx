/**
 * VolumeIndicatorPill — Inline volume tracking during workout
 *
 * Displays above exercise card list: "Chest: 12/16 sets" with color coding.
 * Below MEV = red, MEV-MAV = yellow, MAV-MRV = green, above MRV = red.
 *
 * Fetches weekly volume from existing GET /analytics/muscle-volume endpoint
 * on workout start. Updates count in real-time when sets are completed
 * (local state increment, not re-fetch).
 *
 * Task: 4.6
 */

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import api from '../../services/api';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { getVolumeColor, VolumeColor } from '../../utils/intelligenceLayerLogic';

interface MuscleVolumeData {
  muscle_group: string;
  current_sets: number;
  mev: number;
  mav: number;
  mrv: number;
}

interface VolumeIndicatorPillProps {
  muscleGroups: string[];
  completedSetCounts: Record<string, number>;
}

const COLOR_MAP: Record<VolumeColor, string> = {
  red: colors.semantic.negative,
  yellow: colors.semantic.warning,
  green: colors.semantic.positive,
};

const BG_COLOR_MAP: Record<VolumeColor, string> = {
  red: colors.semantic.negativeSubtle,
  yellow: colors.semantic.warningSubtle,
  green: colors.semantic.positiveSubtle,
};

export function VolumeIndicatorPill({ muscleGroups, completedSetCounts }: VolumeIndicatorPillProps) {
  const [volumeData, setVolumeData] = useState<Record<string, MuscleVolumeData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('analytics/muscle-volume');
        if (!cancelled && data) {
          const mapped: Record<string, MuscleVolumeData> = {};
          for (const item of data) {
            mapped[item.muscle_group.toLowerCase()] = {
              muscle_group: item.muscle_group,
              current_sets: item.current_sets ?? 0,
              mev: item.mev ?? 0,
              mav: item.mav ?? 10,
              mrv: item.mrv ?? 20,
            };
          }
          setVolumeData(mapped);
        }
      } catch {
        // best-effort — volume pills are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || muscleGroups.length === 0) return null;

  const uniqueGroups = [...new Set(muscleGroups.map(g => g.toLowerCase()))];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollContainer}
      contentContainerStyle={styles.pillRow}
    >
      {uniqueGroups.map((group) => {
        const data = volumeData[group];
        if (!data) return null;

        const localIncrement = completedSetCounts[group] ?? 0;
        const totalSets = data.current_sets + localIncrement;
        const color = getVolumeColor(totalSets, data.mev, data.mav, data.mrv);
        const textColor = COLOR_MAP[color];
        const bgColor = BG_COLOR_MAP[color];
        const displayName = group.charAt(0).toUpperCase() + group.slice(1);

        return (
          <View key={group} style={[styles.pill, { backgroundColor: bgColor }]}>
            <Text style={[styles.pillText, { color: textColor }]}>
              {displayName}: {totalSets}/{data.mav} sets
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 0,
    marginBottom: spacing[2],
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  pillText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
