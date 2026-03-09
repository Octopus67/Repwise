import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [targetValue, setTargetValue] = useState('');
  const [targetMacro, setTargetMacro] = useState<string>('calories');

  // Reset state when modal closes so it's fresh on next open
  useEffect(() => {
    if (!visible) {
      setTargetValue('');
      setTargetMacro('calories');
    }
  }, [visible]);

  const preview = useMemo(() => {
    const originalMap: Record<string, number> = {
      calories: originalCalories,
      protein_g: originalProtein,
      carbs_g: originalCarbs,
      fat_g: originalFat,
    };
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
  }, [targetValue, targetMacro, ingredients, originalCalories, originalProtein, originalCarbs, originalFat]);

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Scale Recipe">
      <View style={styles.content}>
        <Text style={[styles.label, { color: c.text.muted }]}>Target Macro</Text>
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

        <Text style={[styles.label, { color: c.text.muted }]}>Target Value</Text>
        <TextInput
          style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surface }]}
          keyboardType="numeric"
          value={targetValue}
          onChangeText={setTargetValue}
          placeholder="e.g. 500"
          placeholderTextColor={c.text.muted}
        />

        {preview && (
          <View style={[styles.preview, { backgroundColor: c.bg.surface }]}>
            <Text style={[styles.previewTitle, { color: c.accent.primary }]}>Preview (×{preview.factor.toFixed(2)})</Text>
            <Text style={[styles.previewMacros, { color: c.text.primary }]}>
              {preview.calories} cal · {preview.protein_g}g P · {preview.carbs_g}g C · {preview.fat_g}g F
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={[styles.origLabel, { color: c.text.muted }]}>Original</Text>
          <Text style={[styles.origValue, { color: c.text.secondary }]}>
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
          <Text style={[styles.confirmText, { color: c.text.primary }]}>Apply Scaling</Text>
        </TouchableOpacity>
      </View>
    </ModalContainer>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  content: { padding: spacing[4] },
  label: { fontSize: typography.size.sm, color: c.text.muted, marginBottom: spacing[1], marginTop: spacing[3] },
  macroRow: { flexDirection: 'row', gap: spacing[2] },
  macroPill: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 16, backgroundColor: c.bg.surface },
  macroPillActive: { backgroundColor: c.accent.primary },
  pillText: { fontSize: typography.size.sm, color: c.text.secondary },
  pillTextActive: { color: c.text.primary, fontWeight: typography.weight.semibold },
  input: { backgroundColor: c.bg.surface, borderRadius: 8, padding: spacing[3], color: c.text.primary, fontSize: typography.size.base },
  preview: { marginTop: spacing[3], padding: spacing[3], backgroundColor: c.bg.surface, borderRadius: 8 },
  previewTitle: { fontSize: typography.size.sm, color: c.accent.primary, marginBottom: spacing[1] },
  previewMacros: { fontSize: typography.size.base, color: c.text.primary },
  row: { marginTop: spacing[2] },
  origLabel: { fontSize: typography.size.xs, color: c.text.muted },
  origValue: { fontSize: typography.size.sm, color: c.text.secondary },
  confirmBtn: { marginTop: spacing[4], backgroundColor: c.accent.primary, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: c.text.primary, fontWeight: typography.weight.semibold },
});
