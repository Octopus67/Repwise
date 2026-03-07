/**
 * WorkoutSummaryScreen — Post-workout celebration and summary
 *
 * Shows after finishing a workout, before returning to dashboard.
 * Displays workout stats, exercise breakdown, and personal records.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, spacing, typography, radius, shadows } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatDuration } from '../../utils/durationFormat';
import type { PersonalRecordResponse } from '../../types/training';
import type { WorkoutSummaryResult } from '../../utils/workoutSummary';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkoutSummaryScreenParams {
  summary: WorkoutSummaryResult;
  duration: number; // seconds
  personalRecords: PersonalRecordResponse[];
  exerciseBreakdown: Array<{
    exerciseName: string;
    setsCompleted: number;
    bestSet: { weight: string; reps: string } | null;
  }>;
}

interface WorkoutSummaryScreenProps {
  route: { params: WorkoutSummaryScreenParams };
  navigation: any;
}

// ─── Components ──────────────────────────────────────────────────────────────

function CheckmarkIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke={colors.semantic.positive}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
      <Text style={[styles.statValue, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function WorkoutSummaryScreen({ route, navigation }: WorkoutSummaryScreenProps) {
  const c = useThemeColors();
  const { summary, duration, personalRecords, exerciseBreakdown } = route.params;

  const handleDone = () => {
    navigation.navigate('DashboardHome');
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${Math.round(kg)}kg`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg.base }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <CheckmarkIcon />
          <Text style={[styles.title, { color: c.text.primary }]}>Workout Complete</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Duration" value={formatDuration(duration)} />
          <StatCard label="Exercises" value={summary.exerciseCount.toString()} />
          <StatCard label="Sets" value={summary.setCount.toString()} />
          <StatCard label="Volume" value={formatVolume(summary.totalVolumeKg)} />
        </View>

        {/* Exercise Breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Exercise Breakdown</Text>
          <View style={[styles.sectionContent, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}>
            {exerciseBreakdown.map((exercise, index) => (
              <View
                key={index}
                style={[
                  styles.exerciseItem,
                  index === exerciseBreakdown.length - 1 && styles.exerciseItemLast,
                ]}
              >
                <View style={styles.exerciseHeader}>
                  <Text style={[styles.exerciseName, { color: c.text.primary }]}>{exercise.exerciseName}</Text>
                  <Text style={[styles.setsCount, { color: c.text.secondary }]}>{exercise.setsCompleted} sets</Text>
                </View>
                {exercise.bestSet && (
                  <Text style={[styles.bestSet, { color: c.text.muted }]}>
                    Best: {exercise.bestSet.weight}kg × {exercise.bestSet.reps}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Personal Records */}
        {personalRecords.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Personal Records</Text>
            <View style={[styles.sectionContent, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}>
              {personalRecords.map((pr, index) => (
                <View
                  key={index}
                  style={[
                    styles.prItem,
                    index === personalRecords.length - 1 && styles.prItemLast,
                  ]}
                >
                  <View style={styles.prHeader}>
                    <Text style={[styles.prExercise, { color: c.text.primary }]}>{pr.exercise_name}</Text>
                    <Text style={[styles.prImprovement, { color: c.accent.primary }]}>
                      {pr.previous_weight_kg
                        ? `+${(pr.new_weight_kg - pr.previous_weight_kg).toFixed(1)}kg`
                        : 'New PR!'}
                    </Text>
                  </View>
                  <Text style={[styles.prDetails, { color: c.text.secondary }]}>
                    {pr.new_weight_kg}kg × {pr.reps} reps
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Done Button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border.subtle }]}>
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: c.accent.primary }]}
          onPress={handleDone}
          accessibilityLabel="Done"
          accessibilityRole="button"
        >
          <Text style={[styles.doneButtonText, { color: c.text.primary }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    marginTop: spacing[3],
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginTop: spacing[1],
  },

  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[3],
  },
  sectionContent: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm,
  },

  exerciseItem: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  exerciseItemLast: {
    borderBottomWidth: 0,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  setsCount: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  bestSet: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontVariant: ['tabular-nums'],
  },

  prItem: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.accent.primaryMuted,
  },
  prItemLast: {
    borderBottomWidth: 0,
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  prExercise: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  prImprovement: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  prDetails: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontVariant: ['tabular-nums'],
  },

  bottomBar: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  doneButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    ...shadows.sm,
  },
  doneButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});