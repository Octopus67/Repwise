import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Icon } from '../common/Icon';
import { formatWeekRange, getAdjacentWeek, isCurrentOrFutureWeek } from '../../utils/muscleVolumeLogic';

interface WeekNavigatorProps {
  currentWeekStart: string;
  onWeekChange: (weekStart: string) => void;
  disableNext?: boolean;
}

export function WeekNavigator({ currentWeekStart, onWeekChange, disableNext }: WeekNavigatorProps) {
  const nextDisabled = disableNext ?? isCurrentOrFutureWeek(currentWeekStart);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => onWeekChange(getAdjacentWeek(currentWeekStart, 'prev'))}
        hitSlop={8}
        style={styles.arrow}
      >
        <Icon name="chevron-left" size={20} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.label}>{formatWeekRange(currentWeekStart)}</Text>
      <TouchableOpacity
        onPress={() => !nextDisabled && onWeekChange(getAdjacentWeek(currentWeekStart, 'next'))}
        hitSlop={8}
        style={styles.arrow}
        disabled={nextDisabled}
      >
        <Icon
          name="chevron-right"
          size={20}
          color={nextDisabled ? colors.text.muted : colors.text.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  arrow: { padding: spacing[2] },
  label: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
