import React, { useState } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { Exercise } from '../../types/exercise';
import { getMuscleGroupConfig } from '../../config/muscleGroups';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { MuscleGroupIcon } from './MuscleGroupIcon';

interface ExerciseCardProps {
  exercise: Exercise;
  onPress: (exercise: Exercise) => void;
  onLongPress?: (exercise: Exercise) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ExerciseCard({ exercise, onPress, onLongPress }: ExerciseCardProps) {
  const config = getMuscleGroupConfig(exercise.muscle_group);
  const bgColor = config?.color ?? '#2563EB';
  const [imgError, setImgError] = useState(false);

  const showImage = exercise.image_url != null && exercise.image_url !== '' && !imgError;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(exercise)}
      onLongPress={onLongPress ? () => onLongPress(exercise) : undefined}
      activeOpacity={0.7}
      accessibilityLabel={`${exercise.name}, ${exercise.equipment}, ${exercise.category}`}
      accessibilityRole="button"
    >
      {showImage ? (
        <Image
          source={{ uri: exercise.image_url! }}
          style={styles.image}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.abbrevCircle, { backgroundColor: hexToRgba(bgColor, 0.15) }]}>
          <MuscleGroupIcon muscleGroup={exercise.muscle_group} size={20} color={bgColor} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{exercise.name}</Text>
        <View style={styles.tagRow}>
          <View style={styles.equipmentTag}>
            <Text style={styles.tagText}>{exercise.equipment.replace('_', ' ')}</Text>
          </View>
          <View style={[styles.categoryTag, exercise.category === 'isolation' && styles.isolationTag]}>
            <Text style={styles.tagText}>{exercise.category}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  abbrevCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  info: {
    flex: 1,
    marginLeft: spacing[3],
  },
  name: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing[1],
    marginTop: 4,
  },
  equipmentTag: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  categoryTag: {
    backgroundColor: colors.semantic.positiveSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  isolationTag: {
    backgroundColor: colors.semantic.warningSubtle,
  },
  tagText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
  chevron: {
    color: colors.text.muted,
    fontSize: typography.size.xl,
    marginLeft: spacing[2],
  },
});
