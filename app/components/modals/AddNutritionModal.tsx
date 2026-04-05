import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'; // Audit fix 7.6
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, Modal,
} from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { ModalContainer } from '../common/ModalContainer';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '../../services/queryClient';
import api from '../../services/api';
import { serializeMicroNutrients, MICRO_FIELDS } from '../../utils/microNutrientSerializer';
import { ServingOption, buildServingOptions, scaleToServing } from '../../utils/servingOptions';
import { scaleMacros } from '../../utils/macroScaling';
// Audit fix 7.6 — lazy-load camera module
const BarcodeScanner = React.lazy(() => import('../nutrition/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
import { RecipeBuilderScreen } from '../../screens/nutrition/RecipeBuilderScreen';
import { Icon } from '../common/Icon';
import { useStore } from '../../store';
import { MacroBudgetPills } from '../nutrition/MacroBudgetPills';
import { FoodSearchPanel } from '../nutrition/FoodSearchPanel';
import { ManualEntryForm } from '../nutrition/ManualEntryForm';
import { ServingSelector } from '../nutrition/ServingSelector';
import { MealPlanTab } from '../nutrition/MealPlanTab';
import { RecipeTab } from '../nutrition/RecipeTab';
import type { FoodItem, MealFavorite } from '../../types/nutrition';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledMealName?: string;
  onAddItem?: (food: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
}

// Re-export scaleMacros from utility for backward compatibility
export { scaleMacros } from '../../utils/macroScaling';

export function AddNutritionModal({ visible, onClose, onSuccess, prefilledMealName, onAddItem }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const selectedDate = useStore((s) => s.selectedDate);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const adaptiveTargets = useStore((s) => s.adaptiveTargets);

  const saveNutritionMutation = useMutation({
    mutationKey: ['logNutrition'],
    mutationFn: (entry: { entry_date: string; meal_name: string; food_name: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number; client_id: string; client_updated_at: string; food_item_id?: string; notes?: string; micro_nutrients?: Record<string, number> }) => api.post('nutrition/entries', entry),
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: ['nutrition'] });
      const previous = queryClient.getQueryData(['nutrition']);
      const optimisticEntry = {
        id: `temp_${Date.now()}`,
        ...entry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData(['nutrition'], (old: unknown) => {
        if (Array.isArray(old)) return [...old, optimisticEntry];
        if (old && typeof old === 'object' && 'items' in old) {
          const o = old as { items: unknown[] };
          return { ...o, items: [...o.items, optimisticEntry] };
        }
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['nutrition'], context.previous);
      Alert.alert('Save Failed', 'Nutrition entry failed — please try again.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const isLongPressingRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Shared state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'quick' | 'mealPlans' | 'recipes'>('quick');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // ── Manual entry values ──────────────────────────────────────────────
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [notes, setNotes] = useState('');
  const [fibre, setFibre] = useState('');
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [microNutrients, setMicroNutrients] = useState<Record<string, string>>({});
  const [microExpanded, setMicroExpanded] = useState(false);

  // ── Serving state ────────────────────────────────────────────────────
  const [servingMultiplier, setServingMultiplier] = useState('1');
  const [servingOptions, setServingOptions] = useState<ServingOption[]>([]);
  const [selectedServing, setSelectedServing] = useState<ServingOption | null>(null);

  // ── Favorites ────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<MealFavorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  // ── Day totals ───────────────────────────────────────────────────────
  const [dayTotals, setDayTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  // ── Fetch on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (visible && isAuthenticated) { fetchFavorites(); fetchDayTotals(); }
  }, [visible, isAuthenticated]);

  useEffect(() => {
    if (visible && prefilledMealName) setNotes(prefilledMealName);
  }, [visible, prefilledMealName]);

  useEffect(() => () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); }, []);

  const fetchDayTotals = async () => {
    try {
      const res = await api.get('nutrition/entries', { params: { start_date: selectedDate, end_date: selectedDate } });
      const entries = res.data.items ?? [];
      setDayTotals(entries.reduce(
        (acc: typeof dayTotals, e: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }) => ({ calories: acc.calories + (e.calories ?? 0), protein_g: acc.protein_g + (e.protein_g ?? 0), carbs_g: acc.carbs_g + (e.carbs_g ?? 0), fat_g: acc.fat_g + (e.fat_g ?? 0) }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ));
    } catch (err) { console.warn('[AddNutrition] day totals fetch failed:', String(err)); }
  };

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    try { const res = await api.get('meals/favorites', { params: { limit: 50 } }); setFavorites(res.data.items ?? []); }
    catch (err) { console.warn('[AddNutrition] favorites fetch failed:', String(err)); setFavorites([]); }
    finally { setFavoritesLoading(false); }
  };

  // ── Food selection handlers ──────────────────────────────────────────
  const applyServingToFood = (food: FoodItem, opt: ServingOption) => {
    const base = food.serving_size;
    const target = opt.grams;
    setCalories(String(scaleToServing(base, target, food.calories)));
    setProtein(String(scaleToServing(base, target, food.protein_g)));
    setCarbs(String(scaleToServing(base, target, food.carbs_g)));
    setFat(String(scaleToServing(base, target, food.fat_g)));
    if (food.micro_nutrients) {
      const micros: Record<string, string> = {};
      for (const field of MICRO_FIELDS) { const val = food.micro_nutrients?.[field.key]; if (typeof val === 'number' && val > 0) micros[field.key] = String(scaleToServing(base, target, val)); }
      setMicroNutrients(micros);
      const fibreVal = food.micro_nutrients?.fibre_g;
      if (typeof fibreVal === 'number' && fibreVal > 0) setFibre(String(scaleToServing(base, target, fibreVal)));
    }
  };

  const handleSelectFood = (item: FoodItem) => {
    setSelectedFood(item);
    setServingMultiplier('1');
    setNotes(item.name);
    const rawOptions: ServingOption[] | undefined = item.micro_nutrients?._serving_options?.map((o: { label: string; grams: number; is_default?: boolean }) => ({ label: o.label, grams: o.grams, isDefault: o.is_default ?? false }));
    const opts = buildServingOptions(item.serving_size, item.serving_unit, rawOptions);
    setServingOptions(opts);
    const defaultOpt = opts.find((o) => o.isDefault) ?? opts[0];
    setSelectedServing(defaultOpt);
    applyServingToFood(item, defaultOpt);
  };

  const handleServingChange = (opt: ServingOption) => {
    setSelectedServing(opt);
    setServingMultiplier('1');
    if (selectedFood) applyServingToFood(selectedFood, opt);
  };

  const handleMultiplierChange = (text: string) => {
    setServingMultiplier(text);
    const num = parseFloat(text);
    const maxMult = selectedServing?.label === 'Custom (g)' ? 10000 : 99;
    if (selectedFood && !isNaN(num) && num > 0 && num <= maxMult) {
      if (selectedServing) {
        const effectiveGrams = selectedServing.grams * num;
        const base = selectedFood.serving_size;
        setCalories(String(scaleToServing(base, effectiveGrams, selectedFood.calories)));
        setProtein(String(scaleToServing(base, effectiveGrams, selectedFood.protein_g)));
        setCarbs(String(scaleToServing(base, effectiveGrams, selectedFood.carbs_g)));
        setFat(String(scaleToServing(base, effectiveGrams, selectedFood.fat_g)));
        if (selectedFood.micro_nutrients) {
          const micros: Record<string, string> = {};
          for (const field of MICRO_FIELDS) { const val = selectedFood.micro_nutrients?.[field.key]; if (typeof val === 'number' && val > 0) micros[field.key] = String(scaleToServing(base, effectiveGrams, val)); }
          setMicroNutrients(micros);
          const fibreVal = selectedFood.micro_nutrients?.fibre_g;
          if (typeof fibreVal === 'number' && fibreVal > 0) setFibre(String(scaleToServing(base, effectiveGrams, fibreVal)));
        }
      } else {
        const scaled = scaleMacros(selectedFood, num);
        setCalories(String(Math.round(scaled.calories)));
        setProtein(String(Math.round(scaled.protein_g * 10) / 10));
        setCarbs(String(Math.round(scaled.carbs_g * 10) / 10));
        setFat(String(Math.round(scaled.fat_g * 10) / 10));
      }
    }
  };

  const handleBarcodeFoodSelected = (item: FoodItem, mult: number) => {
    setShowBarcodeScanner(false);
    const scaled = scaleMacros(item, mult);
    setCalories(String(Math.round(scaled.calories)));
    setProtein(String(Math.round(scaled.protein_g * 10) / 10));
    setCarbs(String(Math.round(scaled.carbs_g * 10) / 10));
    setFat(String(Math.round(scaled.fat_g * 10) / 10));
    setNotes(item.name || 'Scanned food');
    setSelectedFood(item);
    setServingMultiplier(String(mult));
    setActiveTab('quick');
  };

  // ── Favorites handlers ───────────────────────────────────────────────
  const handleSelectFavorite = (fav: MealFavorite) => {
    setCalories(String(Math.round(fav.calories)));
    setProtein(String(Math.round(fav.protein_g * 10) / 10));
    setCarbs(String(Math.round(fav.carbs_g * 10) / 10));
    setFat(String(Math.round(fav.fat_g * 10) / 10));
    setNotes(fav.name);
    setSelectedFood(null);
  };

  const handleDeleteFavorite = (fav: MealFavorite) => {
    Alert.alert('Remove Favorite', `Remove "${fav.name}" from favorites?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.delete(`meals/favorites/${fav.id}`); setFavorites((prev) => prev.filter((f) => f.id !== fav.id)); }
        catch { Alert.alert('Error', 'Failed to remove favorite.'); }
      }},
    ]);
  };

  const handleSaveAsFavorite = async () => {
    const name = notes.trim() || 'Unnamed meal';
    setSavingFavorite(true);
    try { await api.post('meals/favorites', { name, calories: Number(calories), protein_g: Number(protein), carbs_g: Number(carbs), fat_g: Number(fat) }); Alert.alert('Saved', `"${name}" added to favorites.`); fetchFavorites(); }
    catch { Alert.alert('Error', 'Failed to save favorite.'); }
    finally { setSavingFavorite(false); }
  };

  // ── Form management ──────────────────────────────────────────────────
  const clearForm = () => {
    setCalories(''); setProtein(''); setCarbs(''); setFat(''); setNotes(''); setFibre('');
    setWaterGlasses(0); setMicroNutrients({}); setSelectedFood(null); setServingMultiplier('1');
    setServingOptions([]); setSelectedServing(null);
  };

  const reset = () => {
    clearForm(); setActiveTab('quick'); setShowRecipeBuilder(false); setShowBarcodeScanner(false);
    setSuccessMessage(''); setDayTotals({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }); setMicroExpanded(false);
  };

  const handleSubmit = async () => {
    const hasMacros = calories || protein || carbs || fat;
    const hasWater = waterGlasses > 0;
    if (!hasMacros && !hasWater) { Alert.alert('Nothing to log', 'Please add food or water before saving.'); return; }
    if (hasMacros && (!calories || !protein || !carbs || !fat)) { Alert.alert('Missing fields', 'Please fill in all macro fields.'); return; }
    if (selectedFood) {
      const mult = parseFloat(servingMultiplier);
      const maxMult = selectedServing?.label === 'Custom (g)' ? 10000 : 99;
      if (isNaN(mult) || mult <= 0 || mult > maxMult) { Alert.alert('Invalid amount', `Please enter a value between 1 and ${maxMult}.`); return; }
    }
    try {
      if (onAddItem) {
        onAddItem({
          name: (selectedFood?.name ?? notes.trim()) || 'Quick entry',
          calories: Number(calories) || 0,
          protein_g: Number(protein) || 0,
          carbs_g: Number(carbs) || 0,
          fat_g: Number(fat) || 0,
        });
        clearForm();
        onSuccess();
        return;
      }
      setLoading(true);
      const microPayload = serializeMicroNutrients(microNutrients, fibre, waterGlasses);
      await saveNutritionMutation.mutateAsync({
        entry_date: selectedDate, meal_name: notes.trim() || (hasWater && !hasMacros ? 'Water' : 'Quick entry'),
        food_name: selectedFood?.name ?? null, calories: Number(calories) || 0, protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0, fat_g: Number(fat) || 0,
        client_id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        client_updated_at: new Date().toISOString(),
        ...(selectedFood?.id ? { food_item_id: selectedFood.id } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(Object.keys(microPayload).length > 0 ? { micro_nutrients: microPayload } : {}),
      });
      setSuccessMessage(`${Number(calories) || 0} kcal logged ✓`);
      onSuccess();
      const loggedCal = Number(calories) || 0;
      const loggedPro = Number(protein) || 0;
      const loggedCarb = Number(carbs) || 0;
      const loggedFat = Number(fat) || 0;
      setDayTotals((prev) => ({ calories: prev.calories + loggedCal, protein_g: prev.protein_g + loggedPro, carbs_g: prev.carbs_g + loggedCarb, fat_g: prev.fat_g + loggedFat }));
      clearForm();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(''), 2000);
    } catch { /* onError handles rollback + user notification */ }
    finally { setLoading(false); }
  };

  const hasUnsavedData = (): boolean => calories !== '' || protein !== '' || carbs !== '' || fat !== '' || notes !== '' || waterGlasses > 0;

  const handleClose = () => {
    if (hasUnsavedData()) {
      Alert.alert('Discard changes?', 'You have unsaved data. Are you sure you want to close?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { reset(); onClose(); } },
      ]);
    } else { reset(); onClose(); }
  };

  const handleMacroChange = (field: string, value: string | number | boolean | Record<string, string>) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const setters: Record<string, (v: any) => void> = {
      calories: setCalories, protein: setProtein, carbs: setCarbs, fat: setFat,
      notes: setNotes, fibre: setFibre, waterGlasses: setWaterGlasses,
      microNutrients: setMicroNutrients, microExpanded: setMicroExpanded,
    };
    setters[field]?.(value);
  };

  const handleMealPlanSelect = (macros: { calories: string; protein: string; carbs: string; fat: string; notes: string }) => {
    setCalories(macros.calories); setProtein(macros.protein); setCarbs(macros.carbs); setFat(macros.fat);
    setNotes(macros.notes); setSelectedFood(null); setActiveTab('quick');
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <><ModalContainer visible={visible && !showRecipeBuilder} onClose={handleClose} title={onAddItem ? 'Add Food' : 'Log Nutrition'} testID="add-nutrition-modal" closeButtonTestID="nutrition-cancel-button">
      <ScrollView keyboardShouldPersistTaps="handled">
        <MacroBudgetPills consumed={dayTotals} targets={adaptiveTargets} />

        {successMessage && (
          <View style={styles.successRow}>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity onPress={handleSaveAsFavorite}>
              <Text style={[styles.saveFavLink, { color: c.accent.primary }]}>Save as Favorite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Selector */}
        {!onAddItem && (
          <View style={styles.tabRow}>
            {(['quick', 'mealPlans', 'recipes'] as const).map((tab) => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)} activeOpacity={0.7}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'quick' ? 'Quick Log' : tab === 'mealPlans' ? 'Meal Plans' : 'Recipes'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Meal Plans Tab */}
        {activeTab === 'mealPlans' && <MealPlanTab onSelectPlan={handleMealPlanSelect} onFavoriteSaved={fetchFavorites} />}

        {/* Recipes Tab */}
        {activeTab === 'recipes' && (
          <>
            <TouchableOpacity style={[styles.createPlanBtn, { borderColor: c.accent.primary }]}
              onPress={() => setShowRecipeBuilder(true)} activeOpacity={0.7}>
              <Text style={[styles.createPlanBtnText, { color: c.accent.primary }]}><Icon name="egg" /> Create Recipe</Text>
            </TouchableOpacity>
            <RecipeTab selectedDate={selectedDate} onSuccess={onSuccess}
              onDayTotalsUpdate={(delta) => setDayTotals((prev) => ({ calories: prev.calories + delta.calories, protein_g: prev.protein_g + delta.protein_g, carbs_g: prev.carbs_g + delta.carbs_g, fat_g: prev.fat_g + delta.fat_g }))} />
          </>
        )}

        {/* Quick Log Tab */}
        {activeTab === 'quick' && (
          <View>
            {/* Favorites */}
            {favorites.length > 0 && (
              <View style={styles.favoritesSection}>
                <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>⭐ Favorites</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.favoritesScroll}>
                  {favorites.map((fav) => (
                    <TouchableOpacity key={fav.id} style={[styles.favoriteChip, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                      onPress={() => { if (isLongPressingRef.current) return; handleSelectFavorite(fav); }}
                      onLongPress={() => { isLongPressingRef.current = true; handleDeleteFavorite(fav); setTimeout(() => { isLongPressingRef.current = false; }, 100); }}
                      activeOpacity={0.7}>
                      <Text style={[styles.favoriteChipName, { color: c.text.primary }]} numberOfLines={1}>{fav.name}</Text>
                      <Text style={[styles.favoriteChipCal, { color: c.text.muted }]}>{Math.round(fav.calories)} kcal</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {favoritesLoading && <ActivityIndicator color={c.accent.primary} style={{ marginBottom: spacing[2] }} />}

            {/* Food Search */}
            <FoodSearchPanel onFoodSelected={handleSelectFood} onBarcodePress={() => setShowBarcodeScanner(true)} onManualBarcodeResult={handleSelectFood} />

            {/* Serving Selector */}
            {selectedFood && (
              <ServingSelector food={selectedFood} servingOptions={servingOptions} selectedServing={selectedServing}
                servingMultiplier={servingMultiplier} onServingChange={handleServingChange} onMultiplierChange={handleMultiplierChange} />
            )}

            {/* Manual Entry Form */}
            <ManualEntryForm
              values={{ calories, protein, carbs, fat, notes, fibre, waterGlasses, microNutrients, microExpanded }}
              onChange={handleMacroChange}
              locked={!!selectedFood}
            />
          </View>
        )}
      </ScrollView>

      {activeTab === 'quick' && (
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit} disabled={loading} activeOpacity={0.7} testID="nutrition-submit-button">
          {loading ? <ActivityIndicator color={c.text.primary} /> : <Text style={[styles.submitText, { color: c.text.primary }]}>{onAddItem ? 'Add to Meal' : 'Save'}</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={handleClose} style={styles.doneBtn} activeOpacity={0.7}>
        <Text style={[styles.doneBtnText, { color: c.text.muted }]}>Done</Text>
      </TouchableOpacity>
    </ModalContainer>

    <RecipeBuilderScreen visible={showRecipeBuilder} onClose={() => setShowRecipeBuilder(false)}
      onSaved={() => { setShowRecipeBuilder(false); onSuccess(); }} />

    {Platform.OS !== 'web' && (
      <Modal visible={showBarcodeScanner} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowBarcodeScanner(false)}>
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>}>
          <BarcodeScanner onFoodSelected={handleBarcodeFoodSelected} onClose={() => setShowBarcodeScanner(false)} />
        </Suspense>
      </Modal>
    )}</>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  successRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.semantic.positive + '18', borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3] },
  successText: { color: c.semantic.positive, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium },
  saveFavLink: { color: c.accent.primary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.semibold, textDecorationLine: 'underline' },
  doneBtn: { padding: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  doneBtnText: { color: c.text.muted, fontSize: typography.size.md, lineHeight: typography.lineHeight.md },
  tabRow: { flexDirection: 'row', marginBottom: spacing[3], gap: spacing[2] },
  tab: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, alignItems: 'center', backgroundColor: 'transparent' },
  tabActive: { backgroundColor: c.accent.primaryMuted },
  tabText: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium },
  tabTextActive: { color: c.accent.primary },
  submitBtn: { backgroundColor: c.accent.primary, borderRadius: radius.sm, padding: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: c.text.primary, fontSize: typography.size.md, lineHeight: typography.lineHeight.md, fontWeight: typography.weight.semibold },
  sectionLabel: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  favoritesSection: { marginBottom: spacing[3] },
  favoritesScroll: { marginTop: spacing[1] },
  favoriteChip: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[2], paddingHorizontal: spacing[3], marginRight: spacing[2], minWidth: 100, alignItems: 'center' },
  favoriteChipName: { color: c.text.primary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, maxWidth: 120 },
  favoriteChipCal: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, marginTop: spacing[1] },
  createPlanBtn: { borderRadius: radius.sm, borderWidth: 1, borderColor: c.accent.primary, borderStyle: 'dashed', padding: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  createPlanBtnText: { color: c.accent.primary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium },
});
