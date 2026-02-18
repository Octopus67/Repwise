import React, { useMemo } from 'react';
import { FlatList, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MUSCLE_GROUP_CONFIG, type MuscleGroupConfig } from '../../config/muscleGroups';
import { Exercise } from '../../types/exercise';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { MuscleGroupIcon } from './MuscleGroupIcon';

interface MuscleGroupGridProps {
  exercises: Exercise[];
  onSelectMuscleGroup: (key: string) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function MuscleGroupGrid({ exercises, onSelectMuscleGroup }: MuscleGroupGridProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ex of exercises) {
      map[ex.muscle_group] = (map[ex.muscle_group] || 0) + 1;
    }
    return map;
  }, [exercises]);

  const renderTile = ({ item }: { item: MuscleGroupConfig }) => {
    const count = counts[item.key] || 0;
    return (
      <TouchableOpacity
        style={[styles.tile, { backgroundColor: hexToRgba(item.color, 0.15) }]}
        onPress={() => onSelectMuscleGroup(item.key)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.label} - ${count} exercises`}
      >
        <View style={[styles.abbrevCircle, { backgroundColor: item.color }]}>
          <MuscleGroupIcon muscleGroup={item.key} size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.count}>{count} exercises</Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={MUSCLE_GROUP_CONFIG}
      renderItem={renderTile}
      keyExtractor={(item) => item.key}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  row: {
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  tile: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
  },
  abbrevCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  label: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.semibold,
  },
  count: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: 2,
  },
});
