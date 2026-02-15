import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { colors, typography, spacing } from '../../theme/tokens';
import { computeScaleFactor, scaleIngredients } from '../../utils/mealPrepLogic';
import type { Ingredient } from '../../utils/mealPrepLogic';

interface Props {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  originalCalories: number;
  originalProtein: number;
  originalCarbs: number;
  originalFat: number;
  ingredients: Ingredient[];
  onConfirm: (targetValue: number, targetMacro: string) => void;
}

const MACRO_OPTIONS = ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const;

export function RecipeScalingModal({
  visible,
  onClose,
  originalCalories,
  originalProtein,
  originalCarbs,
  originalFat,
  ingredients,
  onConfirm,
}: Props) {
  const [targetValue, setTargetValue] = useState('');
  const [targetMacro, setTargetMacro] = useState<string>('calories');

  const originalMap: Record<string, number> = {
    calories: originalCalories,
    protein_g: originalProtein,
    carbs_g: originalCarbs,
    fat_g: originalFat,
  };

  const preview = useMemo(() => {
    const val = parseFloat(targetValue);
    if (!val || val <= 0) return null;
    const orig = originalMap[targetMacro];
    if (!orig || orig <= 0) return null;
    try {
      const factor = computeScaleFactor(orig, val);
      const scaled = scaleIngredients(ingredients, factor);
      return {
        factor,
        ingredients: scaled,
        calories: Math.round(originalCalories * factor * 100) / 100,
        protein_g: Math.round(originalProtein * factor * 100) / 100,
        carbs_g: Math.round(originalCarbs * factor * 100) / 100,
        fat_g: Math.round(originalFat * factor * 100) / 100,
      };
    } catch {
      return null;
    }
  }, [targetValue, targetMacro, ingredients]);

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Scale Recipe">
      <View style={styles.content}>
        <Text style={styles.label}>Target Macro</Text>
        <View style={styles.macroRow}>
          {MACRO_OPTIONS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.macroPill, targetMacro === m && styles.macroPillActive]}
              onPress={() => setTargetMacro(m)}
            >
              <Text style={[styles.pillText, targetMacro === m && styles.pillTextActive]}>
                {m.replace('_g', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Target Value</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={targetValue}
          onChangeText={setTargetValue}
          placeholder="e.g. 500"
          placeholderTextColor={colors.text.muted}
        />

        {preview && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Preview (×{preview.factor.toFixed(2)})</Text>
            <Text style={styles.previewMacros}>
              {preview.calories} cal · {preview.protein_g}g P · {preview.carbs_g}g C · {preview.fat_g}g F
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.origLabel}>Original</Text>
          <Text style={styles.origValue}>
            {originalCalories} cal · {originalProtein}g P · {originalCarbs}g C · {originalFat}g F
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, !preview && styles.confirmBtnDisabled]}
          disabled={!preview}
          onPress={() => {
            const val = parseFloat(targetValue);
            if (val > 0) onConfirm(val, targetMacro);
          }}
        >
          <Text style={styles.confirmText}>Apply Scaling</Text>
        </TouchableOpacity>
      </View>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4] },
  label: { fontSize: typography.size.sm, color: colors.text.muted, marginBottom: spacing[1], marginTop: spacing[3] },
  macroRow: { flexDirection: 'row', gap: spacing[2] },
  macroPill: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 16, backgroundColor: colors.bg.surface },
  macroPillActive: { backgroundColor: colors.accent.primary },
  pillText: { fontSize: typography.size.sm, color: colors.text.secondary },
  pillTextActive: { color: colors.text.primary, fontWeight: typography.weight.semibold },
  input: { backgroundColor: colors.bg.surface, borderRadius: 8, padding: spacing[3], color: colors.text.primary, fontSize: typography.size.base },
  preview: { marginTop: spacing[3], padding: spacing[3], backgroundColor: colors.bg.surface, borderRadius: 8 },
  previewTitle: { fontSize: typography.size.sm, color: colors.accent.primary, marginBottom: spacing[1] },
  previewMacros: { fontSize: typography.size.base, color: colors.text.primary },
  row: { marginTop: spacing[2] },
  origLabel: { fontSize: typography.size.xs, color: colors.text.muted },
  origValue: { fontSize: typography.size.sm, color: colors.text.secondary },
  confirmBtn: { marginTop: spacing[4], backgroundColor: colors.accent.primary, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: colors.text.primary, fontWeight: typography.weight.semibold },
});
