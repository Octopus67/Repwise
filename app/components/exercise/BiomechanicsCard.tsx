import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface Props {
  strength_curve?: string | null;
  loading_position?: string | null;
  stretch_hypertrophy_potential?: string | null;
  stimulus_to_fatigue?: string | null;
  fatigue_rating?: string | null;
}

const COLOR_MAP: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  excellent: 'green', high: 'green',
  good: 'yellow', moderate: 'yellow',
  poor: 'red', low: 'red',
  none: 'gray', uncertain: 'gray',
};

function badgeColor(value: string, c: ThemeColors) {
  const key = COLOR_MAP[value];
  if (key === 'green') return { bg: c.semantic.positiveSubtle, fg: c.semantic.positive };
  if (key === 'yellow') return { bg: c.semantic.warningSubtle, fg: c.semantic.warning };
  if (key === 'red') return { bg: c.semantic.negativeSubtle, fg: c.semantic.negative };
  return { bg: c.bg.surfaceRaised, fg: c.text.muted };
}

function Badge({ label, value, c }: { label: string; value: string; c: ThemeColors }) {
  const display = value.replace(/_/g, ' ');
  const { bg, fg } = badgeColor(value, c);
  return (
    <View style={styles.item}>
      <Text style={[styles.label, { color: c.text.muted }]}>{label}</Text>
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: fg }]}>{display}</Text>
      </View>
    </View>
  );
}

export function BiomechanicsCard({ strength_curve, loading_position, stretch_hypertrophy_potential, stimulus_to_fatigue, fatigue_rating }: Props) {
  const c = useThemeColors();
  const entries: { label: string; value: string }[] = [];
  if (strength_curve) entries.push({ label: 'Strength Curve', value: strength_curve });
  if (loading_position) entries.push({ label: 'Loading Position', value: loading_position });
  if (stretch_hypertrophy_potential) entries.push({ label: 'Stretch Potential', value: stretch_hypertrophy_potential });
  if (stimulus_to_fatigue) entries.push({ label: 'Stimulus:Fatigue', value: stimulus_to_fatigue });
  if (fatigue_rating) entries.push({ label: 'Fatigue Rating', value: fatigue_rating });

  if (entries.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: c.bg.surface }]}>
      <Text style={[styles.title, { color: c.text.primary }]}>Biomechanics</Text>
      <View style={styles.grid}>
        {entries.map((e) => <Badge key={e.label} label={e.label} value={e.value} c={c} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: spacing[4] },
  title: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, marginBottom: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  item: { width: '47%' },
  label: { fontSize: typography.size.xs, marginBottom: 4 },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
});
