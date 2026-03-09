import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { formatWeekRange, getAdjacentWeek, isCurrentOrFutureWeek } from '../../utils/muscleVolumeLogic';

interface WeekNavigatorProps {
  currentWeekStart: string;
  onWeekChange: (weekStart: string) => void;
  disableNext?: boolean;
}

export function WeekNavigator({ currentWeekStart, onWeekChange, disableNext }: WeekNavigatorProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const nextDisabled = disableNext ?? isCurrentOrFutureWeek(currentWeekStart);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => onWeekChange(getAdjacentWeek(currentWeekStart, 'prev'))}
        hitSlop={8}
        style={styles.arrow}
      >
        <Icon name="chevron-left" size={20} color={c.text.primary} />
      </TouchableOpacity>
      <Text style={[styles.label, { color: c.text.primary }]}>{formatWeekRange(currentWeekStart)}</Text>
      <TouchableOpacity
        onPress={() => !nextDisabled && onWeekChange(getAdjacentWeek(currentWeekStart, 'next'))}
        hitSlop={8}
        style={styles.arrow}
        disabled={nextDisabled}
      >
        <Icon
          name="chevron-right"
          size={20}
          color={nextDisabled ? c.text.muted : c.text.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  arrow: { padding: spacing[2] },
  label: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
