import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { getReadinessColor } from '../../utils/readinessScoreLogic';

interface RecoveryFactor {
  name: string;
  value: number;
  source: string;
}

interface Props {
  score: number;
  volumeMultiplier: number;
  label: string;
  factors: RecoveryFactor[];
  onPress: () => void;
}

export function RecoveryInsightCard({ score, volumeMultiplier, label, factors, onPress }: Props) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const color = getReadinessColor(score);
  const topFactors = factors.slice(0, 3);

  return (
    <TouchableOpacity style={[s.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.7}
      accessibilityRole="button" accessibilityLabel={`Recovery ${score} out of 100, ${label}`}>
      <View style={s.headerRow}>
        <Text style={[s.scoreText, { color }]}>{score}</Text>
        <View style={s.labelCol}>
          <Text style={[s.label, { color: c.text.primary }]}>{label}</Text>
          <Text style={[s.volume, { color: c.text.muted }]}>Volume: {volumeMultiplier.toFixed(1)}×</Text>
        </View>
      </View>
      {topFactors.length > 0 && (
        <View style={s.factorsRow}>
          {topFactors.map((f) => (
            <View key={f.name} style={[s.factorChip, { backgroundColor: c.bg.surfaceRaised }]}>
              <Text style={[s.factorText, { color: c.text.secondary }]}>
                {f.name.replace(/_/g, ' ')} {Math.round(f.value)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.surface, borderRadius: radius.sm, padding: spacing[3],
    marginTop: spacing[3], borderLeftWidth: 4, borderWidth: 1, borderColor: c.border.subtle,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  scoreText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  labelCol: { flex: 1 },
  label: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  volume: { fontSize: typography.size.xs, marginTop: 2 },
  factorsRow: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[2], flexWrap: 'wrap' },
  factorChip: { borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: spacing[2] },
  factorText: { fontSize: typography.size.xs },
});
