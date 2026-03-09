import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import type { ServingOption } from '../../utils/servingOptions';

interface FoodItem {
  name: string;
  serving_size: number;
  serving_unit: string;
}

interface Props {
  food: FoodItem;
  servingOptions: ServingOption[];
  selectedServing: ServingOption | null;
  servingMultiplier: string;
  onServingChange: (opt: ServingOption) => void;
  onMultiplierChange: (text: string) => void;
}

export function ServingSelector({
  food, servingOptions, selectedServing, servingMultiplier,
  onServingChange, onMultiplierChange,
}: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);

  return (
    <View>
      {/* Serving Unit Pills */}
      {servingOptions.length > 0 && (
        <View style={styles.servingSelector}>
          <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Serving Size</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {servingOptions.map((opt, i) => (
              <TouchableOpacity key={i}
                style={[styles.servingPill, selectedServing?.label === opt.label && styles.servingPillActive]}
                onPress={() => onServingChange(opt)} activeOpacity={0.7}>
                <Text style={[styles.servingPillText, selectedServing?.label === opt.label && styles.servingPillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Multiplier */}
      <View style={[styles.multiplierSection, { backgroundColor: c.accent.primaryMuted }]}>
        <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Servings of {food.name}</Text>
        <TextInput style={[styles.input, styles.multiplierInput]}
          value={servingMultiplier} onChangeText={onMultiplierChange}
          keyboardType="numeric" placeholder="1" placeholderTextColor={c.text.muted} />
        <Text style={[styles.multiplierHint, { color: c.text.muted }]}>
          {selectedServing
            ? `${selectedServing.grams}${food.serving_unit} per ${selectedServing.label}`
            : `${food.serving_size}${food.serving_unit} per serving`}
        </Text>
      </View>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sectionLabel: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  servingSelector: { marginBottom: spacing[3] },
  servingPill: { height: 28, paddingHorizontal: spacing[3], borderRadius: radius.full, backgroundColor: c.bg.surfaceRaised, justifyContent: 'center', alignItems: 'center', marginRight: spacing[2] },
  servingPillActive: { backgroundColor: c.accent.primaryMuted },
  servingPillText: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium },
  servingPillTextActive: { color: c.accent.primary },
  multiplierSection: { marginBottom: spacing[3], backgroundColor: c.accent.primaryMuted, borderRadius: radius.sm, padding: spacing[3] },
  multiplierInput: { width: 80, textAlign: 'center', marginTop: spacing[1] },
  multiplierHint: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, marginTop: spacing[1] },
  input: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, padding: spacing[3] },
});
