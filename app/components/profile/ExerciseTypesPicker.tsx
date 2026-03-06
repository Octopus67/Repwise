import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';

const TYPES = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'sports', label: 'Sports' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'walking', label: 'Walking' },
] as const;

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export function ExerciseTypesPicker({ value, onChange }: Props) {
  const toggle = (type: string) => {
    onChange(
      value.includes(type) ? value.filter((t) => t !== type) : [...value, type],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Exercise types</Text>
      <View style={styles.row}>
        {TYPES.map((t) => {
          const active = value.includes(t.value);
          return (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(t.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing[3] },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[2],
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  chipTextActive: {
    color: colors.accent.primary,
    fontWeight: typography.weight.semibold,
  },
});
