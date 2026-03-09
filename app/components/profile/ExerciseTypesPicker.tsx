import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { marginBottom: spacing[3] },
  label: {
    color: c.text.muted,
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
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  chipText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  chipTextActive: {
    color: c.accent.primary,
    fontWeight: typography.weight.semibold,
  },
});
