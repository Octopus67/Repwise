import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore } from '../../../store/onboardingSlice';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
}

export function SmartTrainingStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { goalType, exerciseSessionsPerWeek } = useOnboardingStore();

  const goalLabel = goalType === 'lose_fat' ? 'fat loss' 
    : goalType === 'build_muscle' ? 'muscle building'
    : goalType === 'recomposition' ? 'body recomposition'
    : 'maintenance';

  // Calculate volume ranges based on goal
  const baseVolume = exerciseSessionsPerWeek * 4;
  const volumeMultiplier = goalType === 'lose_fat' ? 0.85 
    : goalType === 'build_muscle' ? 1.1 
    : 1.0;
  const adjustedVolume = Math.round(baseVolume * volumeMultiplier);

  // Major muscle groups with volume ranges
  const muscleGroups = [
    { name: 'Chest', min: Math.round(adjustedVolume * 0.9), max: Math.round(adjustedVolume * 1.2) },
    { name: 'Back', min: Math.round(adjustedVolume * 0.9), max: Math.round(adjustedVolume * 1.2) },
    { name: 'Shoulders', min: Math.round(adjustedVolume * 0.8), max: Math.round(adjustedVolume * 1.1) },
    { name: 'Legs', min: Math.round(adjustedVolume * 1.0), max: Math.round(adjustedVolume * 1.3) },
  ];

  // Example 4-week progression
  const exampleWeeks = [
    { week: 1, sets: adjustedVolume, indicator: '✓', reason: 'On track', color: c.semantic.positive },
    { week: 2, sets: Math.round(adjustedVolume * 1.15), indicator: '↑', reason: 'Good recovery', color: c.semantic.positive },
    { week: 3, sets: Math.round(adjustedVolume * 0.85), indicator: '↓', reason: 'Fatigue detected', color: c.semantic.warning },
    { week: 4, sets: adjustedVolume, indicator: '→', reason: 'Back to baseline', color: c.text.secondary },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={[styles.heading, { color: c.text.primary }]}>Smart Training</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>
        Personalized for {goalLabel}
      </Text>

      {/* Weekly Training Volume */}
      <View style={[styles.section, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>YOUR WEEKLY TRAINING VOLUME</Text>
        
        {muscleGroups.map((muscle) => (
          <View key={muscle.name} style={styles.muscleRow}>
            <Text style={[styles.muscleName, { color: c.text.secondary }]}>{muscle.name}</Text>
            <View style={[styles.barTrack, { backgroundColor: c.bg.surface }]}>
              <View 
                style={[
                  styles.barFill, 
                  { width: '75%', backgroundColor: c.accent.primary }
                ]} 
              />
            </View>
            <Text style={[styles.muscleValue, { color: c.text.primary }]}>
              {muscle.min}-{muscle.max} sets
            </Text>
          </View>
        ))}
        
        <Text style={[styles.sectionNote, { color: c.text.muted }]}>
          Based on {exerciseSessionsPerWeek} sessions per week
        </Text>
      </View>

      {/* Comparison: Static vs Adaptive */}
      <View style={styles.comparisonContainer}>
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>WHY ADAPTIVE TRAINING</Text>
        
        <View style={styles.comparisonGrid}>
          {/* Static Plans */}
          <View style={[styles.compCard, styles.compCardStatic, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
            <Text style={[styles.compCardTitle, { color: c.text.secondary }]}>Static Plans</Text>
            <View style={[styles.compCardDivider, { backgroundColor: c.border.default }]} />
            <Text style={[styles.compCardItem, { color: c.text.muted }]}>Same volume every week</Text>
            <Text style={[styles.compCardItem, { color: c.text.muted }]}>Ignores calorie intake</Text>
            <Text style={[styles.compCardItem, { color: c.text.muted }]}>No recovery adjustment</Text>
            <View style={styles.compCardSpacer} />
            <Text style={[styles.compCardResult, { color: c.semantic.negative }]}>Risk: Overtraining or plateau</Text>
          </View>

          {/* Repwise Adaptive */}
          <View style={[styles.compCard, styles.compCardAdaptive, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primary }]}>
            <Text style={[styles.compCardTitle, { color: c.accent.primary }]}>Repwise Adaptive</Text>
            <View style={[styles.compCardDivider, { backgroundColor: c.accent.primary }]} />
            <Text style={[styles.compCardItem, { color: c.text.secondary }]}>Adjusts weekly</Text>
            <Text style={[styles.compCardItem, { color: c.text.secondary }]}>Matches your calories</Text>
            <Text style={[styles.compCardItem, { color: c.text.secondary }]}>Responds to recovery</Text>
            <View style={styles.compCardSpacer} />
            <Text style={[styles.compCardResult, { color: c.semantic.positive }]}>Result: Optimal progress</Text>
          </View>
        </View>
      </View>

      {/* Example Timeline */}
      <View style={[styles.section, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>WHAT YOU'LL SEE</Text>
        <Text style={[styles.sectionSubtitle, { color: c.text.muted }]}>
          Example: 4-week adaptation
        </Text>
        
        {exampleWeeks.map((week) => (
          <View key={week.week} style={styles.weekRow}>
            <Text style={[styles.weekLabel, { color: c.text.secondary }]}>Week {week.week}</Text>
            <Text style={[styles.weekSets, { color: c.text.primary }]}>{week.sets} sets</Text>
            <Text style={[styles.weekIndicator, { color: week.color }]}>{week.indicator}</Text>
            <Text style={[styles.weekReason, { color: c.text.muted }]}>{week.reason}</Text>
          </View>
        ))}
      </View>

      {onNext && <Button title="Continue" onPress={onNext} style={styles.btn} />}
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  heading: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight['2xl'],
  },
  subheading: {
    fontSize: typography.size.base,
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.base,
  },
  section: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: typography.size.sm,
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.sm,
  },
  sectionNote: {
    fontSize: typography.size.xs,
    marginTop: spacing[2],
    lineHeight: typography.lineHeight.xs,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  muscleName: {
    fontSize: typography.size.sm,
    width: 80,
    fontWeight: typography.weight.medium,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  muscleValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    width: 80,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  comparisonContainer: {
    marginBottom: spacing[4],
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  compCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
  },
  compCardStatic: {
    opacity: 0.7,
  },
  compCardAdaptive: {
    borderWidth: 2,
  },
  compCardTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  compCardDivider: {
    height: 2,
    marginBottom: spacing[3],
  },
  compCardItem: {
    fontSize: typography.size.sm,
    marginBottom: spacing[1],
    lineHeight: typography.lineHeight.sm,
  },
  compCardSpacer: {
    height: spacing[2],
  },
  compCardResult: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  weekLabel: {
    fontSize: typography.size.sm,
    width: 60,
    fontWeight: typography.weight.medium,
  },
  weekSets: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    width: 70,
    fontVariant: ['tabular-nums'],
  },
  weekIndicator: {
    fontSize: typography.size.base,
    width: 20,
    textAlign: 'center',
  },
  weekReason: {
    fontSize: typography.size.sm,
    flex: 1,
    lineHeight: typography.lineHeight.sm,
  },
  btn: { marginTop: spacing[4] },
});
