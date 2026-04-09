/**
 * WorkoutShareCard — Branded share card rendered as a capturable image.
 *
 * Displays: Repwise branding, session date, duration, volume, exercises with sets,
 * and PR badges. Designed for social sharing.
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { colors, spacing, typography, radius, letterSpacing as ls } from '../../theme/tokens';
import { Icon } from '../common/Icon';
import { buildShareUrl } from '../../services/sharing';
import type { TrainingSessionResponse } from '../../types/training';
import type { UnitSystem } from '../../utils/unitConversion';
import { convertWeight } from '../../utils/unitConversion';
import { formatDuration } from '../../utils/durationFormat';
import {
  calculateSessionVolume,
  calculateDurationSeconds,
  shouldShowDuration,
} from '../../utils/sessionDetailLogic';

export type ShareCardTheme = 'dark' | 'midnight' | 'ocean';

export interface ShareCardOptions {
  showExercises: boolean;
  showWeights: boolean;
  showPRs: boolean;
  theme: ShareCardTheme;
}

interface WorkoutShareCardProps {
  session: TrainingSessionResponse;
  unitSystem: UnitSystem;
  options: ShareCardOptions;
  sessionId: string;
  userId?: string;
  username?: string;
}

const THEME_COLORS: Record<ShareCardTheme, { bg: string; surface: string; accent: string; text: string; muted: string }> = {
  dark: { bg: '#0A0E13', surface: '#12171F', accent: '#06B6D4', text: '#F1F5F9', muted: '#94A3B8' },
  midnight: { bg: '#0F0A1A', surface: '#1A1228', accent: '#A78BFA', text: '#F1F5F9', muted: '#A0A0C0' },
  ocean: { bg: '#0A1628', surface: '#0F1F38', accent: '#38BDF8', text: '#F1F5F9', muted: '#7DA8C8' },
};

export const WorkoutShareCard = forwardRef<ViewShot, WorkoutShareCardProps>(
  function WorkoutShareCard({ session, unitSystem, options, sessionId, userId, username }, ref) {
    const t = THEME_COLORS[options.theme];
    const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';
    const shareUrl = buildShareUrl(sessionId, userId);

    const durationSec = calculateDurationSeconds(session.start_time, session.end_time);
    const showDuration = shouldShowDuration(session.start_time, session.end_time);
    const volume = calculateSessionVolume(session.exercises, unitSystem);
    const prCount = session.personal_records?.length ?? 0;

    const dateStr = new Date(session.session_date).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    return (
      <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
        <View style={[styles.card, { backgroundColor: t.bg }]} accessibilityLabel="Workout share card">
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.brand, { color: t.accent }]}>REPWISE</Text>
            <Text style={[styles.date, { color: t.muted }]}>{dateStr}</Text>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { backgroundColor: t.surface }]}>
            {showDuration && durationSec != null && (
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: t.text }]}>{formatDuration(durationSec)}</Text>
                <Text style={[styles.statLabel, { color: t.muted }]}>Duration</Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: t.text }]}>
                {Math.round(volume).toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: t.muted }]}>Volume ({unitLabel})</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: t.text }]}>{session.exercises.length}</Text>
              <Text style={[styles.statLabel, { color: t.muted }]}>Exercises</Text>
            </View>
            {options.showPRs && prCount > 0 && (
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: t.accent }]}><Icon name="trophy" size={14} color={t.accent} /> {prCount}</Text>
                <Text style={[styles.statLabel, { color: t.muted }]}>PRs</Text>
              </View>
            )}
          </View>

          {/* Exercise list */}
          {options.showExercises && (
            <View style={styles.exerciseList}>
              {session.exercises.slice(0, 8).map((ex, i) => (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={[styles.exerciseName, { color: t.text }]} numberOfLines={1}>
                    {ex.exercise_name}
                  </Text>
                  <Text style={[styles.exerciseSets, { color: t.muted }]}>
                    {ex.sets.length} sets
                    {options.showWeights && ex.sets.length > 0 && (
                      ` · ${convertWeight(Math.max(...ex.sets.map(s => s.weight_kg)), unitSystem)} ${unitLabel}`
                    )}
                  </Text>
                </View>
              ))}
              {session.exercises.length > 8 && (
                <Text style={[styles.moreText, { color: t.muted }]}>
                  +{session.exercises.length - 8} more
                </Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: `${t.muted}20` }]}>
            <View style={styles.footerContent}>
              {username ? (
                <Text style={[styles.footerAttribution, { color: t.text }]}>
                  Shared by @{username}
                </Text>
              ) : null}
              <Text style={[styles.footerText, { color: t.muted }]}>
                Built with Repwise · repwise.app
              </Text>
            </View>
            <QRCode value={shareUrl} size={48} backgroundColor="transparent" color={t.muted} />
          </View>
        </View>
      </ViewShot>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: 360,
    padding: spacing[5],
    borderRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  brand: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    letterSpacing: ls.wider,
  },
  date: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  exerciseList: {
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
    marginRight: spacing[2],
  },
  exerciseSets: {
    fontSize: typography.size.xs,
  },
  moreText: {
    fontSize: typography.size.xs,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerContent: {
    flex: 1,
  },
  footerText: {
    fontSize: 10,
  },
  footerAttribution: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: 2,
  },
});
