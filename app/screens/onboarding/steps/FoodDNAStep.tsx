import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useOnboardingStore } from '../../../store/onboardingSlice';
import { Button } from '../../../components/common/Button';
import { Icon } from '../../../components/common/Icon';
import { useHaptics } from '../../../hooks/useHaptics';

const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Eggetarian', 'No restrictions'];
const ALLERGIES = ['Dairy', 'Gluten', 'Nuts', 'Soy', 'Eggs', 'Shellfish', 'None'];
const CUISINES = [
  { code: 'IN', label: 'Indian', value: 'indian' },
  { code: 'MED', label: 'Mediterranean', value: 'mediterranean' },
  { code: 'EA', label: 'East Asian', value: 'east_asian' },
  { code: 'LA', label: 'Latin American', value: 'latin_american' },
  { code: 'US', label: 'American', value: 'american' },
  { code: 'EU', label: 'European', value: 'european' },
  { code: 'SEA', label: 'Southeast Asian', value: 'southeast_asian' },
];

interface Props { onNext: () => void; onBack: () => void; onSkip: () => void; }

export function FoodDNAStep({ onNext, onBack, onSkip }: Props) {
  const c = useThemeColors();
  const store = useOnboardingStore();
  const { impact } = useHaptics();

  const toggleChip = (list: string[], item: string, field: 'dietaryRestrictions' | 'allergies' | 'cuisinePreferences') => {
    impact('light');
    const updated = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
    store.updateField(field, updated);
  };

  const handleSkip = () => {
    store.updateField('foodDnaSkipped', true);
    onSkip();
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Your Food DNA</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>Help us personalize your food search from day one</Text>

      <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Dietary Identity</Text>
      <View style={styles.chipRow}>
        {DIETS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, store.dietaryRestrictions.includes(d.toLowerCase().replace(' ', '_')) && styles.chipActive]}
            onPress={() => toggleChip(store.dietaryRestrictions, d.toLowerCase().replace(' ', '_'), 'dietaryRestrictions')}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, store.dietaryRestrictions.includes(d.toLowerCase().replace(' ', '_')) && styles.chipTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Allergies / Intolerances</Text>
      <View style={styles.chipRow}>
        {ALLERGIES.map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.chip, store.allergies.includes(a.toLowerCase()) && styles.chipActive]}
            onPress={() => toggleChip(store.allergies, a.toLowerCase(), 'allergies')}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, store.allergies.includes(a.toLowerCase()) && styles.chipTextActive]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Cuisines You Eat Most</Text>
      <View style={styles.chipRow}>
        {CUISINES.map((cuisine) => (
          <TouchableOpacity
            key={cuisine.value}
            style={[styles.chip, styles.cuisineChip, store.cuisinePreferences.includes(cuisine.value) && styles.chipActive]}
            onPress={() => toggleChip(store.cuisinePreferences, cuisine.value, 'cuisinePreferences')}
            activeOpacity={0.7}
          >
            <View style={[styles.cuisineBadge, { backgroundColor: c.accent.primaryMuted }]}>
              <Text style={[styles.cuisineBadgeText, { color: c.accent.primary }]}>{cuisine.code}</Text>
            </View>
            <Text style={[styles.chipText, store.cuisinePreferences.includes(cuisine.value) && styles.chipTextActive]}>{cuisine.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Meals Per Day</Text>
      <View style={styles.stepperRow}>
        {[2, 3, 4, 5, 6].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.stepperBtn, store.mealFrequency === n && styles.stepperBtnActive]}
            onPress={() => { impact('light'); store.updateField('mealFrequency', n); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.stepperText, store.mealFrequency === n && styles.stepperTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Continue" onPress={onNext} style={styles.btn} />
      <TouchableOpacity onPress={handleSkip} style={styles.skipLink}>
        <Text style={[styles.skipText, { color: c.text.muted }]}>Set this up later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  sectionLabel: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[2], marginTop: spacing[4] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.surfaceRaised,
  },
  chipActive: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primaryMuted },
  chipText: { color: colors.text.secondary, fontSize: typography.size.sm },
  chipTextActive: { color: colors.accent.primary, fontWeight: typography.weight.medium },
  cuisineChip: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cuisineBadge: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[1],
    paddingVertical: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  cuisineBadgeText: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  stepperRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.surfaceRaised,
  },
  stepperBtnActive: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primaryMuted },
  stepperText: { color: colors.text.secondary, fontSize: typography.size.md },
  stepperTextActive: { color: colors.accent.primary, fontWeight: typography.weight.semibold },
  btn: { marginTop: spacing[6] },
  skipLink: { alignItems: 'center', marginTop: spacing[3] },
  skipText: { color: colors.text.muted, fontSize: typography.size.sm },
});
