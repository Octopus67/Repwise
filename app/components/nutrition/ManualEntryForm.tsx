import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

import { countFilledFields, MICRO_FIELDS } from '../../utils/microNutrientSerializer';
import { WaterTracker } from './WaterTracker';
import { incrementGlasses, decrementGlasses } from '../../utils/waterLogic';

interface MacroValues {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
  fibre: string;
  waterGlasses: number;
  microNutrients: Record<string, string>;
  microExpanded: boolean;
}

interface Props {
  values: MacroValues;
  onChange: (field: keyof MacroValues, value: MacroValues[keyof MacroValues]) => void;
  locked?: boolean;
}

export function ManualEntryForm({ values, onChange, locked }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);

  const handleNumericChange = (field: keyof MacroValues, v: string) => {
    if (v !== '' && v !== '-') {
      const n = parseFloat(v);
      if (!isNaN(n) && n < 0) return;
    }
    onChange(field, v);
  };

  return (
    <View>
      {/* Macro Fields */}
      <View style={styles.row}>
        <View style={styles.fieldHalf}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Calories</Text>
          <TextInput style={[styles.input, locked && styles.inputLocked]} value={values.calories}
            onChangeText={(v) => handleNumericChange('calories', v)} keyboardType="numeric" placeholder="kcal"
            placeholderTextColor={c.text.muted} editable={!locked} testID="nutrition-calories-input" />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Protein (g)</Text>
          <TextInput style={[styles.input, locked && styles.inputLocked]} value={values.protein}
            onChangeText={(v) => handleNumericChange('protein', v)} keyboardType="numeric" placeholder="g"
            placeholderTextColor={c.text.muted} editable={!locked} testID="nutrition-protein-input" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.fieldHalf}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Carbs (g)</Text>
          <TextInput style={[styles.input, locked && styles.inputLocked]} value={values.carbs}
            onChangeText={(v) => handleNumericChange('carbs', v)} keyboardType="numeric" placeholder="g"
            placeholderTextColor={c.text.muted} editable={!locked} testID="nutrition-carbs-input" />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Fat (g)</Text>
          <TextInput style={[styles.input, locked && styles.inputLocked]} value={values.fat}
            onChangeText={(v) => handleNumericChange('fat', v)} keyboardType="numeric" placeholder="g"
            placeholderTextColor={c.text.muted} editable={!locked} testID="nutrition-fat-input" />
        </View>
      </View>

      {/* Fibre */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: c.text.secondary }]}>Fibre (g)</Text>
        <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
          value={values.fibre} onChangeText={(v) => handleNumericChange('fibre', v)} keyboardType="numeric" placeholder="g" placeholderTextColor={c.text.muted} />
      </View>

      {/* Water */}
      <WaterTracker glasses={values.waterGlasses}
        onIncrement={() => onChange('waterGlasses', incrementGlasses(values.waterGlasses, 12))}
        onDecrement={() => onChange('waterGlasses', decrementGlasses(values.waterGlasses))} />

      {/* Micronutrients */}
      <View style={styles.microSection}>
        <TouchableOpacity style={styles.microHeader} onPress={() => onChange('microExpanded', !values.microExpanded)} activeOpacity={0.7}>
          <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Micronutrients ({countFilledFields(values.microNutrients)} filled)</Text>
          <Text style={[styles.microChevron, { color: c.text.muted }]}>{values.microExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {values.microExpanded && (
          <View style={styles.microGrid}>
            {MICRO_FIELDS.map((field) => (
              <View key={field.key} style={styles.microFieldHalf}>
                <Text style={[styles.microLabel, { color: c.text.secondary }]}>{field.label}</Text>
                <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                  value={values.microNutrients[field.key] ?? ''} keyboardType="numeric" placeholder="0" placeholderTextColor={c.text.muted}
                  onChangeText={(text) => onChange('microNutrients', { ...values.microNutrients, [field.key]: text })} />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Notes */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: c.text.secondary }]}>Notes (optional)</Text>
        <TextInput style={[styles.input, styles.notesInput]} value={values.notes}
          onChangeText={(v) => onChange('notes', v)} placeholder="e.g. Post-workout meal"
          placeholderTextColor={c.text.muted} multiline />
      </View>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  field: { marginBottom: spacing[3] },
  fieldHalf: { flex: 1 },
  label: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  input: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, padding: spacing[3] },
  inputLocked: { opacity: 0.6, backgroundColor: c.bg.surface },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  sectionLabel: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  microSection: { marginBottom: spacing[3] },
  microHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  microChevron: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] },
  microFieldHalf: { width: '47%' as unknown as number },
  microLabel: { color: c.text.secondary, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
});
