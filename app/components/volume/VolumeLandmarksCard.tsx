/**
 * VolumeLandmarksCard — Combines VolumeBar + VolumeTrendChart + status badge + info icons.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { VolumeBar } from './VolumeBar';
import { VolumeTrendChart } from './VolumeTrendChart';
import { LandmarkExplainer, type LandmarkKey } from './LandmarkExplainer';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import type { WNSLandmarks } from '../../types/volume';
import type { VolumeTrendPoint } from '../../types/analytics';

export interface VolumeLandmarksCardProps {
  muscleGroup: string;
  currentVolume: number;
  landmarks: WNSLandmarks;
  trend: VolumeTrendPoint[];
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'above_mrv';
}

function useStatusConfig() {
  const c = useThemeColors();
  return {
    below_mev: { label: 'Below MEV', color: c.text.muted, bg: c.bg.surfaceRaised },
    optimal: { label: 'Optimal', color: c.semantic.positive, bg: c.semantic.positiveSubtle },
    approaching_mrv: { label: 'Near MRV', color: c.semantic.caution, bg: c.semantic.cautionSubtle },
    above_mrv: { label: 'Above MRV', color: c.semantic.negative, bg: c.semantic.negativeSubtle },
  } as Record<string, { label: string; color: string; bg: string }>;
}

const LANDMARK_KEYS: LandmarkKey[] = ['mev', 'mav', 'mrv'];

export function VolumeLandmarksCard({
  muscleGroup,
  currentVolume,
  landmarks,
  trend,
  status,
}: VolumeLandmarksCardProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [expanded, setExpanded] = useState(false);
  const [explainerLandmark, setExplainerLandmark] = useState<LandmarkKey | null>(null);
  const STATUS_CONFIG = useStatusConfig();

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.below_mev;
  const displayName = muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1);

  return (
    <Card variant="flat" style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text.primary }]}>{displayName}</Text>
        <View
          style={[styles.badge, { backgroundColor: statusCfg.bg }]}
          accessibilityLabel={`Status: ${statusCfg.label}`}
        >
          <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Volume bar */}
      <VolumeBar landmarks={landmarks} currentVolume={currentVolume} muscleGroup={displayName} />

      {/* Current volume + info icons */}
      <View style={styles.infoRow}>
        <Text style={[styles.volumeText, { color: c.text.secondary }]}>
          {currentVolume} HU this week
        </Text>
        <View style={styles.infoIcons}>
          {LANDMARK_KEYS.map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setExplainerLandmark(key)}
              hitSlop={8}
              accessibilityLabel={`Learn about ${key.toUpperCase()}`}
              accessibilityRole="button"
            >
              <Text style={[styles.infoIcon, { color: c.text.muted }]}>{key.toUpperCase()} ⓘ</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Expandable trend chart */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.expandToggle}
        accessibilityLabel={expanded ? 'Hide trend chart' : 'Show trend chart'}
        accessibilityRole="button"
      >
        <Text style={[styles.expandText, { color: c.accent.primary }]}>
          {expanded ? '▾ Hide Trend' : '▸ Show Trend'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <VolumeTrendChart trend={trend} landmarks={landmarks} />
      )}

      {/* Landmark explainer modal */}
      {explainerLandmark && (
        <LandmarkExplainer
          landmark={explainerLandmark}
          visible={!!explainerLandmark}
          onClose={() => setExplainerLandmark(null)}
        />
      )}
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  volumeText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  infoIcons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  infoIcon: {
    color: c.text.muted,
    fontSize: typography.size.xs - 1,
    fontWeight: typography.weight.medium,
  },
  expandToggle: {
    marginTop: spacing[3],
    paddingVertical: spacing[1],
  },
  expandText: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
