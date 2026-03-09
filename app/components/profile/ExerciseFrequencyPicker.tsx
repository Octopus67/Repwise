import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

const COUNTS = [1, 2, 3, 4, 5, 6, 7];

export function ExerciseFrequencyPicker({ value, onChange }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sessions per week</Text>
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
              accessibilityLabel={`${n} sessions per week`}
            >
              <Text style={[styles.text, active && styles.textActive]}>
                {n === 7 ? '7+' : String(n)}
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
  row: { flexDirection: 'row', gap: spacing[2] },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  text: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.base,
  },
  textActive: { color: c.accent.primary },
});
