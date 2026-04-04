import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { aggregateMealPlan, MealPlanItem } from '../../utils/mealPlanLogic';
import api from '../../services/api';

interface CustomMeal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  micro_nutrients?: Record<string, unknown> | null;
}

interface Props {
  onSelectPlan: (macros: { calories: string; protein: string; carbs: string; fat: string; notes: string }) => void;
  onFavoriteSaved: () => void;
}

export function MealPlanTab({ onSelectPlan, onFavoriteSaved }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);

  const [customMeals, setCustomMeals] = useState<CustomMeal[]>([]);
  const [customMealsLoading, setCustomMealsLoading] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planItems, setPlanItems] = useState<MealPlanItem[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchCustomMeals = useCallback(async () => {
    setCustomMealsLoading(true);
    try {
      const res = await api.get('meals/custom', { params: { limit: 50 } });
      setCustomMeals(res.data.items ?? []);
    } catch (err) { console.warn('[MealPlanTab] fetch meals failed:', String(err)); setCustomMeals([]); }
    finally { setCustomMealsLoading(false); }
  }, []);

  useEffect(() => { fetchCustomMeals(); }, [fetchCustomMeals]);

  const handleSelectPlan = (meal: CustomMeal) => {
    const items: MealPlanItem[] = (meal.micro_nutrients as Record<string, unknown> | undefined)?._plan_items as MealPlanItem[] ?? [];
    const agg = items.length > 0 ? aggregateMealPlan(items) : { calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g };
    onSelectPlan({
      calories: String(Math.round(agg.calories)),
      protein: String(Math.round(agg.protein_g * 10) / 10),
      carbs: String(Math.round(agg.carbs_g * 10) / 10),
      fat: String(Math.round(agg.fat_g * 10) / 10),
      notes: meal.name,
    });
  };

  const handleFavoritePlan = async (meal: CustomMeal) => {
    try {
      await api.post('meals/favorites', { meal_id: meal.id, name: meal.name, calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g });
      Alert.alert('Saved', `"${meal.name}" added to favorites.`);
      onFavoriteSaved();
    } catch { Alert.alert('Error', 'Failed to save as favorite.'); }
  };

  const handleDeletePlan = (meal: CustomMeal) => {
    Alert.alert('Delete Meal Plan', `Delete "${meal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`meals/custom/${meal.id}`); setCustomMeals((prev) => prev.filter((m) => m.id !== meal.id)); }
        catch { Alert.alert('Error', 'Failed to delete meal plan.'); }
      }},
    ]);
  };

  const handleUpdatePlanItem = (index: number, field: keyof MealPlanItem, value: string) => {
    setPlanItems((prev) => {
      const updated = [...prev];
      if (field === 'name') { updated[index] = { ...updated[index], name: value }; }
      else { updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 }; }
      return updated;
    });
  };

  const handleSavePlan = async () => {
    if (!planName.trim()) { Alert.alert('Missing name', 'Please enter a plan name.'); return; }
    if (planItems.length === 0) { Alert.alert('No items', 'Add at least one item to the plan.'); return; }
    setSavingPlan(true);
    try {
      const agg = aggregateMealPlan(planItems);
      await api.post('meals/custom', { name: planName.trim(), calories: agg.calories, protein_g: agg.protein_g, carbs_g: agg.carbs_g, fat_g: agg.fat_g, micro_nutrients: { _plan_items: planItems } });
      setPlanName(''); setPlanItems([]); setCreatingPlan(false); fetchCustomMeals();
    } catch { Alert.alert('Error', 'Failed to save meal plan.'); }
    finally { setSavingPlan(false); }
  };

  return (
    <View>
      {customMealsLoading && <ActivityIndicator color={c.accent.primary} style={{ marginVertical: spacing[3] }} />}

      {!creatingPlan && (
        <>
          {customMeals.map((meal) => (
            <TouchableOpacity key={meal.id} style={[styles.planCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
              onPress={() => handleSelectPlan(meal)} onLongPress={() => handleDeletePlan(meal)} activeOpacity={0.7}>
              <View style={styles.planCardHeader}>
                <Text style={[styles.planCardName, { color: c.text.primary }]} numberOfLines={1}>{meal.name}</Text>
                <TouchableOpacity onPress={() => handleFavoritePlan(meal)} activeOpacity={0.7}><Text style={styles.planFavIcon}>⭐</Text></TouchableOpacity>
              </View>
              <Text style={[styles.planCardMacros, { color: c.text.muted }]}>
                {Math.round(meal.calories)} kcal · {Math.round(meal.protein_g)}g P · {Math.round(meal.carbs_g)}g C · {Math.round(meal.fat_g)}g F
              </Text>
            </TouchableOpacity>
          ))}
          {!customMealsLoading && customMeals.length === 0 && <Text style={[styles.emptyText, { color: c.text.muted }]}>No saved meal plans yet.</Text>}
          <TouchableOpacity style={[styles.createPlanBtn, { borderColor: c.accent.primary }]}
            onPress={() => { setCreatingPlan(true); setPlanItems([]); setPlanName(''); }} activeOpacity={0.7}>
            <Text style={[styles.createPlanBtnText, { color: c.accent.primary }]}>+ Create New Plan</Text>
          </TouchableOpacity>
        </>
      )}

      {creatingPlan && (
        <View style={styles.planForm}>
          <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Plan Name</Text>
          <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={planName} onChangeText={setPlanName} placeholder="e.g. Post-Workout Meal" placeholderTextColor={c.text.muted} />

          {planItems.map((item, idx) => (
            <View key={idx} style={[styles.planItemCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
              <View style={styles.planItemHeaderRow}>
                <Text style={[styles.planItemIndex, { color: c.text.secondary }]}>Item {idx + 1}</Text>
                <TouchableOpacity onPress={() => setPlanItems((prev) => prev.filter((_, i) => i !== idx))}>
                  <Text style={[styles.planItemRemove, { color: c.semantic.negative }]}><Icon name="close" size={16} /></Text>
                </TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                value={item.name} onChangeText={(v) => handleUpdatePlanItem(idx, 'name', v)} placeholder="Item name" placeholderTextColor={c.text.muted} />
              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.microLabel, { color: c.text.secondary }]}>Calories</Text>
                  <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                    value={item.calories ? String(item.calories) : ''} onChangeText={(v) => handleUpdatePlanItem(idx, 'calories', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={c.text.muted} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.microLabel, { color: c.text.secondary }]}>Protein (g)</Text>
                  <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                    value={item.protein_g ? String(item.protein_g) : ''} onChangeText={(v) => handleUpdatePlanItem(idx, 'protein_g', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={c.text.muted} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.microLabel, { color: c.text.secondary }]}>Carbs (g)</Text>
                  <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                    value={item.carbs_g ? String(item.carbs_g) : ''} onChangeText={(v) => handleUpdatePlanItem(idx, 'carbs_g', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={c.text.muted} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.microLabel, { color: c.text.secondary }]}>Fat (g)</Text>
                  <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                    value={item.fat_g ? String(item.fat_g) : ''} onChangeText={(v) => handleUpdatePlanItem(idx, 'fat_g', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={c.text.muted} />
                </View>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={[styles.microLabel, { color: c.text.secondary }]}>Serving ×</Text>
                <TextInput style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                  value={item.serving_multiplier ? String(item.serving_multiplier) : ''} onChangeText={(v) => handleUpdatePlanItem(idx, 'serving_multiplier', v)} keyboardType="numeric" placeholder="1" placeholderTextColor={c.text.muted} />
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.addItemBtn, { borderColor: c.border.default }]}
            onPress={() => setPlanItems((prev) => [...prev, { name: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, serving_multiplier: 1 }])} activeOpacity={0.7}>
            <Text style={[styles.addItemBtnText, { color: c.text.secondary }]}>+ Add Item</Text>
          </TouchableOpacity>

          {planItems.length > 0 && (
            <View style={[styles.planAggregate, { backgroundColor: c.accent.primaryMuted }]}>
              <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Running Total</Text>
              {(() => { const agg = aggregateMealPlan(planItems); return (
                <Text style={[styles.planAggregateMacros, { color: c.text.primary }]}>
                  {Math.round(agg.calories)} kcal · {Math.round(agg.protein_g)}g P · {Math.round(agg.carbs_g)}g C · {Math.round(agg.fat_g)}g F
                </Text>
              ); })()}
            </View>
          )}

          <View style={styles.planFormActions}>
            <TouchableOpacity style={[styles.cancelPlanBtn, { borderColor: c.border.default }]}
              onPress={() => { setCreatingPlan(false); setPlanItems([]); setPlanName(''); }} activeOpacity={0.7}>
              <Text style={[styles.cancelPlanBtnText, { color: c.text.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, savingPlan && styles.submitBtnDisabled]}
              onPress={handleSavePlan} disabled={savingPlan} activeOpacity={0.7}>
              {savingPlan ? <ActivityIndicator color={c.text.primary} /> : <Text style={[styles.submitText, { color: c.text.primary }]}>Save Plan</Text>}
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
  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planCardName: { color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, fontWeight: typography.weight.medium, flex: 1 },
  planFavIcon: { fontSize: typography.size.md, lineHeight: typography.lineHeight.md, marginLeft: spacing[2] },
  planCardMacros: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, marginTop: spacing[1] },
  createPlanBtn: { borderRadius: radius.sm, borderWidth: 1, borderColor: c.accent.primary, borderStyle: 'dashed', padding: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  createPlanBtnText: { color: c.accent.primary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium },
  planForm: { marginTop: spacing[2] },
  planItemCard: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginTop: spacing[2], gap: spacing[2] },
  planItemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planItemIndex: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium },
  planItemRemove: { color: c.semantic.negative, fontSize: typography.size.md, lineHeight: typography.lineHeight.md, padding: spacing[1] },
  addItemBtn: { borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, padding: spacing[2], alignItems: 'center', marginTop: spacing[2] },
  addItemBtnText: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  planAggregate: { backgroundColor: c.accent.primaryMuted, borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[3] },
  planAggregateMacros: { color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, fontWeight: typography.weight.semibold, marginTop: spacing[1] },
  planFormActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  cancelPlanBtn: { flex: 1, padding: spacing[3], alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default },
  cancelPlanBtnText: { color: c.text.muted, fontSize: typography.size.md, lineHeight: typography.lineHeight.md },
  submitBtn: { backgroundColor: c.accent.primary, borderRadius: radius.sm, padding: spacing[3], alignItems: 'center', flex: 1 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: c.text.primary, fontSize: typography.size.md, lineHeight: typography.lineHeight.md, fontWeight: typography.weight.semibold },
  row: { flexDirection: 'row', gap: spacing[3] },
  fieldHalf: { flex: 1 },
  microLabel: { color: c.text.secondary, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  input: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, padding: spacing[3] },
});
