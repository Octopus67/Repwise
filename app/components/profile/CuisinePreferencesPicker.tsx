import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

const CUISINES = [
  { code: 'IN', label: 'Indian', value: 'indian' },
  { code: 'MED', label: 'Mediterranean', value: 'mediterranean' },
  { code: 'EA', label: 'East Asian', value: 'east_asian' },
  { code: 'LA', label: 'Latin American', value: 'latin_american' },
  { code: 'US', label: 'American', value: 'american' },
  { code: 'EU', label: 'European', value: 'european' },
  { code: 'SEA', label: 'SE Asian', value: 'southeast_asian' },
] as const;

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export function CuisinePreferencesPicker({ value, onChange }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const toggle = (item: string) => {
    onChange(
      value.includes(item) ? value.filter((v) => v !== item) : [...value, item],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Cuisine preferences</Text>
      <View style={styles.row}>
        {CUISINES.map((c) => {
          const active = value.includes(c.value);
          return (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(c.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{c.code}</Text>
              </View>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.label}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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
  badge: {
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[1],
    paddingVertical: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeText: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
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
