/**
 * AddIngredientsStep — Extracted from RecipeBuilderScreen (Task 8.1)
 *
 * The ADDING_INGREDIENTS step: search bar, results, ingredient list, running totals, navigation.
 */

import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme/tokens';
import type { ThemeColors } from '../../hooks/useThemeColors';
import type { FoodItem, Macros } from '../../types/nutrition';

type IngredientUnit = 'g' | 'oz' | 'cups' | 'tbsp';

const UNIT_OPTIONS: IngredientUnit[] = ['g', 'oz', 'cups', 'tbsp'];

const UNIT_TO_GRAMS: Record<IngredientUnit, number> = {
  g: 1,
  oz: 28.3495,
  cups: 240,
  tbsp: 15,
};

interface RecipeIngredient {
  tempId: string;
  foodItem: FoodItem;
  quantity: number;
  unit: IngredientUnit;
}

interface AddIngredientsStepProps {
  c: ThemeColors;
  perServing: Macros;
  // Search
  searchQuery: string;
  onSearchChange: (text: string) => void;
  searchLoading: boolean;
  searchResults: FoodItem[];
  quantityInput: string;
  onQuantityChange: (text: string) => void;
  selectedUnit: IngredientUnit;
  onSelectUnit: (unit: IngredientUnit) => void;
  onAddIngredient: (food: FoodItem) => void;
  // Ingredients
  ingredients: RecipeIngredient[];
  onRemoveIngredient: (tempId: string) => void;
  onUpdateQuantity: (tempId: string, qty: string) => void;
  onUpdateUnit: (tempId: string, unit: IngredientUnit) => void;
  // Navigation
  onBack: () => void;
  onNext: () => void;
}

export function AddIngredientsStep({
  c,
  perServing,
  searchQuery,
  onSearchChange,
  searchLoading,
  searchResults,
  quantityInput,
  onQuantityChange,
  selectedUnit,
  onSelectUnit,
  onAddIngredient,
  ingredients,
  onRemoveIngredient,
  onUpdateQuantity,
  onUpdateUnit,
  onBack,
  onNext,
}: AddIngredientsStepProps) {
  const styles = getStyles(c);

  return (
    <View style={styles.content}>
      {/* Running totals bar */}
      <View style={[styles.totalsBar, { backgroundColor: c.bg.surfaceRaised }]}>
        <Text style={[styles.totalsLabel, { color: c.text.secondary }]}>Per Serving:</Text>
        <Text style={[styles.totalsValue, { color: c.text.primary }]}>
          {Math.round(perServing.calories)} kcal · {Math.round(perServing.protein_g)}g P ·{' '}
          {Math.round(perServing.carbs_g)}g C · {Math.round(perServing.fat_g)}g F
        </Text>
      </View>

      {/* Search bar + quantity */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search foods..."
          placeholderTextColor={c.text.muted}
        />
        <View style={styles.qtyInputRow}>
          <TextInput
            style={[styles.qtyInput, { color: c.text.primary, backgroundColor: c.bg.base }]}
            value={quantityInput}
            onChangeText={onQuantityChange}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={c.text.muted}
          />
          <View style={styles.unitPicker}>
            {UNIT_OPTIONS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitOption, selectedUnit === u && styles.unitOptionActive]}
                onPress={() => onSelectUnit(u)}
                accessibilityLabel={`Unit: ${u}`}
                accessibilityRole="button"
              >
                <Text style={[styles.unitOptionText, { color: selectedUnit === u ? c.accent.primary : c.text.muted }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Search results */}
      {searchLoading && (
        <ActivityIndicator color={c.accent.primary} style={styles.searchSpinner} />
      )}
      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          <FlatList
            data={searchResults.slice(0, 10)}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={[styles.searchResults, { backgroundColor: c.bg.surfaceRaised }]}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.searchResultRow, { borderBottomColor: c.bg.base }]}
                onPress={() => onAddIngredient(item)}
                activeOpacity={0.7}
              >
                <View style={styles.flexOne}>
                  <Text style={[styles.foodName, { color: c.text.primary }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.foodMacros, { color: c.text.muted }]}>
                    {Math.round(item.calories)} kcal · {item.serving_size}{item.serving_unit}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color={c.accent.primary} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Current ingredients list */}
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>
        Ingredients ({ingredients.length})
      </Text>
      <FlatList
        data={ingredients}
        keyExtractor={(item) => item.tempId}
        keyboardShouldPersistTaps="handled"
        style={styles.flexOne}
        renderItem={({ item }) => (
          <View style={[styles.ingredientRow, { borderBottomColor: c.bg.surfaceRaised }]}>
            <View style={styles.flexOne}>
              <Text style={[styles.foodName, { color: c.text.primary }]} numberOfLines={1}>{item.foodItem.name}</Text>
              <Text style={[styles.foodMacros, { color: c.text.muted }]}>
                {Math.round(item.foodItem.calories * (item.quantity * UNIT_TO_GRAMS[item.unit] / item.foodItem.serving_size))} kcal
              </Text>
            </View>
            <TextInput
              style={[styles.qtyInputSmall, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised }]}
              defaultValue={String(item.quantity)}
              onEndEditing={(e) => onUpdateQuantity(item.tempId, e.nativeEvent.text)}
              keyboardType="numeric"
            />
            <TouchableOpacity
              onPress={() => {
                const idx = UNIT_OPTIONS.indexOf(item.unit);
                onUpdateUnit(item.tempId, UNIT_OPTIONS[(idx + 1) % UNIT_OPTIONS.length]);
              }}
              accessibilityLabel={`Change unit, currently ${item.unit}`}
              accessibilityRole="button"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.unitBadge, { color: c.accent.primary, borderColor: c.accent.primary }]}>{item.unit}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRemoveIngredient(item.tempId)}>
              <Ionicons name="trash-outline" size={20} color={c.semantic.negative} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: c.text.muted }]}>Search and add ingredients above.</Text>
        }
      />

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: c.bg.surfaceRaised }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryBtnText, { color: c.text.secondary }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, ingredients.length === 0 && styles.btnDisabled]}
          onPress={onNext}
          disabled={ingredients.length === 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.primaryBtnText, { color: c.text.primary }]}>Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  content: { flex: 1, padding: spacing[4] },
  flexOne: { flex: 1 },
  searchSpinner: { marginVertical: spacing[2] },
  totalsBar: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  totalsLabel: { fontSize: typography.size.xs, color: c.text.secondary, marginBottom: spacing[1] },
  totalsValue: { fontSize: typography.size.base, color: c.text.primary, fontWeight: '600' },
  searchRow: { flexDirection: 'row', marginBottom: spacing[2] },
  input: {
    backgroundColor: c.bg.surfaceRaised,
    color: c.text.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 16,
  },
  qtyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyInput: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    width: 60,
    textAlign: 'center',
    fontSize: 14,
  },
  unitPicker: { flexDirection: 'row', gap: 2 },
  unitOption: { paddingHorizontal: spacing[1], paddingVertical: 2, borderRadius: radius.sm },
  unitOptionActive: { backgroundColor: c.accent.primaryMuted },
  unitOptionText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  searchResultsContainer: { maxHeight: 200, marginBottom: spacing[2] },
  searchResults: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.md },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderBottomWidth: 1,
    gap: spacing[2],
  },
  foodName: { fontSize: typography.size.base, color: c.text.primary },
  foodMacros: { fontSize: typography.size.xs, color: c.text.muted },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    gap: spacing[2],
  },
  qtyInputSmall: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    width: 60,
    textAlign: 'center',
    fontSize: 14,
  },
  unitBadge: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[1],
    paddingVertical: 1,
    textAlign: 'center',
    overflow: 'hidden',
  },
  emptyText: { fontSize: typography.size.base, textAlign: 'center', paddingVertical: spacing[4] },
  navRow: { flexDirection: 'row', gap: spacing[2], paddingVertical: spacing[3] },
  primaryBtn: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
    flex: 1,
    marginHorizontal: spacing[1],
  },
  primaryBtnText: { fontSize: typography.size.base, fontWeight: '600' },
  secondaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
    flex: 1,
    marginHorizontal: spacing[1],
  },
  secondaryBtnText: { fontSize: typography.size.base },
  btnDisabled: { opacity: 0.5 },
});
