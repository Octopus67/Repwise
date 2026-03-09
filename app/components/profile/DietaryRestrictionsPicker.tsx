import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

const OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'no_restrictions', label: 'No restrictions' },
] as const;

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export function DietaryRestrictionsPicker({ value, onChange }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const toggle = (item: string) => {
    onChange(
      value.includes(item) ? value.filter((v) => v !== item) : [...value, item],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Dietary restrictions</Text>
      <View style={styles.row}>
        {OPTIONS.map((o) => {
          const active = value.includes(o.value);
          return (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(o.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {o.label}
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
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.bg.surfaceRaised,
  },
  chipActive: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  chipText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  chipTextActive: {
    color: c.accent.primary,
    fontWeight: typography.weight.medium,
  },
});
