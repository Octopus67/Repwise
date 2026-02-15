import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useOnboardingStore, GoalType } from '../../../store/onboardingSlice';
import { Icon, IconName } from '../../../components/common/Icon';
import { Button } from '../../../components/common/Button';

const GOALS: { type: GoalType; icon: IconName; title: string; desc: string }[] = [
  { type: 'lose_fat', icon: 'flame', title: 'Lose Fat', desc: 'Get leaner and feel lighter' },
  { type: 'build_muscle', icon: 'muscle', title: 'Build Muscle', desc: 'Get stronger and add size' },
  { type: 'maintain', icon: 'scale', title: 'Maintain', desc: 'Stay at your current physique' },
  { type: 'eat_healthier', icon: 'brain', title: 'Eat Healthier', desc: 'Improve nutrition quality' },
  { type: 'recomposition', icon: 'scale', title: 'Body Recomposition', desc: 'Calorie cycling — surplus on training days, deficit on rest days' },
];

interface Props { onNext: () => void; onSkip: () => void; }

export function IntentStep({ onNext, onSkip }: Props) {
  const goalType = useOnboardingStore((s) => s.goalType);
  const updateField = useOnboardingStore((s) => s.updateField);

  const handleSelect = (type: GoalType) => {
    updateField('goalType', type);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>What's your mission?</Text>
      <Text style={styles.subheading}>We'll build a plan tailored to your goal</Text>

      {GOALS.map((g) => (
        <TouchableOpacity
          key={g.type}
          style={[styles.card, goalType === g.type && styles.cardSelected]}
          onPress={() => handleSelect(g.type)}
          activeOpacity={0.7}
        >
          <View style={styles.iconWrap}>
            <Icon name={g.icon} size={24} color={colors.accent.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{g.title}</Text>
            <Text style={styles.cardDesc}>{g.desc}</Text>
          </View>
          {goalType === g.type && (
            <Icon name="check" size={16} color={colors.accent.primary} />
          )}
        </TouchableOpacity>
      ))}

      <Button title="Next" onPress={onNext} disabled={!goalType} style={{ marginTop: spacing[4] }} />

      <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.surfaceRaised, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4], marginBottom: spacing[3],
  },
  cardSelected: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primaryMuted },
  iconWrap: { marginRight: spacing[3] },
  cardContent: { flex: 1 },
  cardTitle: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  cardDesc: { color: colors.text.secondary, fontSize: typography.size.sm, marginTop: 2 },
  skipLink: { alignItems: 'center', marginTop: spacing[4] },
  skipText: { color: colors.text.muted, fontSize: typography.size.sm },
});
