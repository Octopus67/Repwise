import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore } from '../../../store/onboardingSlice';
import type { GoalType } from '../../../store/onboardingSlice';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
}

interface GoalCard {
  emoji: string;
  title: string;
  bullets: string[];
}

const GOAL_CARDS: Record<string, GoalCard> = {
  cutting: {
    emoji: '🔥',
    title: 'Cutting',
    bullets: [
      '→ 15% less volume recommended',
      '→ Prioritizes muscle preservation',
      '→ Matches your recovery capacity',
    ],
  },
  bulking: {
    emoji: '💪',
    title: 'Bulking',
    bullets: [
      '→ 10% more volume capacity',
      '→ Maximizes growth stimulus',
      '→ Leverages your surplus',
    ],
  },
  maintain: {
    emoji: '⚖️',
    title: 'Maintaining',
    bullets: [
      '→ Baseline volume targets',
      '→ Balanced recovery & stimulus',
      '→ Steady progress over time',
    ],
  },
};

function getCardKey(goal: GoalType | null): string {
  if (goal === 'lose_fat') return 'cutting';
  if (goal === 'build_muscle') return 'bulking';
  return 'maintain';
}

function getGoalLabel(goal: GoalType | null): string {
  if (goal === 'lose_fat') return 'fat loss';
  if (goal === 'build_muscle') return 'muscle building';
  if (goal === 'recomposition') return 'recomposition';
  if (goal === 'eat_healthier') return 'healthier eating';
  return 'maintenance';
}

export function SmartTrainingStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { goalType, rateKgPerWeek } = useOnboardingStore();

  const key = getCardKey(goalType);
  const card = GOAL_CARDS[key];
  const showRate = goalType === 'lose_fat' || goalType === 'build_muscle';
  const rateLabel = showRate && rateKgPerWeek > 0 ? ` (${rateKgPerWeek} kg/week)` : '';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Your Training Adapts Too</Text>
      <Text style={[styles.subheading, { color: c.accent.primary }]}>
        Adjusted for your {getGoalLabel(goalType)} goal
      </Text>

      {/* Personalized card */}
      <View style={[styles.card, styles.cardHighlight, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primary }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.emoji}>{card.emoji}</Text>
          <Text style={[styles.cardTitle, { color: c.text.primary }]}>{card.title}{rateLabel}</Text>
        </View>
        <View style={styles.cardContent}>
          {card.bullets.map((b) => (
            <Text key={b} style={[styles.cardText, { color: c.text.secondary }]}>{b}</Text>
          ))}
        </View>
      </View>

      {/* Science Badge */}
      <View style={[styles.scienceBadge, { backgroundColor: c.accent.primaryMuted }]}>
        <Text style={[styles.scienceText, { color: c.accent.primary }]}>
          Based on peer-reviewed research (Pelland 2024, Schoenfeld 2017)
        </Text>
        <Text style={[styles.scienceSubtext, { color: c.text.secondary }]}>
          Not guesswork. Personalized to YOUR goal.
        </Text>
      </View>

      {/* Value Prop */}
      <View style={styles.valueProp}>
        <Text style={[styles.valueTitle, { color: c.text.primary }]}>Why This Matters</Text>
        <Text style={[styles.valueText, { color: c.text.secondary }]}>
          Other apps give you the same training advice whether you're eating 1500 or 3500 calories.
        </Text>
        <Text style={[styles.valueText, { color: c.text.secondary }]}>
          Repwise knows that recovery capacity changes with your calorie balance — and adjusts your targets accordingly.
        </Text>
      </View>

      {onNext && <Button title="Continue" onPress={onNext} style={styles.btn} />}
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: {
    color: c.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight['2xl'],
  },
  subheading: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.base,
  },
  card: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardHighlight: {
    borderWidth: 2,
    borderColor: c.accent.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  emoji: { fontSize: 24 },
  cardTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
  cardContent: { gap: spacing[1] },
  cardText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  scienceBadge: {
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  scienceText: {
    color: c.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    lineHeight: typography.lineHeight.sm,
  },
  scienceSubtext: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
    textAlign: 'center',
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.xs,
  },
  valueProp: { marginBottom: spacing[6] },
  valueTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.lg,
  },
  valueText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.base,
  },
  btn: { marginTop: spacing[2] },
});
