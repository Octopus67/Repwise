/**
 * TrainingTabContent — Extracted from AnalyticsScreen (Task 8.1)
 *
 * Contains the entire Training tab: WNS explainer, volume chart, muscle fatigue,
 * strength progression, e1RM trend, strength standards, and leaderboard.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { HeatMapCard } from '../../components/analytics/HeatMapCard';
import { FatigueHeatMapOverlay } from '../../components/analytics/FatigueHeatMapOverlay';
import { FatigueBreakdownModal } from '../../components/analytics/FatigueBreakdownModal';
import { StrengthStandardsCard } from '../../components/analytics/StrengthStandardsCard';
import { StrengthLeaderboard } from '../../components/analytics/StrengthLeaderboard';
import { Icon } from '../../components/common/Icon';
import { formatWeight } from '../../utils/unitConversion';
import { spacing, typography, radius } from '../../theme/tokens';
import type { ThemeColors } from '../../hooks/useThemeColors';
import type { TrendPoint, FatigueScore, Classification } from '../../types/analytics';

const EXERCISE_OPTIONS = [
  'bench press',
  'squat',
  'deadlift',
  'overhead press',
  'barbell row',
] as const;

type ExerciseOption = typeof EXERCISE_OPTIONS[number];

const E1RM_EXERCISE_OPTIONS = [
  'barbell bench press',
  'barbell back squat',
  'conventional deadlift',
  'overhead press',
  'barbell row',
] as const;

type E1RMExerciseOption = typeof E1RM_EXERCISE_OPTIONS[number];

function ChartSkeleton() {
  return (
    <View style={{ padding: spacing[4] }}>
      <Skeleton width="100%" height={160} borderRadius={8} />
    </View>
  );
}

interface TrainingTabContentProps {
  c: ThemeColors;
  isLoading: boolean;
  unitSystem: 'metric' | 'imperial';
  // WNS Explainer
  wnsExplainerExpanded: boolean;
  onToggleWnsExplainer: () => void;
  onNavigateHUExplainer: () => void;
  // Volume
  volumeTrend: TrendPoint[];
  // Fatigue
  fatigueScores: FatigueScore[];
  selectedFatigueGroup: FatigueScore | null;
  onFatigueGroupPress: (mg: string) => void;
  onFatigueModalClose: () => void;
  // Strength Progression
  selectedExercise: ExerciseOption;
  onSelectExercise: (ex: ExerciseOption) => void;
  strengthData: TrendPoint[];
  // e1RM
  selectedE1RMExercise: E1RMExerciseOption;
  onSelectE1RMExercise: (ex: E1RMExerciseOption) => void;
  e1rmTrend: TrendPoint[];
  // Strength Standards
  strengthStandards: {
    classifications: Classification[];
    milestones: { message: string }[];
    bodyweight_kg: number | null;
  } | null;
}

export function TrainingTabContent({
  c,
  isLoading,
  unitSystem,
  wnsExplainerExpanded,
  onToggleWnsExplainer,
  onNavigateHUExplainer,
  volumeTrend,
  fatigueScores,
  selectedFatigueGroup,
  onFatigueGroupPress,
  onFatigueModalClose,
  selectedExercise,
  onSelectExercise,
  strengthData,
  selectedE1RMExercise,
  onSelectE1RMExercise,
  e1rmTrend,
  strengthStandards,
}: TrainingTabContentProps) {
  const styles = getStyles(c);
  const weightSuffix = unitSystem === 'metric' ? ' kg' : ' lbs';

  return (
    <>
      {/* WNS Explainer Card */}
      <TouchableOpacity
        onPress={onToggleWnsExplainer}
        style={[styles.explainerCard, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
        testID="wns-explainer-card"
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Why Repwise tracks Hypertrophy Units"
        accessibilityHint={wnsExplainerExpanded ? 'Collapse explanation' : 'Expand explanation'}
        accessibilityState={{ expanded: wnsExplainerExpanded }}
      >
        <View style={styles.explainerHeader}>
          <Text style={[styles.explainerTitle, { color: c.text.primary }]}><Icon name="brain" size={14} color={c.accent.primary} /> Why Repwise Tracks Hypertrophy Units (HU)</Text>
          <Text style={[styles.chevron, { color: c.text.muted }]}>{wnsExplainerExpanded ? '▼' : '▶'}</Text>
        </View>
        {wnsExplainerExpanded && (
          <View style={styles.explainerContent}>
            <Text style={[styles.explainerSubhead, { color: c.accent.primary }]}>Traditional Apps</Text>
            <Text style={[styles.explainerText, { color: c.text.secondary }]}>Count total sets — treats every set equally regardless of effort or fatigue.</Text>

            <Text style={[styles.explainerSubhead, { color: c.accent.primary }]}>Repwise (HU)</Text>
            <Text style={[styles.explainerText, { color: c.text.secondary }]}>Counts effective stimulus by weighing each set based on:</Text>

            <Text style={[styles.explainerBullet, { color: c.text.secondary }]}>• <Text style={[styles.explainerBold, { color: c.text.primary }]}>Intensity</Text> — harder sets score higher</Text>
            <Text style={[styles.explainerBullet, { color: c.text.secondary }]}>• <Text style={[styles.explainerBold, { color: c.text.primary }]}>Diminishing returns</Text> — junk volume is discounted</Text>
            <Text style={[styles.explainerBullet, { color: c.text.secondary }]}>• <Text style={[styles.explainerBold, { color: c.text.primary }]}>Frequency</Text> — spreading work across days is rewarded</Text>
            <Text style={[styles.explainerBullet, { color: c.text.secondary }]}>• <Text style={[styles.explainerBold, { color: c.text.primary }]}>Goal adjustment</Text> — targets adapt to your training phase</Text>

            <TouchableOpacity onPress={onNavigateHUExplainer} style={styles.learnMoreBtn} accessibilityRole="link" accessibilityLabel="Learn more about Hypertrophy Units">
              <Text style={[styles.learnMoreText, { color: c.accent.primary }]}>Learn More →</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Training Volume */}
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Training Volume</Text>
      <Card>
        {isLoading ? (
          <ChartSkeleton />
        ) : volumeTrend.length === 0 ? (
          <EmptyState
            icon={<Icon name="chart" />}
            title="No volume data"
            description="Log training sessions to see volume trends"
          />
        ) : (
          <TrendLineChart
            data={volumeTrend}
            color={c.accent.primary}
            suffix=" kg"
            emptyMessage="No training volume data for this period"
          />
        )}
      </Card>

      {/* Muscle Volume Heat Map */}
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Muscle Volume Heat Map</Text>
      <HeatMapCard />

      {/* Muscle Fatigue */}
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Muscle Fatigue</Text>
      {fatigueScores.length > 0 ? (
        <Card>
          <FatigueHeatMapOverlay
            scores={fatigueScores}
            onMuscleGroupPress={onFatigueGroupPress}
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="brain" />}
            title="No fatigue data yet"
            description="Log 2+ weeks of training to see fatigue analysis"
          />
        </Card>
      )}

      <FatigueBreakdownModal
        visible={!!selectedFatigueGroup}
        score={selectedFatigueGroup}
        onClose={onFatigueModalClose}
      />

      {/* Strength Progression */}
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Strength Progression</Text>
      <Card>
        <View style={styles.exerciseSelector}>
          {EXERCISE_OPTIONS.map((ex) => (
            <TouchableOpacity
              key={ex}
              style={[
                styles.exercisePill,
                selectedExercise === ex && styles.exercisePillActive,
              ]}
              onPress={() => onSelectExercise(ex)}
              accessibilityRole="button"
              accessibilityLabel={`${ex.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')} strength filter`}
              accessibilityState={{ selected: selectedExercise === ex }}
            >
              <Text
                style={[
                  styles.exercisePillText,
                  selectedExercise === ex && styles.exercisePillTextActive,
                ]}
              >
                {ex.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <TrendLineChart
            data={strengthData.map((p) => ({
              date: p.date,
              value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
            }))}
            color={c.semantic.positive}
            suffix={weightSuffix}
            emptyMessage={`No data for ${selectedExercise} in this period`}
          />
        )}
      </Card>

      {/* e1RM Trend, Strength Standards, Strength Leaderboard */}
      {isLoading ? (
        <>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>e1RM Trend</Text>
          <Card><ChartSkeleton /></Card>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Strength Standards</Text>
          <Card><ChartSkeleton /></Card>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Strength Leaderboard</Text>
          <Card><ChartSkeleton /></Card>
        </>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>e1RM Trend</Text>
          <Card>
            <View style={styles.exerciseSelector}>
              {E1RM_EXERCISE_OPTIONS.map((ex) => (
                <TouchableOpacity
                  key={ex}
                  style={[
                    styles.exercisePill,
                    selectedE1RMExercise === ex && styles.exercisePillActive,
                  ]}
                  onPress={() => onSelectE1RMExercise(ex)}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')} e1RM filter`}
                  accessibilityState={{ selected: selectedE1RMExercise === ex }}
                >
                  <Text
                    style={[
                      styles.exercisePillText,
                      selectedE1RMExercise === ex && styles.exercisePillTextActive,
                    ]}
                  >
                    {ex.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TrendLineChart
              data={e1rmTrend.map((p) => ({
                date: p.date,
                value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
              }))}
              color={c.accent.primary}
              suffix={weightSuffix}
              emptyMessage={`No e1RM data for ${selectedE1RMExercise} in this period`}
            />
          </Card>

          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Strength Standards</Text>
          <StrengthStandardsCard
            classifications={strengthStandards?.classifications ?? []}
            bodyweightKg={strengthStandards?.bodyweight_kg ?? null}
          />

          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Strength Leaderboard</Text>
          <StrengthLeaderboard
            classifications={strengthStandards?.classifications ?? []}
          />
        </>
      )}
    </>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[6],
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.lg,
  },
  exerciseSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  exercisePill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  exercisePillActive: {
    backgroundColor: c.accent.primaryMuted,
    borderColor: c.accent.primary,
  },
  exercisePillText: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.xs,
  },
  exercisePillTextActive: {
    color: c.accent.primary,
  },
  explainerCard: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[4],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  explainerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  explainerTitle: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    flex: 1,
    lineHeight: typography.lineHeight.base,
  },
  chevron: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    marginLeft: spacing[2],
  },
  explainerContent: {
    marginTop: spacing[3],
  },
  explainerSubhead: {
    color: c.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[2],
    marginBottom: spacing[1],
    lineHeight: typography.lineHeight.sm,
  },
  explainerText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  explainerBullet: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginLeft: spacing[2],
    marginTop: spacing[1],
  },
  explainerBold: {
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
  },
  learnMoreBtn: {
    marginTop: spacing[3],
    alignSelf: 'flex-start',
  },
  learnMoreText: {
    color: c.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
});
