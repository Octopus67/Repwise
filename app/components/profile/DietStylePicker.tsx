import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

const STYLES = [
  { value: 'balanced', title: 'Balanced', desc: 'Even split of carbs and fats' },
  { value: 'high_protein', title: 'Performance', desc: 'Higher carbs for training energy' },
  { value: 'low_carb', title: 'Low Carb', desc: 'Mostly fats, fewer carbs' },
  { value: 'keto', title: 'Keto', desc: 'Very low carb, high fat' },
] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function DietStylePicker({ value, onChange }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Diet style</Text>
      {STYLES.map((s) => {
        const active = value === s.value;
        return (
          <TouchableOpacity
            key={s.value}
            style={[styles.card, active && styles.cardActive]}
            onPress={() => onChange(s.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.title, active && styles.titleActive]}>{s.title}</Text>
            <Text style={styles.desc}>{s.desc}</Text>
          </TouchableOpacity>
        );
      })}
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
  card: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  cardActive: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  titleActive: { color: c.accent.primary },
  desc: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[0.5],
  },
});
