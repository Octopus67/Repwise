import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface WaterTrackerProps {
  glasses: number;
  onIncrement: () => void;
  onDecrement: () => void;
  maxGlasses?: number;
}

export function WaterTracker({
  glasses,
  onIncrement,
  onDecrement,
  maxGlasses = 12,
}: WaterTrackerProps) {
  const icons = Array.from({ length: maxGlasses }, (_, i) => i < glasses);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Water Intake</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.glassRow}
        contentContainerStyle={styles.glassRowContent}
      >
        {icons.map((filled, i) => (
          <TouchableOpacity
            key={i}
            onPress={filled ? onDecrement : onIncrement}
            style={styles.glassBtn}
            activeOpacity={0.7}
          >
            {filled ? <Icon name="droplet-filled" size={20} color={colors.accent.primary} /> : <Icon name="droplet-empty" size={20} color={colors.text.muted} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.summary}>
        {glasses} glasses ({glasses * 250}ml)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[1],
  },
  glassRow: {
    maxHeight: 48,
  },
  glassRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  glassBtn: {
    padding: spacing[1],
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassIcon: {},
  summary: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[1],
  },
});
