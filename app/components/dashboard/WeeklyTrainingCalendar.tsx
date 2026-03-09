import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { getWeekDates, formatDayCell } from '../../utils/dateScrollerLogic';
import { Icon } from '../common/Icon';

interface WeeklyTrainingCalendarProps {
  selectedDate: string;
  trainedDates: Set<string>;
}

export function WeeklyTrainingCalendar({ selectedDate, trainedDates }: WeeklyTrainingCalendarProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const weekDates = getWeekDates(selectedDate);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <View style={styles.weekRow}>
        {weekDates.map((dateStr) => {
          const cell = formatDayCell(dateStr);
          const isTrained = trainedDates.has(dateStr);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;

          return (
            <View
              key={dateStr}
              testID={`day-circle-${dateStr}`}
              style={[
                styles.dayCircle,
                isTrained && styles.dayCircleTrained,
                isToday && styles.dayCircleToday,
                isFuture && styles.dayCircleFuture,
              ]}
            >
              <Text
                style={[
                  styles.dayLetter,
                  isTrained && styles.dayLetterTrained,
                  isToday && styles.dayLetterToday,
                  isFuture && styles.dayLetterFuture,
                ]}
              >
                {cell.dayName[0]}
              </Text>
              {isTrained && (
                <View style={styles.checkIcon}>
                  <Icon
                    name="check"
                    size={12}
                    color={c.bg.base}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 40;

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginVertical: spacing[3],
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
  },
  dayCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border.subtle,
    backgroundColor: 'transparent',
  },
  dayCircleTrained: {
    backgroundColor: c.accent.primary,
    borderColor: c.accent.primary,
  },
  dayCircleToday: {
    borderColor: c.accent.primary,
    borderWidth: 2,
  },
  dayCircleFuture: {
    opacity: 0.4,
  },
  dayLetter: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: c.text.secondary,
    lineHeight: typography.lineHeight.sm,
  },
  dayLetterTrained: {
    color: c.bg.base,
    fontWeight: typography.weight.semibold,
  },
  dayLetterToday: {
    color: c.accent.primary,
    fontWeight: typography.weight.semibold,
  },
  dayLetterFuture: {
    color: c.text.muted,
  },
  checkIcon: {
    position: 'absolute',
  },
});