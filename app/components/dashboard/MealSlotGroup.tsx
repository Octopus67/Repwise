import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { MealSlotData, MealSlotName } from '../../utils/mealSlotLogic';
import { formatEntryTime, sortEntriesChronologically } from '../../utils/timestampFormat';

interface MealSlotGroupProps {
  slot: MealSlotData;
  onAddToSlot: (slotName: MealSlotName) => void;
}

export function MealSlotGroup({ slot, onAddToSlot }: MealSlotGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const hasEntries = slot.entries.length > 0;
  const sorted = hasEntries ? sortEntriesChronologically(slot.entries) : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => hasEntries && setExpanded(!expanded)}
        activeOpacity={hasEntries ? 0.7 : 1}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.slotName}>{slot.name}</Text>
          {hasEntries && (
            <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
          )}
        </View>
        <Text style={styles.slotCalories}>
          {Math.round(slot.totals.calories)} kcal
        </Text>
      </TouchableOpacity>

      {/* Body */}
      {hasEntries && expanded && (
        <View style={styles.body}>
          {sorted.map((entry) => {
            const time = formatEntryTime(entry.created_at);
            return (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName} numberOfLines={1}>
                    {entry.meal_name}
                  </Text>
                  {time !== '' && (
                    <Text style={styles.entryTime}>{time}</Text>
                  )}
                </View>
                <Text style={styles.entryCal}>{Math.round(entry.calories)} kcal</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Empty slot */}
      {!hasEntries && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onAddToSlot(slot.name)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  slotName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  chevron: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
  },
  slotCalories: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  body: {
    paddingLeft: spacing[3],
    paddingTop: spacing[1],
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  entryInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  entryName: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  entryTime: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  entryCal: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  addButtonText: {
    fontSize: typography.size.lg,
    color: colors.accent.primary,
    fontWeight: typography.weight.bold,
  },
});
