import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';

const COUNTS = [2, 3, 4, 5, 6];

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export function MealFrequencyStepper({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Meals per day</Text>
      <View style={styles.row}>
        {COUNTS.map((n) => {
          const active = value === n;
          return (
            <TouchableOpacity
              key={n}
              style={[styles.btn, active && styles.btnActive]}
              onPress={() => onChange(n)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${n} meals per day`}
            >
              <Text style={[styles.text, active && styles.textActive]}>{n}</Text>
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
  row: { flexDirection: 'row', gap: spacing[2] },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surfaceRaised,
  },
  btnActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  text: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.md,
  },
  textActive: {
    color: colors.accent.primary,
    fontWeight: typography.weight.semibold,
  },
});
