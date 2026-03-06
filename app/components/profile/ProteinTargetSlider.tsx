import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';

const MIN = 1.2;
const MAX = 3.0;
const STEP = 0.1;

interface Props {
  value: number;
  weightKg: number;
  onChange: (v: number) => void;
}

export function ProteinTargetSlider({ value, weightKg, onChange }: Props) {
  const dailyGrams = Math.round(value * weightKg);
  const canDecrease = value > MIN + 0.01;
  const canIncrease = value < MAX - 0.01;

  const adjust = (delta: number) => {
    const next = Math.round((value + delta) * 10) / 10;
    if (next >= MIN && next <= MAX) onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Protein target</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, !canDecrease && styles.btnDisabled]}
          onPress={() => adjust(-STEP)}
          disabled={!canDecrease}
          activeOpacity={0.7}
          accessibilityLabel="Decrease protein"
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, !canDecrease && styles.btnTextDisabled]}>−</Text>
        </TouchableOpacity>
        <View style={styles.display}>
          <Text style={styles.valueText}>{value.toFixed(1)} g/kg</Text>
          <Text style={styles.dailyText}>{dailyGrams}g/day</Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, !canIncrease && styles.btnDisabled]}
          onPress={() => adjust(STEP)}
          disabled={!canIncrease}
          activeOpacity={0.7}
          accessibilityLabel="Increase protein"
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, !canIncrease && styles.btnTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.range}>
        <Text style={styles.rangeText}>{MIN} g/kg</Text>
        <Text style={styles.rangeText}>{MAX} g/kg</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: {
    color: colors.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xl,
  },
  btnTextDisabled: { color: colors.text.muted },
  display: { alignItems: 'center' },
  valueText: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.lg,
  },
  dailyText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.xs,
  },
  range: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  rangeText: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
});
