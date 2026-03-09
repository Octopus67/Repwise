import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { scaleMacros } from '../../utils/macroScaling';
import api from '../../services/api';

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  total_servings?: number | null;
}

interface Props {
  selectedDate: string;
  onSuccess: () => void;
  onDayTotalsUpdate: (delta: { calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
}

export function RecipeTab({ selectedDate, onSuccess, onDayTotalsUpdate }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);

  const [userRecipes, setUserRecipes] = useState<FoodItem[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<FoodItem | null>(null);
  const [recipeServings, setRecipeServings] = useState('1');
  const [loggingRecipe, setLoggingRecipe] = useState(false);

  const fetchUserRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const res = await api.get('food/recipes', { params: { limit: 50 } });
      setUserRecipes(res.data.items ?? []);
    } catch { setUserRecipes([]); }
    finally { setRecipesLoading(false); }
  }, []);

  useEffect(() => { fetchUserRecipes(); }, [fetchUserRecipes]);

  const handleLogRecipe = async () => {
    if (!selectedRecipe) return;
    const servings = parseFloat(recipeServings);
    if (isNaN(servings) || servings <= 0) { Alert.alert('Invalid servings', 'Please enter a positive number.'); return; }
    setLoggingRecipe(true);
    try {
      const scaled = scaleMacros(selectedRecipe, servings);
      await api.post('nutrition/entries', {
        entry_date: selectedDate, meal_name: selectedRecipe.name, food_name: selectedRecipe.name,
        calories: Math.round(scaled.calories), protein_g: Math.round(scaled.protein_g * 10) / 10,
        carbs_g: Math.round(scaled.carbs_g * 10) / 10, fat_g: Math.round(scaled.fat_g * 10) / 10,
      });
      onDayTotalsUpdate({
        calories: Math.round(scaled.calories), protein_g: Math.round(scaled.protein_g * 10) / 10,
        carbs_g: Math.round(scaled.carbs_g * 10) / 10, fat_g: Math.round(scaled.fat_g * 10) / 10,
      });
      setSelectedRecipe(null); setRecipeServings('1');
      onSuccess();
      Alert.alert('Logged', `${selectedRecipe.name} (${servings} serving${servings !== 1 ? 's' : ''}) logged.`);
    } catch { Alert.alert('Error', 'Failed to log recipe.'); }
    finally { setLoggingRecipe(false); }
  };

  return (
    <View>
      {recipesLoading && <ActivityIndicator color={c.accent.primary} style={{ marginVertical: spacing[3] }} />}

      {!selectedRecipe ? (
        <>
          {userRecipes.map((recipe) => (
            <TouchableOpacity key={recipe.id} style={[styles.planCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
              onPress={() => { setSelectedRecipe(recipe); setRecipeServings('1'); }} activeOpacity={0.7}>
              <Text style={[styles.planCardName, { color: c.text.primary }]} numberOfLines={1}>{recipe.name}</Text>
              <Text style={[styles.planCardMacros, { color: c.text.muted }]}>
                {Math.round(recipe.calories)} kcal · {Math.round(recipe.protein_g)}g P · {Math.round(recipe.carbs_g)}g C · {Math.round(recipe.fat_g)}g F per serving
              </Text>
              {recipe.total_servings ? (
                <Text style={[styles.planCardMacros, { color: c.text.muted }]}>
                  {recipe.total_servings} total serving{recipe.total_servings !== 1 ? 's' : ''}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
          {!recipesLoading && userRecipes.length === 0 && (
            <Text style={[styles.emptyText, { color: c.text.muted }]}>No recipes yet. Create one from the Quick Log tab.</Text>
          )}
        </>
      ) : (
        <View>
          <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Log Recipe</Text>
          <View style={[styles.planCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
            <Text style={[styles.planCardName, { color: c.text.primary }]}>{selectedRecipe.name}</Text>
            <Text style={[styles.planCardMacros, { color: c.text.muted }]}>
              Per serving: {Math.round(selectedRecipe.calories)} kcal · {Math.round(selectedRecipe.protein_g)}g P · {Math.round(selectedRecipe.carbs_g)}g C · {Math.round(selectedRecipe.fat_g)}g F
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Servings Consumed</Text>
          <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={recipeServings} onChangeText={setRecipeServings} keyboardType="numeric" placeholder="1" placeholderTextColor={c.text.muted} />

          {(() => {
            const s = parseFloat(recipeServings) || 0;
            if (s > 0) {
              const scaled = scaleMacros(selectedRecipe, s);
              return (
                <View style={[styles.planAggregate, { backgroundColor: c.accent.primaryMuted }]}>
                  <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>You will log</Text>
                  <Text style={[styles.planAggregateMacros, { color: c.text.primary }]}>
                    {Math.round(scaled.calories)} kcal · {Math.round(scaled.protein_g * 10) / 10}g P · {Math.round(scaled.carbs_g * 10) / 10}g C · {Math.round(scaled.fat_g * 10) / 10}g F
                  </Text>
                </View>
              );
            }
            return null;
          })()}

          <View style={styles.planFormActions}>
            <TouchableOpacity style={[styles.cancelPlanBtn, { borderColor: c.border.default }]}
              onPress={() => setSelectedRecipe(null)} activeOpacity={0.7}>
              <Text style={[styles.cancelPlanBtnText, { color: c.text.muted }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, loggingRecipe && styles.submitBtnDisabled]}
              onPress={handleLogRecipe} disabled={loggingRecipe} activeOpacity={0.7}>
              {loggingRecipe ? <ActivityIndicator color={c.text.primary} /> : <Text style={[styles.submitText, { color: c.text.primary }]}>Log Recipe</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sectionLabel: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  emptyText: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, marginTop: spacing[1], textAlign: 'center' as const },
  planCard: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginBottom: spacing[2] },
  planCardName: { color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, fontWeight: typography.weight.medium, flex: 1 },
  planCardMacros: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, marginTop: spacing[1] },
  planAggregate: { backgroundColor: c.accent.primaryMuted, borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[3] },
  planAggregateMacros: { color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, fontWeight: typography.weight.semibold, marginTop: spacing[1] },
  planFormActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  cancelPlanBtn: { flex: 1, padding: spacing[3], alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default },
  cancelPlanBtnText: { color: c.text.muted, fontSize: typography.size.md, lineHeight: typography.lineHeight.md },
  submitBtn: { backgroundColor: c.accent.primary, borderRadius: radius.sm, padding: spacing[3], alignItems: 'center', flex: 1 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: c.text.primary, fontSize: typography.size.md, lineHeight: typography.lineHeight.md, fontWeight: typography.weight.semibold },
  input: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, padding: spacing[3] },
});
