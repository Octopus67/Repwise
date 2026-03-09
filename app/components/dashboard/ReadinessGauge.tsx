import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { clampScore, getReadinessColor, getReadinessLabel, safeNormalized } from '../../utils/readinessScoreLogic';

interface Factor {
  name: string;
  normalized: number;
  present: boolean;
}

interface Props {
  score: number | null;
  factors: Factor[];
  onPress: () => void;
}

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const CENTER = SIZE / 2;

export function ReadinessGauge({ score, factors, onPress }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  if (score === null || score === undefined || Number.isNaN(score)) {
    return (
      <TouchableOpacity style={[styles.container, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💤</Text>
          <Text style={[styles.emptyText, { color: c.accent.primary }]}>Tap to check in</Text>
          <Text style={[styles.emptySubtext, { color: c.text.muted }]}>Log your recovery</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const clamped = clampScore(score);
  const color = getReadinessColor(clamped);
  const label = getReadinessLabel(clamped);
  const fill = clamped / 100;
  const offset = CIRCUMFERENCE * (1 - fill);

  const presentFactors = (factors ?? []).filter((f) => f.present);

  return (
    <TouchableOpacity style={[styles.container, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.gaugeRow}>
        <View style={styles.gaugeWrapper}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={CENTER} cy={CENTER} r={R}
              stroke={c.bg.surfaceRaised}
              strokeWidth={STROKE} fill="none"
            />
            <Circle
              cx={CENTER} cy={CENTER} r={R}
              stroke={color}
              strokeWidth={STROKE} fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          </Svg>
          <View style={styles.scoreOverlay}>
            <Text style={[styles.scoreText, { color }]}>{clamped}</Text>
            <Text style={[styles.labelText, { color: c.text.secondary }]}>{label}</Text>
          </View>
        </View>

        {/* Factor breakdown */}
        {presentFactors.length > 0 && (
          <View style={styles.factorsColumn}>
            {presentFactors.map((f) => {
              const norm = safeNormalized(f.normalized);
              const pct = Math.round(norm * 100);
              return (
                <View key={f.name} style={styles.factorRow}>
                  <Text style={[styles.factorName, { color: c.text.secondary }]}>{formatFactorName(f.name)}</Text>
                  <View style={[styles.factorBar, { backgroundColor: c.bg.surfaceRaised }]}>
                    <View style={[styles.factorFill, { width: `${pct}%`, backgroundColor: getReadinessColor(pct) }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function formatFactorName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.bg.surface,
    borderRadius: 12,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  emptyIcon: { fontSize: 28, marginBottom: spacing[2] },
  emptyText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  emptySubtext: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    marginTop: spacing[1],
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  gaugeWrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
  },
  labelText: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
  },
  factorsColumn: {
    flex: 1,
    gap: spacing[2],
  },
  factorRow: {
    gap: 2,
  },
  factorName: {
    color: c.text.secondary,
    fontSize: 11,
  },
  factorBar: {
    height: 4,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: 2,
    overflow: 'hidden',
  },
  factorFill: {
    height: '100%',
    borderRadius: 2,
  },
});
