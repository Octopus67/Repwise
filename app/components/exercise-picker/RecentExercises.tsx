import React from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Exercise } from '../../types/exercise';
import { getMuscleGroupConfig } from '../../config/muscleGroups';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { MuscleGroupIcon } from './MuscleGroupIcon';

interface RecentExercisesProps {
  exercises: Exercise[];
  onPress: (exercise: Exercise) => void;
}

export function RecentExercises({ exercises, onPress }: RecentExercisesProps) {
  if (exercises.length === 0) return null;

  const renderItem = ({ item }: { item: Exercise }) => {
    const config = getMuscleGroupConfig(item.muscle_group);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
        accessibilityLabel={`Recent: ${item.name}`}
        accessibilityRole="button"
      >
        <View style={[styles.abbrevCircle, { backgroundColor: config?.color ?? '#2563EB' }]}>
          <MuscleGroupIcon muscleGroup={item.muscle_group} size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Recent</Text>
      <FlatList
        data={exercises}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing[2],
  },
  header: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  list: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  card: {
    width: 120,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[2],
    alignItems: 'center',
  },
  abbrevCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  name: {
    color: colors.text.primary,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },
});
