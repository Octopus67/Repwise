import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

interface WaterTrackerProps {
  glasses: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function WaterTracker({ glasses, onIncrement, onDecrement }: WaterTrackerProps) {
  const c = useThemeColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.text.secondary }]}>Water (glasses)</Text>
      <View style={styles.controls}>
        <TouchableOpacity onPress={onDecrement} style={[styles.btn, { backgroundColor: c.bg.surfaceRaised }]} accessibilityLabel="Decrease water" accessibilityRole="button">
          <Text style={[styles.btnText, { color: c.text.primary }]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.value, { color: c.text.primary }]}>{glasses}</Text>
        <TouchableOpacity onPress={onIncrement} style={[styles.btn, { backgroundColor: c.bg.surfaceRaised }]} accessibilityLabel="Increase water" accessibilityRole="button">
          <Text style={[styles.btnText, { color: c.text.primary }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  label: { fontSize: typography.size.base, fontWeight: typography.weight.medium },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  btn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  value: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, minWidth: 24, textAlign: 'center' },
});
