/**
 * RecipeBuilderScreen — 4-step state machine for creating recipes.
 *
 * Steps: NAMING → ADDING_INGREDIENTS → REVIEW → SAVED
 *
 * Client-side nutrition computation:
 *   total = Σ(ingredient.macro * quantity / serving_size)
 *   perServing = total / totalServings
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import api from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'NAMING' | 'ADDING_INGREDIENTS' | 'REVIEW' | 'SAVED';

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  source?: string;
}

interface RecipeIngredient {
  tempId: string;
  foodItem: FoodItem;
  quantity: number;
}

interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

export function computeRecipeNutrition(
  ingredients: RecipeIngredient[],
  totalServings: number,
): { total: Macros; perServing: Macros } {
  const total = ingredients.reduce(
    (acc, ing) => {
      const scale = ing.quantity / ing.foodItem.serving_size;
      return {
        calories: acc.calories + ing.foodItem.calories * scale,
        protein_g: acc.protein_g + ing.foodItem.protein_g * scale,
        carbs_g: acc.carbs_g + ing.foodItem.carbs_g * scale,
        fat_g: acc.fat_g + ing.foodItem.fat_g * scale,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const servings = totalServings > 0 ? totalServings : 1;
  const perServing: Macros = {
    calories: total.calories / servings,
    protein_g: total.protein_g / servings,
    carbs_g: total.carbs_g / servings,
    fat_g: total.fat_g / servings,
  };

  return { total, perServing };
}

let _tempIdCounter = 0;
function nextTempId(): string {
  _tempIdCounter += 1;
  return `tmp_${_tempIdCounter}_${Date.now()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RecipeBuilderScreen({ visible, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('NAMING');

  // NAMING state
  const [recipeName, setRecipeName] = useState('');
  const [description, setDescription] = useState('');
  const [totalServings, setTotalServings] = useState('1');

  // ADDING_INGREDIENTS state
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [quantityInput, setQuantityInput] = useState('100');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SAVING state
  const [saving, setSaving] = useState(false);

  // Computed nutrition
  const servingsNum = parseFloat(totalServings) || 1;
  const { total, perServing } = computeRecipeNutrition(ingredients, servingsNum);

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('food/search', { params: { q: text.trim() } });
        const items = res.data?.items ?? res.data ?? [];
        setSearchResults(Array.isArray(items) ? items : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleAddIngredient = (food: FoodItem) => {
    const qty = parseFloat(quantityInput) || 100;
    setIngredients((prev) => [
      ...prev,
      { tempId: nextTempId(), foodItem: food, quantity: qty },
    ]);
    setSearchQuery('');
    setSearchResults([]);
    setQuantityInput('100');
  };

  const handleRemoveIngredient = (tempId: string) => {
    setIngredients((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleUpdateQuantity = (tempId: string, qty: string) => {
    const num = parseFloat(qty);
    if (!isNaN(num) && num > 0) {
      setIngredients((prev) =>
        prev.map((i) => (i.tempId === tempId ? { ...i, quantity: num } : i)),
      );
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!recipeName.trim()) {
      Alert.alert('Missing name', 'Please enter a recipe name.');
      return;
    }
    if (ingredients.length === 0) {
      Alert.alert('No ingredients', 'Add at least one ingredient.');
      return;
    }
    if (servingsNum <= 0) {
      Alert.alert('Invalid servings', 'Total servings must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await api.post('food/recipes', {
        name: recipeName.trim(),
        description: description.trim() || null,
        total_servings: servingsNum,
        ingredients: ingredients.map((i) => ({
          food_item_id: i.foodItem.id,
          quantity: i.quantity,
          unit: 'g',
        })),
      });
      setStep('SAVED');
    } catch {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────

  const hasUnsavedData = (): boolean => {
    return recipeName.trim() !== '' || ingredients.length > 0;
  };

  const handleClose = () => {
    if (hasUnsavedData()) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved data. Are you sure you want to close?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setStep('NAMING');
              setRecipeName('');
              setDescription('');
              setTotalServings('1');
              setIngredients([]);
              setSearchQuery('');
              setSearchResults([]);
              onClose();
            },
          },
        ],
      );
    } else {
      setStep('NAMING');
      setRecipeName('');
      setDescription('');
      setTotalServings('1');
      setIngredients([]);
      setSearchQuery('');
      setSearchResults([]);
      onClose();
    }
  };

  const handleDone = () => {
    onSaved?.();
    handleClose();
  };

  if (!visible) return null;

  // ── Render steps ───────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'NAMING' && 'New Recipe'}
          {step === 'ADDING_INGREDIENTS' && 'Add Ingredients'}
          {step === 'REVIEW' && 'Review Recipe'}
          {step === 'SAVED' && 'Recipe Saved'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step: NAMING */}
      {step === 'NAMING' && (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Recipe Name</Text>
          <TextInput
            style={styles.input}
            value={recipeName}
            onChangeText={setRecipeName}
            placeholder="e.g. Chicken Fried Rice"
            placeholderTextColor={colors.text.muted}
            maxLength={255}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Notes about this recipe"
            placeholderTextColor={colors.text.muted}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Total Servings</Text>
          <TextInput
            style={styles.input}
            value={totalServings}
            onChangeText={setTotalServings}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={colors.text.muted}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, !recipeName.trim() && styles.btnDisabled]}
            onPress={() => setStep('ADDING_INGREDIENTS')}
            disabled={!recipeName.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryBtnText}>Next: Add Ingredients</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step: ADDING_INGREDIENTS */}
      {step === 'ADDING_INGREDIENTS' && (
        <View style={styles.content}>
          {/* Running totals bar */}
          <View style={styles.totalsBar}>
            <Text style={styles.totalsLabel}>Per Serving:</Text>
            <Text style={styles.totalsValue}>
              {Math.round(perServing.calories)} kcal · {Math.round(perServing.protein_g)}g P ·{' '}
              {Math.round(perServing.carbs_g)}g C · {Math.round(perServing.fat_g)}g F
            </Text>
          </View>

          {/* Search bar */}
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search foods..."
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {/* Search results */}
          {searchLoading && (
            <ActivityIndicator color={colors.accent.primary} style={{ marginVertical: spacing[2] }} />
          )}
          {searchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              <FlatList
                data={searchResults.slice(0, 10)}
                keyExtractor={(item) => item.id}
                style={styles.searchResults}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultRow}
                    onPress={() => handleAddIngredient(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.foodMacros}>
                        {Math.round(item.calories)} kcal · {item.serving_size}{item.serving_unit}
                      </Text>
                    </View>
                    <View style={styles.qtyInputRow}>
                      <TextInput
                        style={styles.qtyInput}
                        value={quantityInput}
                        onChangeText={setQuantityInput}
                        keyboardType="numeric"
                        placeholder="100"
                        placeholderTextColor={colors.text.muted}
                      />
                      <Text style={styles.qtyUnit}>g</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={colors.accent.primary} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Current ingredients list */}
          <Text style={styles.sectionTitle}>
            Ingredients ({ingredients.length})
          </Text>
          <FlatList
            data={ingredients}
            keyExtractor={(item) => item.tempId}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <View style={styles.ingredientRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName} numberOfLines={1}>{item.foodItem.name}</Text>
                  <Text style={styles.foodMacros}>
                    {Math.round(item.foodItem.calories * (item.quantity / item.foodItem.serving_size))} kcal
                  </Text>
                </View>
                <TextInput
                  style={styles.qtyInputSmall}
                  defaultValue={String(item.quantity)}
                  onEndEditing={(e) => handleUpdateQuantity(item.tempId, e.nativeEvent.text)}
                  keyboardType="numeric"
                />
                <Text style={styles.qtyUnit}>g</Text>
                <TouchableOpacity onPress={() => handleRemoveIngredient(item.tempId)}>
                  <Ionicons name="trash-outline" size={20} color={colors.semantic.negative} />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Search and add ingredients above.</Text>
            }
          />

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep('NAMING')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, ingredients.length === 0 && styles.btnDisabled]}
              onPress={() => setStep('REVIEW')}
              disabled={ingredients.length === 0}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step: REVIEW */}
      {step === 'REVIEW' && (
        <ScrollView style={styles.content}>
          <Text style={styles.recipeTitlePreview}>{recipeName}</Text>
          {description ? (
            <Text style={styles.recipeDescPreview}>{description}</Text>
          ) : null}
          <Text style={styles.servingsPreview}>
            {servingsNum} serving{servingsNum !== 1 ? 's' : ''}
          </Text>

          {/* Nutrition summary */}
          <View style={styles.nutritionCard}>
            <Text style={styles.nutritionTitle}>Total Nutrition</Text>
            <Text style={styles.nutritionRow}>
              Calories: {Math.round(total.calories)} kcal
            </Text>
            <Text style={styles.nutritionRow}>
              Protein: {Math.round(total.protein_g * 10) / 10}g
            </Text>
            <Text style={styles.nutritionRow}>
              Carbs: {Math.round(total.carbs_g * 10) / 10}g
            </Text>
            <Text style={styles.nutritionRow}>
              Fat: {Math.round(total.fat_g * 10) / 10}g
            </Text>

            <View style={styles.divider} />
            <Text style={styles.nutritionTitle}>Per Serving</Text>
            <Text style={styles.nutritionRow}>
              Calories: {Math.round(perServing.calories)} kcal
            </Text>
            <Text style={styles.nutritionRow}>
              Protein: {Math.round(perServing.protein_g * 10) / 10}g
            </Text>
            <Text style={styles.nutritionRow}>
              Carbs: {Math.round(perServing.carbs_g * 10) / 10}g
            </Text>
            <Text style={styles.nutritionRow}>
              Fat: {Math.round(perServing.fat_g * 10) / 10}g
            </Text>
          </View>

          {/* Ingredients list */}
          <Text style={styles.sectionTitle}>Ingredients ({ingredients.length})</Text>
          {ingredients.map((ing) => (
            <View key={ing.tempId} style={styles.reviewIngRow}>
              <Text style={styles.foodName} numberOfLines={1}>{ing.foodItem.name}</Text>
              <Text style={styles.foodMacros}>{ing.quantity}g</Text>
            </View>
          ))}

          {/* Actions */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep('ADDING_INGREDIENTS')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.primaryBtnText}>Save Recipe</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Step: SAVED */}
      {step === 'SAVED' && (
        <View style={[styles.content, styles.centeredContent]}>
          <Ionicons name="checkmark-circle" size={64} color={colors.semantic.positive} />
          <Text style={styles.savedTitle}>Recipe Saved!</Text>
          <Text style={styles.savedSubtitle}>
            "{recipeName}" is now available in food search.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleDone}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.surfaceRaised,
  },
  headerTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  centeredContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.size.xs, fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    color: colors.text.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 16,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
    flex: 1,
    marginHorizontal: spacing[1],
  },
  primaryBtnText: {
    fontSize: typography.size.base,
    color: colors.text.primary,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
    flex: 1,
    marginHorizontal: spacing[1],
  },
  secondaryBtnText: {
    fontSize: typography.size.base, fontWeight: typography.weight.regular,
    color: colors.text.secondary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  totalsBar: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  totalsLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  totalsValue: {
    fontSize: typography.size.base,
    color: colors.text.primary,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  searchResultsContainer: {
    maxHeight: 200,
    marginBottom: spacing[2],
  },
  searchResults: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.base,
    gap: spacing[2],
  },
  foodName: {
    fontSize: typography.size.base, fontWeight: typography.weight.regular,
    color: colors.text.primary,
  },
  foodMacros: {
    fontSize: typography.size.xs, fontWeight: typography.weight.regular,
    color: colors.text.muted,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyInput: {
    backgroundColor: colors.bg.base,
    color: colors.text.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    width: 60,
    textAlign: 'center',
    fontSize: 14,
  },
  qtyInputSmall: {
    backgroundColor: colors.bg.surfaceRaised,
    color: colors.text.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    width: 60,
    textAlign: 'center',
    fontSize: 14,
  },
  qtyUnit: {
    fontSize: typography.size.xs, fontWeight: typography.weight.regular,
    color: colors.text.muted,
  },
  sectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.surfaceRaised,
    gap: spacing[2],
  },
  emptyText: {
    fontSize: typography.size.base, fontWeight: typography.weight.regular,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  recipeTitlePreview: {
    fontSize: typography.size['2xl'], fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  recipeDescPreview: {
    fontSize: typography.size.base, fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  servingsPreview: {
    fontSize: typography.size.xs, fontWeight: typography.weight.regular,
    color: colors.text.muted,
    marginBottom: spacing[3],
  },
  nutritionCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  nutritionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  nutritionRow: {
    fontSize: typography.size.base, fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: colors.bg.base,
    marginVertical: spacing[3],
  },
  reviewIngRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.surfaceRaised,
  },
  savedTitle: {
    fontSize: typography.size['2xl'], fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  savedSubtitle: {
    fontSize: typography.size.base, fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
});

export default RecipeBuilderScreen;
