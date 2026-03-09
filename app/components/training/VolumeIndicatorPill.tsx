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
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import api from '../../services/api';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { getVolumeColor, VolumeColor } from '../../utils/intelligenceLayerLogic';
import { HUExplainerSheet } from '../education/HUExplainerSheet';

interface MuscleVolumeData {
  muscle_group: string;
  current_sets: number;
  mev: number;
  mav: number;
  mrv: number;
  // WNS fields
  hypertrophy_units?: number;
  mav_low?: number;
  mav_high?: number;
}

interface VolumeIndicatorPillProps {
  muscleGroups: string[];
  completedSetCounts: Record<string, number>;
}

const getCOLOR_MAP = (c: ThemeColors): Record<VolumeColor, string> => ({
  red: c.semantic.negative,
  yellow: c.semantic.warning,
  green: c.semantic.positive,
});

const getBG_COLOR_MAP = (c: ThemeColors): Record<VolumeColor, string> => ({
  red: c.semantic.negativeSubtle,
  yellow: c.semantic.warningSubtle,
  green: c.semantic.positiveSubtle,
});

export function VolumeIndicatorPill({ muscleGroups, completedSetCounts }: VolumeIndicatorPillProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [volumeData, setVolumeData] = useState<Record<string, MuscleVolumeData>>({});
  const [isWNS, setIsWNS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [explainerVisible, setExplainerVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await api.get('training/analytics/muscle-volume', { signal: controller.signal });
        if (!cancelled && data) {
          const wns = data.engine === 'wns';
          setIsWNS(wns);
          const mapped: Record<string, MuscleVolumeData> = {};
          for (const item of data.muscle_groups ?? data ?? []) {
            mapped[item.muscle_group.toLowerCase()] = {
              muscle_group: item.muscle_group,
              current_sets: item.effective_sets ?? 0,
              mev: item.landmarks?.mev ?? item.mev ?? 0,
              mav: item.landmarks?.mav_high ?? item.mav ?? 10,
              mrv: item.landmarks?.mrv ?? item.mrv ?? 20,
              hypertrophy_units: item.hypertrophy_units,
              mav_low: item.landmarks?.mav_low,
              mav_high: item.landmarks?.mav_high,
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
    return () => { 
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (loading || muscleGroups.length === 0) return null;

  const uniqueGroups = [...new Set(muscleGroups.map(g => g.toLowerCase()))];

  return (
    <>
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
        const textColor = getCOLOR_MAP(c)[color];
        const bgColor = getBG_COLOR_MAP(c)[color];
        const displayName = group.charAt(0).toUpperCase() + group.slice(1);

        // WNS: show HU + local increment estimate, legacy: show sets
        // In WNS mode, each completed set at ~RIR 2 adds roughly 3 stim reps × diminishing factor
        const estimatedLocalHU = localIncrement > 0 ? localIncrement * 2.0 : 0;
        const label = isWNS && data.hypertrophy_units != null
          ? `${displayName}: ${(data.hypertrophy_units + estimatedLocalHU).toFixed(1)} HU`
          : `${displayName}: ${totalSets}/${data.mav > 0 ? data.mav : 1} sets`;

        return (
          <View key={group} style={[styles.pill, { backgroundColor: bgColor }]}>
            <Text style={[styles.pillText, { color: textColor }]}>
              {label}
            </Text>
          </View>
        );
      })}
      {isWNS && (
        <TouchableOpacity
          onPress={() => setExplainerVisible(true)}
          style={styles.infoButton}
          accessibilityLabel="How Hypertrophy Units work"
          accessibilityRole="button"
        >
          <Text style={[styles.infoIcon, { color: c.text.muted }]}>ⓘ</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    <HUExplainerSheet visible={explainerVisible} onClose={() => setExplainerVisible(false)} />
    </>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
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
  infoButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },
  infoIcon: {
    fontSize: typography.size.base,
    color: c.text.muted,
  },
});
