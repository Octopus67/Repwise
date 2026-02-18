import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, letterSpacing as ls } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import { useStore } from '../../store';
import { convertWeight } from '../../utils/unitConversion';
import { formatDuration } from '../../utils/durationFormat';
import { bestE1RMForExercise } from '../../utils/e1rmCalculator';
import { calculateSessionWorkingVolume } from './sessionDetailHelpers';
import api from '../../services/api';
import type { TrainingSessionResponse } from '../../types/training';
import type { Exercise } from '../../types/exercise';

interface SessionDetailViewProps {
  route: { params: { sessionId: string } };
  navigation: {
    goBack: () => void;
    push: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export function SessionDetailView({ route, navigation }: SessionDetailViewProps) {
  const { sessionId } = route.params;
  const unitSystem = useStore((s) => s.unitSystem);

  const [session, setSession] = useState<TrainingSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exerciseImages, setExerciseImages] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`training/sessions/${sessionId}`);
        if (!cancelled) setSession(res.data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.status === 404 ? 'Session not found' : 'Failed to load session');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSession();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Fetch exercise images for thumbnails
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function fetchExerciseImages() {
      try {
        const { data } = await api.get('training/exercises');
        if (!cancelled && Array.isArray(data)) {
          const imageMap: Record<string, string | null> = {};
          for (const ex of data as Exercise[]) {
            imageMap[ex.name] = ex.image_url ?? null;
          }
          setExerciseImages(imageMap);
        }
      } catch {
        // best-effort — images are optional
      }
    }
    fetchExerciseImages();
    return () => { cancelled = true; };
  }, [session]);

  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  // Duration calculation
  const durationSeconds = session?.start_time && session?.end_time
    ? Math.floor(
        (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 1000,
      )
    : null;

  // Working volume
  const workingVolume = session ? calculateSessionWorkingVolume(session, unitSystem) : 0;

  // PR lookup helper
  const isPRSet = (exerciseName: string, setIndex: number, weightKg: number, reps: number): boolean => {
    if (!session?.personal_records?.length) return false;
    return session.personal_records.some(
      (pr) =>
        pr.exercise_name === exerciseName &&
        pr.reps === reps &&
        Math.abs(pr.new_weight_kg - weightKg) < 0.01,
    );
  };

  // Notes
  const notes = session?.metadata && typeof session.metadata === 'object'
    ? (session.metadata as Record<string, unknown>).notes as string | undefined
    : undefined;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.skeletonContainer}>
          <Skeleton width="60%" height={24} borderRadius={8} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={80} borderRadius={12} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={120} borderRadius={12} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={120} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" />
          <Text style={styles.errorText}>{error ?? 'Session not found'}</Text>
          <TouchableOpacity style={styles.errorBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.errorBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formattedDate = new Date(session.session_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Detail</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Session summary */}
        <Text style={styles.dateText}>{formattedDate}</Text>

        <View style={styles.summaryRow}>
          {durationSeconds != null && durationSeconds > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{formatDuration(durationSeconds)}</Text>
            </View>
          )}
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Volume</Text>
            <Text style={styles.summaryValue}>
              {Math.round(workingVolume).toLocaleString()} {unitLabel}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Exercises</Text>
            <Text style={styles.summaryValue}>{session.exercises.length}</Text>
          </View>
        </View>

        {/* Exercise list */}
        {session.exercises.map((exercise, exIdx) => {
          const imageUrl = exerciseImages[exercise.exercise_name];
          return (
          <Card key={exIdx} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseNameRow}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.exerciseThumb}
                    accessibilityLabel={`${exercise.exercise_name} image`}
                  />
                ) : (
                  <View style={styles.exerciseThumbPlaceholder}>
                    <Icon name="dumbbell" size={16} color={colors.text.muted} />
                  </View>
                )}
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
              </View>
              {(() => {
                const e1rm = bestE1RMForExercise(exercise.sets);
                if (e1rm == null) return null;
                const display = convertWeight(e1rm, unitSystem);
                const suffix = unitSystem === 'metric' ? 'kg' : 'lbs';
                return (
                  <Text style={styles.e1rmBadge}>
                    Est. 1RM: {display} {suffix}
                  </Text>
                );
              })()}
            </View>

            {/* Set table header */}
            <View style={styles.setHeaderRow}>
              <Text style={[styles.setHeaderCell, styles.setNumCol]}>#</Text>
              <Text style={[styles.setHeaderCell, styles.weightCol]}>{unitLabel}</Text>
              <Text style={[styles.setHeaderCell, styles.repsCol]}>Reps</Text>
              <Text style={[styles.setHeaderCell, styles.rpeCol]}>RPE</Text>
              <Text style={[styles.setHeaderCell, styles.typeCol]}>Type</Text>
              <Text style={[styles.setHeaderCell, styles.prCol]} />
            </View>

            {/* Set rows */}
            {exercise.sets.map((set, setIdx) => {
              const setType = set.set_type || 'normal';
              const hasPR = isPRSet(exercise.exercise_name, setIdx, set.weight_kg, set.reps);
              const displayWeight = convertWeight(set.weight_kg, unitSystem);

              return (
                <View
                  key={setIdx}
                  style={[
                    styles.setRow,
                    setType === 'warm-up' && styles.setRowWarmup,
                    setType === 'amrap' && styles.setRowAmrap,
                  ]}
                >
                  <Text style={[styles.setCell, styles.setNumCol]}>{setIdx + 1}</Text>
                  <Text style={[styles.setCell, styles.weightCol]}>{displayWeight}</Text>
                  <Text style={[styles.setCell, styles.repsCol]}>{set.reps}</Text>
                  <Text style={[styles.setCell, styles.rpeCol]}>
                    {set.rpe != null ? set.rpe : '—'}
                  </Text>
                  <View style={styles.typeCol}>
                    <SetTypeBadge type={setType} />
                  </View>
                  <View style={styles.prCol}>
                    {hasPR && (
                      <Text style={styles.prBadge}>🏆</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
          );
        })}

        {/* Notes section */}
        {notes ? (
          <Card style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </Card>
        ) : null}

        {/* Edit button */}
        <TouchableOpacity
          style={styles.editButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.push('ActiveWorkout', { mode: 'edit', sessionId: session.id })
          }
        >
          <Text style={styles.editButtonText}>Edit Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}


// ─── Set Type Badge ──────────────────────────────────────────────────────────

const SET_TYPE_LABELS: Record<string, string> = {
  normal: 'N',
  'warm-up': 'W',
  'drop-set': 'D',
  amrap: 'A',
};

const SET_TYPE_COLORS: Record<string, string> = {
  normal: colors.text.muted,
  'warm-up': colors.semantic.warning,
  'drop-set': colors.semantic.negative,
  amrap: colors.accent.primary,
};

function SetTypeBadge({ type }: { type: string }) {
  const label = SET_TYPE_LABELS[type] ?? 'N';
  const color = SET_TYPE_COLORS[type] ?? colors.text.muted;
  return (
    <View style={[badgeStyles.badge, { borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  headerSpacer: { width: 32 },
  skeletonContainer: {
    padding: spacing[4],
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
  errorBackBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.sm,
  },
  errorBackText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  dateText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[3],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  summaryValue: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  exerciseCard: {
    marginBottom: spacing[3],
  },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  exerciseThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  exerciseThumbPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  e1rmBadge: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing[1],
  },
  setHeaderCell: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  setRowWarmup: {
    opacity: 0.6,
  },
  setRowAmrap: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: 4,
  },
  setCell: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
  },
  setNumCol: { width: 28, textAlign: 'center' },
  weightCol: { flex: 1, textAlign: 'center' },
  repsCol: { width: 40, textAlign: 'center' },
  rpeCol: { width: 36, textAlign: 'center' },
  typeCol: { width: 28, alignItems: 'center' as const },
  prCol: { width: 28, alignItems: 'center' as const },
  prBadge: {
    fontSize: 14,
  },
  notesCard: {
    marginBottom: spacing[3],
  },
  notesLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: ls.wide,
  },
  notesText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
  editButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  editButtonText: {
    color: colors.text.inverse,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
