/**
 * SessionDetailScreen — Read-only session detail view
 *
 * Displays: session date, workout duration, total working volume,
 * exercises with sets (weight, reps, RPE/RIR, set type), PR badges,
 * session notes, and exercise image thumbnails.
 *
 * Edit button navigates to ActiveWorkoutScreen in edit mode.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, letterSpacing as ls } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import { useStore } from '../../store';
import { convertWeight } from '../../utils/unitConversion';
import { formatDuration } from '../../utils/durationFormat';
import {
  shouldShowDuration,
  calculateSessionVolume,
  formatSessionDate,
  isPRSet,
  calculateDurationSeconds,
} from '../../utils/sessionDetailLogic';
import { bestE1RMForExercise } from '../../utils/e1rmCalculator';
import api from '../../services/api';
import type { AxiosError } from 'axios';
import type { TrainingSessionResponse } from '../../types/training';
import type { Exercise } from '../../types/exercise';
import { resolveImageUrl } from '../../utils/exerciseDetailLogic';
import { ShareCardCustomizer } from '../../components/sharing/ShareCardCustomizer';
import { SessionComparison } from '../../components/training/SessionComparison';
import { ModalContainer } from '../../components/common/ModalContainer';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

interface SessionDetailScreenProps {
  route: { params: { sessionId: string } };
  navigation: {
    goBack: () => void;
    push: (screen: string, params?: Record<string, unknown>) => void;
  };
  /** When true, shows estimated 1RM badges per exercise. Defaults to true. */
  showE1RM?: boolean;
}

export function SessionDetailScreen({ route, navigation, showE1RM = true }: SessionDetailScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { sessionId } = route.params ?? {};
  const unitSystem = useStore((s) => s.unitSystem);
  const { enabled: sharingEnabled } = useFeatureFlag('social_sharing');

  const [session, setSession] = useState<TrainingSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exerciseImages, setExerciseImages] = useState<Record<string, string | null>>({});
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const [previousSession, setPreviousSession] = useState<TrainingSessionResponse | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    async function fetchSession() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`training/sessions/${sessionId}`);
        if (!cancelled) setSession(res.data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as AxiosError)?.response?.status === 404 ? 'Session not found' : 'Failed to load session');
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
    if (!sessionId) return;
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
      } catch (err) {
        console.error('[SessionDetail] Image load failed:', err);
        // best-effort — images are optional
      }
    }
    fetchExerciseImages();
    return () => { cancelled = true; };
  }, [session]);

  const handleCompare = async () => {
    if (!session) return;
    setComparisonLoading(true);
    try {
      const { data } = await api.get('training/sessions', {
        params: { before_date: session.session_date, limit: 20 },
      });
      const sessions: TrainingSessionResponse[] = data.items ?? data ?? [];
      const currNames = new Set(session.exercises.map((e) => e.exercise_name));
      const match = sessions.find((s) =>
        s.id !== session.id && s.exercises.some((e) => currNames.has(e.exercise_name)),
      );
      if (match) {
        setPreviousSession(match);
        setComparisonVisible(true);
      } else {
        Alert.alert('No Match', 'No previous session found to compare');
      }
    } catch (err) {
      console.warn('[SessionDetail] Compare fetch failed:', err);
    } finally {
      setComparisonLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <SafeAreaView style={[getThemedStyles(c).safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={getThemedStyles(c).errorContainer}>
          <Icon name="alert-circle" />
          <Text style={[getThemedStyles(c).errorText, { color: c.text.secondary }]}>No session specified</Text>
          <TouchableOpacity style={[getThemedStyles(c).errorBackBtn, { backgroundColor: c.accent.primaryMuted }]} onPress={() => navigation.goBack()}>
            <Text style={[getThemedStyles(c).errorBackText, { color: c.accent.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  // Duration
  const durationSeconds = session
    ? calculateDurationSeconds(session.start_time, session.end_time)
    : null;
  const showDuration = session
    ? shouldShowDuration(session.start_time, session.end_time)
    : false;

  // Working volume
  const workingVolume = session ? calculateSessionVolume(session.exercises, unitSystem) : 0;

  // Notes
  const notes = session?.metadata && typeof session.metadata === 'object'
    ? (session.metadata as Record<string, unknown>).notes as string | undefined
    : undefined;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text.primary }]}>Session Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.skeletonContainer}>
          <Skeleton width="60%" height={24} borderRadius={8} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={80} borderRadius={12} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={120} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text.primary }]}>Session Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" />
          <Text style={[styles.errorText, { color: c.text.secondary }]}>{error ?? 'Session not found'}</Text>
          <TouchableOpacity style={[styles.errorBackBtn, { backgroundColor: c.accent.primaryMuted }]} onPress={() => navigation.goBack()}>
            <Text style={[styles.errorBackText, { color: c.accent.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formattedDate = formatSessionDate(session.session_date);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="session-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text.primary }]}>Session Detail</Text>
        {sharingEnabled ? (
          <TouchableOpacity
            onPress={() => setShareModalVisible(true)}
            style={styles.backBtn}
            accessibilityLabel="Share workout"
            accessibilityRole="button"
            testID="share-session-button"
          >
            <Icon name="share" size={20} color={c.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Session date */}
        <Text style={[styles.dateText, { color: c.text.primary }]} testID="session-date">{formattedDate}</Text>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          {showDuration && durationSeconds != null && (
            <View style={[styles.summaryItem, { backgroundColor: c.bg.surface }]} testID="session-duration">
              <Text style={[styles.summaryLabel, { color: c.text.muted }]}>Duration</Text>
              <Text style={[styles.summaryValue, { color: c.text.primary }]}>{formatDuration(durationSeconds)}</Text>
            </View>
          )}
          <View style={[styles.summaryItem, { backgroundColor: c.bg.surface }]}>
            <Text style={[styles.summaryLabel, { color: c.text.muted }]}>Volume</Text>
            <Text style={[styles.summaryValue, { color: c.text.primary }]}>
              {Math.round(workingVolume).toLocaleString()} {unitLabel}
            </Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: c.bg.surface }]}>
            <Text style={[styles.summaryLabel, { color: c.text.muted }]}>Exercises</Text>
            <Text style={[styles.summaryValue, { color: c.text.primary }]}>{session.exercises.length}</Text>
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
                      source={{ uri: resolveImageUrl(imageUrl) }}
                      style={styles.exerciseThumb}
                      testID={`exercise-image-${exIdx}`}
                      accessibilityLabel={`${exercise.exercise_name} image`}
                    />
                  ) : (
                    <View style={[styles.exerciseThumbPlaceholder, { backgroundColor: c.bg.surfaceRaised }]}>
                      <Icon name="dumbbell" size={16} color={c.text.muted} />
                    </View>
                  )}
                  <Text style={[styles.exerciseName, { color: c.text.primary }]}>{exercise.exercise_name}</Text>
                </View>
                {showE1RM && (() => {
                  const e1rm = bestE1RMForExercise(exercise.sets);
                  if (e1rm == null) return null;
                  const display = convertWeight(e1rm, unitSystem);
                  return (
                    <Text style={[styles.e1rmBadge, { color: c.accent.primary }]}>
                      Est. 1RM: {display} {unitLabel}
                    </Text>
                  );
                })()}
              </View>

              {/* Set table header */}
              <View style={[styles.setHeaderRow, { borderBottomColor: c.border.subtle }]}>
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
                const hasPR = isPRSet(
                  session.personal_records,
                  exercise.exercise_name,
                  set.weight_kg,
                  set.reps,
                );
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
                        <View testID={`pr-badge-${exIdx}-${setIdx}`}><Icon name="trophy" size={14} color={c.accent.primary} /></View>
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
            <Text style={[styles.notesLabel, { color: c.text.muted }]}>Notes</Text>
            <Text style={[styles.notesText, { color: c.text.secondary }]}>{notes}</Text>
          </Card>
        ) : null}

        {/* Compare with Previous */}
        <TouchableOpacity
          style={[styles.compareButton, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}
          activeOpacity={0.8}
          testID="compare-session-button"
          onPress={handleCompare}
          disabled={comparisonLoading}
        >
          <Text style={[styles.compareButtonText, { color: c.accent.primary }]}>
            {comparisonLoading ? 'Loading...' : 'Compare with Previous'}
          </Text>
        </TouchableOpacity>

        {/* Edit button */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: c.accent.primary }]}
          activeOpacity={0.8}
          testID="edit-session-button"
          onPress={() =>
            navigation.push('ActiveWorkout', { mode: 'edit', sessionId: session.id })
          }
        >
          <Text style={[styles.editButtonText, { color: c.text.inverse }]}>Edit Session</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Share modal */}
      <ShareCardCustomizer
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        session={session}
        unitSystem={unitSystem}
      />

      {/* Comparison modal */}
      {session && previousSession && (
        <ModalContainer
          visible={comparisonVisible}
          onClose={() => setComparisonVisible(false)}
          title="Session Comparison"
          testID="comparison-modal"
        >
          <SessionComparison
            currentSession={session}
            previousSession={previousSession}
            unitSystem={unitSystem}
          />
        </ModalContainer>
      )}
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

const getSET_TYPE_COLORS = (c: ThemeColors): Record<string, string> => ({
  normal: c.text.muted,
  'warm-up': c.semantic.warning,
  'drop-set': c.semantic.negative,
  amrap: c.accent.primary,
});

function SetTypeBadge({ type }: { type: string }) {
  const c = useThemeColors();
  const label = SET_TYPE_LABELS[type] ?? 'N';
  const color = getSET_TYPE_COLORS(c)[type] ?? c.text.muted;
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

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
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
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  headerSpacer: { width: 32 },
  skeletonContainer: { padding: spacing[4] },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  errorText: {
    color: c.text.secondary,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
  errorBackBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.sm,
  },
  errorBackText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[12] },
  dateText: {
    color: c.text.primary,
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
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    alignItems: 'center',
  },
  summaryLabel: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  summaryValue: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  exerciseCard: { marginBottom: spacing[3] },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  e1rmBadge: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  exerciseName: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
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
    backgroundColor: c.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
    marginBottom: spacing[1],
  },
  setHeaderCell: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  setRowWarmup: { opacity: 0.6 },
  setRowAmrap: {
    backgroundColor: c.accent.primaryMuted,
    borderRadius: 4,
  },
  setCell: {
    color: c.text.primary,
    fontSize: typography.size.sm,
  },
  setNumCol: { width: 28, textAlign: 'center' },
  weightCol: { flex: 1, textAlign: 'center' },
  repsCol: { width: 40, textAlign: 'center' },
  rpeCol: { width: 36, textAlign: 'center' },
  typeCol: { width: 28, alignItems: 'center' as const },
  prCol: { width: 28, alignItems: 'center' as const },
  prBadge: { fontSize: 14 },
  notesCard: { marginBottom: spacing[3] },
  notesLabel: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: ls.wide,
  },
  notesText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
  editButton: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  editButtonText: {
    color: c.text.inverse,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  compareButton: {
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
    borderWidth: 1,
  },
  compareButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
