import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { getWeekDates, formatDayCell } from '../../utils/dateScrollerLogic';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DateScrollerProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  loggedDates: Set<string>;
}

export function DateScroller({ selectedDate, onDateSelect, loggedDates }: DateScrollerProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const getReferenceDate = useCallback(
    (offset: number): string => {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() + offset * 7);
      return d.toISOString().split('T')[0];
    },
    [selectedDate],
  );

  const today = new Date().toISOString().split('T')[0];

  // Generate 3 weeks: previous, current, next for smooth swiping
  const weeks = [-1, 0, 1].map((rel) => {
    const ref = getReferenceDate(weekOffset + rel);
    return getWeekDates(ref);
  });

  const handleScrollEnd = useCallback(
    (e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / SCREEN_WIDTH);
      if (page === 0) {
        setWeekOffset((prev) => prev - 1);
        scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
      } else if (page === 2) {
        setWeekOffset((prev) => prev + 1);
        scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
      }
    },
    [],
  );

  const isToday = selectedDate === today;

  return (
    <View style={styles.container}>
      {!isToday && (
        <TouchableOpacity
          onPress={() => { setWeekOffset(0); onDateSelect(today); }}
          style={styles.todayPill}
          activeOpacity={0.7}
        >
          <Text style={styles.todayPillText}>↩ Today</Text>
        </TouchableOpacity>
      )}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
      >
        {weeks.map((week, wi) => (
          <View key={`week-${wi}`} style={[styles.weekRow, { width: SCREEN_WIDTH }]}>
            {week.map((dateStr) => {
              const cell = formatDayCell(dateStr);
              const isSelected = dateStr === selectedDate;
              const isLogged = loggedDates.has(dateStr);
              const isToday = dateStr === today;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isToday && styles.dayCellToday,
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => onDateSelect(dateStr)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayName, isToday && styles.dayNameToday, isSelected && styles.dayNameSelected]}>
                    {cell.dayName}
                  </Text>
                  <Text style={[styles.dayNumber, isToday && styles.dayNumberToday, isSelected && styles.dayNumberSelected]}>
                    {cell.dayNumber}
                  </Text>
                  {isToday && !isLogged && <View style={[styles.todayDot, isSelected && styles.dotSelected]} />}
                  {isLogged && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}


const CELL_SIZE = (SCREEN_WIDTH - spacing[4] * 2) / 7;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
  },
  dayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: colors.accent.primaryMuted,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.border.hover,
  },
  dayName: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[0.5],
    lineHeight: typography.lineHeight.xs,
  },
  dayNameSelected: {
    color: colors.accent.primary,
  },
  dayNameToday: {
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  dayNumber: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
  },
  dayNumberSelected: {
    color: colors.accent.primary,
  },
  dayNumberToday: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.text.muted,
    marginTop: spacing[1],
  },
  dotSelected: {
    backgroundColor: colors.accent.primary,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent.primary,
    marginTop: spacing[1],
  },
  todayPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: colors.accent.primaryMuted,
    marginBottom: spacing[2],
  },
  todayPillText: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
