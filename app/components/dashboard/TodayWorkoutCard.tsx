import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import type { TrainingSessionResponse } from '../../types/training';

interface TodayWorkoutCardProps {
  sessions: TrainingSessionResponse[];
  isWorkoutActive: boolean;
  activeExerciseCount: number;
  onPress: (sessionId: string) => void;
  onResume: () => void;
  onStartWorkout: () => void;
}

function TodayWorkoutCardComponent({ 
  sessions, 
  isWorkoutActive, 
  activeExerciseCount,
  onPress, 
  onResume, 
  onStartWorkout 
}: TodayWorkoutCardProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  
  // Show resume banner if workout is active
  if (isWorkoutActive) {
    return (
      <Card variant="flat" style={styles.card}>
        <TouchableOpacity onPress={onResume} activeOpacity={0.7} style={styles.resumeBanner} accessibilityLabel={`Resume workout with ${activeExerciseCount} exercises`} accessibilityRole="button">
          <View style={styles.resumeContent}>
            <Icon name="dumbbell" size={20} color={c.accent.primary} />
            <View style={styles.resumeText}>
              <Text style={styles.resumeTitle}>Workout in progress</Text>
              <Text style={styles.resumeSubtitle}>{activeExerciseCount} exercises</Text>
            </View>
          </View>
          <Text style={styles.resumeButton}>Resume</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  // Show today's completed workouts
  if (sessions.length > 0) {
    return (
      <Card variant="flat" style={styles.card}>
        <View style={styles.header}>
          <Icon name="dumbbell" size={16} color={c.accent.primary} />
          <Text style={styles.title}>Today's Training</Text>
        </View>
        
        {sessions.map((session, index) => {
          const duration = session.start_time && session.end_time 
            ? Math.round((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60))
            : null;
          
          const exercises = session.exercises || [];
          const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
          const totalVolume = exercises.reduce((sum, ex) => 
            sum + (ex.sets?.reduce((setSum, set) => setSum + (set.weight_kg * set.reps), 0) || 0), 0
          );

          return (
            <TouchableOpacity 
              key={session.id} 
              onPress={() => onPress(session.id)}
              activeOpacity={0.7}
              accessibilityLabel={`View workout details${duration ? `, ${duration} minutes` : ''}`}
              accessibilityRole="button"
              style={[styles.sessionContainer, index > 0 && styles.sessionBorder]}
            >
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionName} numberOfLines={1} ellipsizeMode="tail">
                  Workout {duration ? `· ${duration} min` : ''}
                </Text>
              </View>
              
              <View style={styles.exerciseList}>
                {exercises.slice(0, 4).map((exercise, i) => {
                  const firstSet = exercise.sets?.[0];
                  return (
                    <Text key={i} style={styles.exerciseText} numberOfLines={1} ellipsizeMode="tail">
                      {exercise.exercise_name} · {exercise.sets?.length || 0}×
                      {firstSet ? `${firstSet.weight_kg}kg × ${firstSet.reps}` : ''}
                    </Text>
                  );
                })}
                {exercises.length > 4 && (
                  <Text style={styles.moreText}>+{exercises.length - 4} more</Text>
                )}
              </View>
              
              <View style={styles.sessionStats}>
                <Text style={styles.statText}>{totalSets} sets</Text>
                <Text style={styles.statText}>{Math.round(totalVolume)}kg volume</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>
    );
  }

  // Empty state - no workouts today
  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.header}>
        <Icon name="dumbbell" size={16} color={c.text.muted} />
        <Text style={styles.title}>Today's Training</Text>
      </View>
      <Text style={styles.emptyText}>No workout yet today</Text>
      <TouchableOpacity onPress={onStartWorkout} style={styles.startButton} activeOpacity={0.7} accessibilityLabel="Start a new workout" accessibilityRole="button">
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
  },
  resumeBanner: {
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.sm,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resumeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  resumeText: {
    flex: 1,
  },
  resumeTitle: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  resumeSubtitle: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  resumeButton: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  sessionContainer: {
    paddingVertical: spacing[2],
  },
  sessionBorder: {
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
    marginTop: spacing[2],
    paddingTop: spacing[3],
  },
  sessionHeader: {
    marginBottom: spacing[2],
  },
  sessionName: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  exerciseList: {
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  exerciseText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  moreText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  statText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  emptyText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginBottom: spacing[3],
  },
  startButton: {
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    alignSelf: 'flex-start',
  },
  startButtonText: {
    color: c.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});

export const TodayWorkoutCard = React.memo(TodayWorkoutCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.sessions.length === nextProps.sessions.length &&
    prevProps.sessions.every((s, i) => s.id === nextProps.sessions[i]?.id) &&
    prevProps.isWorkoutActive === nextProps.isWorkoutActive &&
    prevProps.activeExerciseCount === nextProps.activeExerciseCount &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onResume === nextProps.onResume &&
    prevProps.onStartWorkout === nextProps.onStartWorkout
  );
});