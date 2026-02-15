import React, { useReducer, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { AddNutritionModal } from '../modals/AddNutritionModal';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useStore } from '../../store';
import { Icon } from '../common/Icon';
import api from '../../services/api';
import {
  mealBuilderReducer,
  createInitialState,
  type MealBuilderItem,
  type Macros,
} from '../../utils/mealBuilderLogic';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MealBuilder({ visible, onClose, onSuccess }: Props) {
  const selectedDate = useStore((s) => s.selectedDate);
  const [state, dispatch] = useReducer(mealBuilderReducer, undefined, createInitialState);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  const handleAddItem = useCallback(
    (food: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => {
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          foodName: food.name,
          macros: {
            calories: food.calories,
            protein_g: food.protein_g,
            carbs_g: food.carbs_g,
            fat_g: food.fat_g,
          },
        },
      });
    },
    [],
  );

  const handleRemoveItem = useCallback((tempId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { tempId } });
  }, []);

  const handleUpdateServing = useCallback((tempId: string, text: string) => {
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0.1) {
      dispatch({ type: 'UPDATE_SERVING', payload: { tempId, multiplier: num } });
    }
  }, []);

  const handleSaveMeal = async () => {
    if (state.items.length === 0) {
      Alert.alert('Empty meal', 'Add at least one item before saving.');
      return;
    }
    if (!state.mealName.trim()) {
      Alert.alert('Missing name', 'Please enter a meal name.');
      return;
    }

    setSaving(true);
    try {
      await api.post('nutrition/entries/batch', {
        meal_name: state.mealName.trim(),
        entry_date: selectedDate,
        entries: state.items.map((item) => ({
          calories: Math.round(item.scaledMacros.calories * 10) / 10,
          protein_g: Math.round(item.scaledMacros.protein_g * 10) / 10,
          carbs_g: Math.round(item.scaledMacros.carbs_g * 10) / 10,
          fat_g: Math.round(item.scaledMacros.fat_g * 10) / 10,
        })),
      });
      onSuccess();
      handleClose();
    } catch {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsFavorite = async () => {
    if (state.items.length === 0) {
      Alert.alert('Empty meal', 'Add at least one item before saving as favorite.');
      return;
    }

    setSavingFavorite(true);
    try {
      const totals = state.runningTotals;
      await api.post('meals/favorites', {
        name: state.mealName.trim() || 'Unnamed Meal',
        calories: Math.round(totals.calories * 10) / 10,
        protein_g: Math.round(totals.protein_g * 10) / 10,
        carbs_g: Math.round(totals.carbs_g * 10) / 10,
        fat_g: Math.round(totals.fat_g * 10) / 10,
      });
      Alert.alert('Saved', `"${state.mealName}" saved as favorite.`);
    } catch {
      Alert.alert('Error', 'Failed to save as favorite.');
    } finally {
      setSavingFavorite(false);
    }
  };

  const handleClose = () => {
    dispatch({ type: 'RESET' });
    onClose();
  };

  // ── Food search callback ─────────────────────────────────────────────────
  const handleFoodSearchSuccess = () => {
    // The AddNutritionModal logged a single entry — we intercept and add to builder instead
    // For now, close the search modal. The user adds items via the search.
    setShowFoodSearch(false);
  };

  const renderItem = useCallback(
    ({ item }: { item: MealBuilderItem }) => (
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.foodName}
          </Text>
          <Text style={styles.itemMacros}>
            {Math.round(item.scaledMacros.calories)} cal · {Math.round(item.scaledMacros.protein_g)}P ·{' '}
            {Math.round(item.scaledMacros.carbs_g)}C · {Math.round(item.scaledMacros.fat_g)}F
          </Text>
        </View>
        <View style={styles.itemActions}>
          <TextInput
            style={styles.servingInput}
            value={String(item.servingMultiplier)}
            onChangeText={(text) => handleUpdateServing(item.tempId, text)}
            keyboardType="numeric"
            selectTextOnFocus
          />
          <Text style={styles.servingLabel}>×</Text>
          <TouchableOpacity
            onPress={() => handleRemoveItem(item.tempId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeBtn}><Icon name="close" size={16} /></Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleUpdateServing, handleRemoveItem],
  );

  const { runningTotals } = state;

  return (
    <>
      <ModalContainer visible={visible} onClose={handleClose} title="Build Meal">
        {/* Meal Name Input */}
        <TextInput
          style={styles.mealNameInput}
          value={state.mealName}
          onChangeText={(text) => dispatch({ type: 'SET_MEAL_NAME', payload: text })}
          placeholder="Meal name"
          placeholderTextColor={colors.text.muted}
        />

        {/* Running Totals Bar */}
        <View style={styles.totalsBar}>
          <Text style={styles.totalItem}>
            <Icon name="flame" size={14} /> {Math.round(runningTotals.calories)}
          </Text>
          <Text style={[styles.totalItem, { color: colors.macro.protein }]}>
            P {Math.round(runningTotals.protein_g)}g
          </Text>
          <Text style={[styles.totalItem, { color: colors.macro.carbs }]}>
            C {Math.round(runningTotals.carbs_g)}g
          </Text>
          <Text style={[styles.totalItem, { color: colors.macro.fat ?? colors.text.secondary }]}>
            F {Math.round(runningTotals.fat_g)}g
          </Text>
        </View>

        {/* Meal Item List */}
        {state.items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items yet. Tap "Add Item" to start building your meal.</Text>
          </View>
        ) : (
          <FlatList
            data={state.items}
            keyExtractor={(item) => item.tempId}
            renderItem={renderItem}
            style={styles.list}
          />
        )}

        {/* Add Item Button */}
        <TouchableOpacity
          style={styles.addItemBtn}
          onPress={() => setShowFoodSearch(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addItemBtnText}>+ Add Item</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.saveBtn, state.items.length === 0 && styles.btnDisabled]}
            onPress={handleSaveMeal}
            disabled={saving || state.items.length === 0}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={styles.saveBtnText}>Save Meal</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.favBtn, state.items.length === 0 && styles.btnDisabled]}
            onPress={handleSaveAsFavorite}
            disabled={savingFavorite || state.items.length === 0}
            activeOpacity={0.7}
          >
            {savingFavorite ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={styles.favBtnText}>⭐ Save as Favorite</Text>
            )}
          </TouchableOpacity>
        </View>
      </ModalContainer>

      {/* Food Search Modal — reuses AddNutritionModal for item selection */}
      <AddNutritionModal
        visible={showFoodSearch}
        onClose={() => setShowFoodSearch(false)}
        onSuccess={handleFoodSearchSuccess}
      />
    </>
  );
}


// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  mealNameInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    fontSize: typography.size.base,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  totalsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  totalItem: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  list: {
    maxHeight: 250,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  itemName: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  itemMacros: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  servingInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    color: colors.text.primary,
    fontSize: typography.size.sm,
    width: 48,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  servingLabel: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
  removeBtn: {
    color: colors.semantic.negative ?? '#ef4444',
    fontSize: 16,
    fontWeight: typography.weight.bold,
    paddingHorizontal: spacing[2],
  },
  emptyState: {
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  addItemBtn: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    marginVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
  },
  addItemBtnText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  favBtn: {
    flex: 1,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  favBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
