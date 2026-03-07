import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
}

export function SmartTrainingStep({ onNext }: Props) {
  const c = useThemeColors();
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Your Training Adapts Too</Text>
      <Text style={[styles.subheading, { color: c.accent.primary }]}>
        First app to adjust volume recommendations based on your calorie goal
      </Text>

      {/* Cutting Example */}
      <View style={[styles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.emoji}>🔥</Text>
          <Text style={[styles.cardTitle, { color: c.text.primary }]}>Cutting (0.5 kg/week)</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardText, { color: c.text.secondary }]}>→ 15% less volume recommended</Text>
          <Text style={[styles.cardText, { color: c.text.secondary }]}>→ Prioritizes muscle preservation</Text>
          <Text style={[styles.cardText, { color: c.text.secondary }]}>→ Matches your recovery capacity</Text>
        </View>
      </View>

      {/* Bulking Example */}
      <View style={[styles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.emoji}>💪</Text>
          <Text style={[styles.cardTitle, { color: c.text.primary }]}>Bulking (0.25 kg/week)</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardText, { color: c.text.secondary }]}>→ 10% more volume capacity</Text>
          <Text style={[styles.cardText, { color: c.text.secondary }]}>→ Maximizes growth stimulus</Text>
          <Text style={[styles.cardText, { color: c.text.secondary }]}>→ Leverages your surplus</Text>
        </View>
      </View>

      {/* Science Badge */}
      <View style={[styles.scienceBadge, { backgroundColor: c.accent.primaryMuted }]}>
        <Text style={[styles.scienceText, { color: c.accent.primary }]}>
          Based on peer-reviewed research (Pelland 2024, Schoenfeld 2017)
        </Text>
        <Text style={[styles.scienceSubtext, { color: c.text.secondary }]}>
          Not guesswork. Not generic advice. Personalized to YOUR goal.
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight['2xl'],
  },
  subheading: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.base,
  },
  card: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  emoji: {
    fontSize: 24,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
  cardContent: {
    gap: spacing[1],
  },
  cardText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  scienceBadge: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  scienceText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    lineHeight: typography.lineHeight.sm,
  },
  scienceSubtext: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    textAlign: 'center',
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.xs,
  },
  valueProp: {
    marginBottom: spacing[6],
  },
  valueTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.lg,
  },
  valueText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.base,
  },
  btn: { marginTop: spacing[2] },
});
