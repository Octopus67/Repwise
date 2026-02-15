import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useOnboardingStore, GoalType } from '../../../store/onboardingSlice';
import { Button } from '../../../components/common/Button';

const GOAL_OPTIONS: { type: GoalType; label: string }[] = [
  { type: 'lose_fat', label: 'Lose Fat' },
  { type: 'build_muscle', label: 'Build Muscle' },
  { type: 'maintain', label: 'Maintain' },
  { type: 'eat_healthier', label: 'Eat Healthier' },
];

interface Props { onComplete: () => void; onBack: () => void; }

export function FastTrackStep({ onComplete, onBack }: Props) {
  const store = useOnboardingStore();
  const [calories, setCalories] = useState(store.manualCalories?.toString() ?? '');
  const [protein, setProtein] = useState(store.manualProtein?.toString() ?? '');
  const [carbs, setCarbs] = useState(store.manualCarbs?.toString() ?? '');
  const [fat, setFat] = useState(store.manualFat?.toString() ?? '');

  const canSubmit = calories.length > 0 && protein.length > 0 && carbs.length > 0 && fat.length > 0 && store.goalType;

  const handleDone = () => {
    store.updateField('manualCalories', Number(calories));
    store.updateField('manualProtein', Number(protein));
    store.updateField('manualCarbs', Number(carbs));
    store.updateField('manualFat', Number(fat));
    store.updateField('fastTrackCompleted', true);
    onComplete();
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Fast Track Setup</Text>
      <Text style={styles.subheading}>Already know your numbers? Enter them directly.</Text>

      <Text style={styles.sectionLabel}>Your Goal</Text>
      <View style={styles.goalRow}>
        {GOAL_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g.type}
            style={[styles.goalChip, store.goalType === g.type && styles.goalChipActive]}
            onPress={() => store.updateField('goalType', g.type)}
            activeOpacity={0.7}
          >
            <Text style={[styles.goalChipText, store.goalType === g.type && styles.goalChipTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Daily Targets</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Calories (kcal)</Text>
        <TextInput
          style={styles.input}
          value={calories}
          onChangeText={setCalories}
          keyboardType="numeric"
          placeholder="e.g. 2200"
          placeholderTextColor={colors.text.muted}
        />
      </View>

      <View style={styles.macroRow}>
        <View style={styles.macroInput}>
          <Text style={styles.inputLabel}>Protein (g)</Text>
          <TextInput
            style={styles.input}
            value={protein}
            onChangeText={setProtein}
            keyboardType="numeric"
            placeholder="150"
            placeholderTextColor={colors.text.muted}
          />
        </View>
        <View style={styles.macroInput}>
          <Text style={styles.inputLabel}>Carbs (g)</Text>
          <TextInput
            style={styles.input}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="numeric"
            placeholder="220"
            placeholderTextColor={colors.text.muted}
          />
        </View>
        <View style={styles.macroInput}>
          <Text style={styles.inputLabel}>Fat (g)</Text>
          <TextInput
            style={styles.input}
            value={fat}
            onChangeText={setFat}
            keyboardType="numeric"
            placeholder="70"
            placeholderTextColor={colors.text.muted}
          />
        </View>
      </View>

      <Button title="Done" onPress={handleDone} disabled={!canSubmit} style={styles.btn} />
      <TouchableOpacity onPress={onBack} style={styles.backLink}>
        <Text style={styles.backText}>← Go back to guided setup</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  sectionLabel: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[2], marginTop: spacing[4] },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  goalChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.surfaceRaised,
  },
  goalChipActive: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primaryMuted },
  goalChipText: { color: colors.text.secondary, fontSize: typography.size.sm },
  goalChipTextActive: { color: colors.accent.primary, fontWeight: typography.weight.medium },
  inputGroup: { marginTop: spacing[3] },
  inputLabel: { color: colors.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[1] },
  input: {
    backgroundColor: colors.bg.surfaceRaised, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[3], color: colors.text.primary, fontSize: typography.size.md,
  },
  macroRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  macroInput: { flex: 1 },
  btn: { marginTop: spacing[6] },
  backLink: { alignItems: 'center', marginTop: spacing[3] },
  backText: { color: colors.text.muted, fontSize: typography.size.sm },
});
