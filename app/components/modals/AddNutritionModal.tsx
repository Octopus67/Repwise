import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { ModalContainer } from '../common/ModalContainer';
import api from '../../services/api';
import { WaterTracker } from '../nutrition/WaterTracker';
import { incrementGlasses, decrementGlasses } from '../../utils/waterLogic';
import {
  serializeMicroNutrients,
  countFilledFields,
  MICRO_FIELDS,
} from '../../utils/microNutrientSerializer';
import { aggregateMealPlan, MealPlanItem } from '../../utils/mealPlanLogic';
import {
  ServingOption,
  buildServingOptions,
  scaleToServing,
} from '../../utils/servingOptions';
import { SourceBadge } from '../nutrition/SourceBadge';
import { BarcodeScanner } from '../nutrition/BarcodeScanner';
import { RecipeBuilderScreen } from '../../screens/nutrition/RecipeBuilderScreen';
import { Icon } from '../common/Icon';
import { useStore } from '../../store';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { resolveScannerMode } from '../../utils/barcodeUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  micro_nutrients?: Record<string, any> | null;
  source?: 'usda' | 'verified' | 'community' | 'custom';
  is_recipe?: boolean;
  total_servings?: number | null;
}

interface MealFavorite {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

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
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledMealName?: string;
}

// ─── Pure helper: scale macros by multiplier ─────────────────────────────────

export function scaleMacros(
  base: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  multiplier: number,
) {
  return {
    calories: base.calories * multiplier,
    protein_g: base.protein_g * multiplier,
    carbs_g: base.carbs_g * multiplier,
    fat_g: base.fat_g * multiplier,
  };
}

export function AddNutritionModal({ visible, onClose, onSuccess, prefilledMealName }: Props) {
  const selectedDate = useStore((s) => s.selectedDate);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  // ── Manual entry state ───────────────────────────────────────────────────
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Micronutrient, fibre, water state ──────────────────────────────────
  const [fibre, setFibre] = useState('');
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [microNutrients, setMicroNutrients] = useState<Record<string, string>>({});
  const [microExpanded, setMicroExpanded] = useState(false);

  // ── Food search state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingMultiplier, setServingMultiplier] = useState('1');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchEmpty, setSearchEmpty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Serving options state ────────────────────────────────────────────────
  const [servingOptions, setServingOptions] = useState<ServingOption[]>([]);
  const [selectedServing, setSelectedServing] = useState<ServingOption | null>(null);

  // ── Favorites state ──────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<MealFavorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'quick' | 'mealPlans' | 'recipes'>('quick');

  // ── Recipe builder state ────────────────────────────────────────────────
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);

  // ── Barcode scanner state ──────────────────────────────────────────────
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showManualBarcode, setShowManualBarcode] = useState(false);
  const [manualBarcodeValue, setManualBarcodeValue] = useState('');
  const [manualBarcodeError, setManualBarcodeError] = useState('');
  const [manualBarcodeLoading, setManualBarcodeLoading] = useState(false);
  const { enabled: cameraFlagEnabled } = useFeatureFlag('camera_barcode_scanner');

  // ── Recipe logging state ────────────────────────────────────────────────
  const [userRecipes, setUserRecipes] = useState<FoodItem[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<FoodItem | null>(null);
  const [recipeServings, setRecipeServings] = useState('1');
  const [loggingRecipe, setLoggingRecipe] = useState(false);

  // ── Meal plan state ──────────────────────────────────────────────────────
  const [customMeals, setCustomMeals] = useState<CustomMeal[]>([]);
  const [customMealsLoading, setCustomMealsLoading] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planItems, setPlanItems] = useState<MealPlanItem[]>([]);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // ── Fetch favorites on modal open ────────────────────────────────────────
  useEffect(() => {
    if (visible && isAuthenticated) {
      fetchFavorites();
    }
  }, [visible, isAuthenticated]);

  // ── Pre-fill meal name when provided ─────────────────────────────────────
  useEffect(() => {
    if (visible && prefilledMealName) {
      setNotes(prefilledMealName);
    }
  }, [visible, prefilledMealName]);

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const res = await api.get('meals/favorites', { params: { limit: 50 } });
      setFavorites(res.data.items ?? []);
    } catch {
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  };

  // ── Fetch custom meals when switching to meal plans tab ──────────────────
  const fetchCustomMeals = useCallback(async () => {
    setCustomMealsLoading(true);
    try {
      const res = await api.get('meals/custom', { params: { limit: 50 } });
      setCustomMeals(res.data.items ?? []);
    } catch {
      setCustomMeals([]);
    } finally {
      setCustomMealsLoading(false);
    }
  }, []);

  const fetchUserRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const res = await api.get('food/recipes', { params: { limit: 50 } });
      setUserRecipes(res.data.items ?? []);
    } catch {
      setUserRecipes([]);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'mealPlans') {
      fetchCustomMeals();
    }
    if (activeTab === 'recipes') {
      fetchUserRecipes();
    }
  }, [activeTab, fetchCustomMeals, fetchUserRecipes]);

  const handleSelectPlan = (meal: CustomMeal) => {
    const items: MealPlanItem[] = (meal.micro_nutrients as any)?._plan_items ?? [];
    const agg = items.length > 0 ? aggregateMealPlan(items) : {
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
    };
    setCalories(String(Math.round(agg.calories)));
    setProtein(String(Math.round(agg.protein_g * 10) / 10));
    setCarbs(String(Math.round(agg.carbs_g * 10) / 10));
    setFat(String(Math.round(agg.fat_g * 10) / 10));
    setNotes(meal.name);
    setSelectedFood(null);
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('quick');
  };

  const handleFavoritePlan = async (meal: CustomMeal) => {
    try {
      await api.post('meals/favorites', {
        meal_id: meal.id,
        name: meal.name,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
      });
      Alert.alert('Saved', `"${meal.name}" added to favorites.`);
      fetchFavorites();
    } catch {
      Alert.alert('Error', 'Failed to save as favorite.');
    }
  };

  const handleDeletePlan = (meal: CustomMeal) => {
    Alert.alert(
      'Delete Meal Plan',
      `Delete "${meal.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`meals/custom/${meal.id}`);
              setCustomMeals((prev) => prev.filter((m) => m.id !== meal.id));
            } catch {
              Alert.alert('Error', 'Failed to delete meal plan.');
            }
          },
        },
      ],
    );
  };

  const handleAddPlanItem = () => {
    setPlanItems((prev) => [
      ...prev,
      { name: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, serving_multiplier: 1 },
    ]);
  };

  const handleUpdatePlanItem = (index: number, field: keyof MealPlanItem, value: string) => {
    setPlanItems((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value };
      } else {
        const num = parseFloat(value) || 0;
        updated[index] = { ...updated[index], [field]: num };
      }
      return updated;
    });
  };

  const handleRemovePlanItem = (index: number) => {
    setPlanItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePlan = async () => {
    if (!planName.trim()) {
      Alert.alert('Missing name', 'Please enter a plan name.');
      return;
    }
    if (planItems.length === 0) {
      Alert.alert('No items', 'Add at least one item to the plan.');
      return;
    }
    setSavingPlan(true);
    try {
      const agg = aggregateMealPlan(planItems);
      await api.post('meals/custom', {
        name: planName.trim(),
        calories: agg.calories,
        protein_g: agg.protein_g,
        carbs_g: agg.carbs_g,
        fat_g: agg.fat_g,
        micro_nutrients: { _plan_items: planItems },
      });
      setPlanName('');
      setPlanItems([]);
      setCreatingPlan(false);
      fetchCustomMeals();
    } catch {
      Alert.alert('Error', 'Failed to save meal plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  // ── Barcode scan result handler ─────────────────────────────────────────
  const handleBarcodeFoodSelected = (item: any, mult: number) => {
    setShowBarcodeScanner(false);
    // Populate the form with scanned food data
    const scaled = scaleMacros(item, mult);
    setCalories(String(Math.round(scaled.calories)));
    setProtein(String(Math.round(scaled.protein_g * 10) / 10));
    setCarbs(String(Math.round(scaled.carbs_g * 10) / 10));
    setFat(String(Math.round(scaled.fat_g * 10) / 10));
    setNotes(item.name || 'Scanned food');
    setSelectedFood(item);
    setServingMultiplier(String(mult));
    setSearchQuery(item.name || '');
    setSearchResults([]);
    setActiveTab('quick');
  };

  // ── Manual barcode entry (web) ──────────────────────────────────────────
  const handleManualBarcodeEntry = async (barcode: string) => {
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await api.get(`food/barcode/${barcode}`);
      if (res.data?.found && res.data?.food_item) {
        handleSelectFood(res.data.food_item);
      } else {
        setSearchError('No food found for this barcode. Try searching by name.');
      }
    } catch {
      setSearchError('Barcode lookup failed. Try searching by name.');
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Recipe logging ───────────────────────────────────────────────────────
  const handleSelectRecipe = (recipe: FoodItem) => {
    setSelectedRecipe(recipe);
    setRecipeServings('1');
  };

  const handleLogRecipe = async () => {
    if (!selectedRecipe) return;
    const servings = parseFloat(recipeServings);
    if (isNaN(servings) || servings <= 0) {
      Alert.alert('Invalid servings', 'Please enter a positive number.');
      return;
    }

    setLoggingRecipe(true);
    try {
      const scaled = scaleMacros(selectedRecipe, servings);
      await api.post('nutrition/entries', {
        entry_date: selectedDate,
        meal_name: selectedRecipe.name,
        calories: Math.round(scaled.calories),
        protein_g: Math.round(scaled.protein_g * 10) / 10,
        carbs_g: Math.round(scaled.carbs_g * 10) / 10,
        fat_g: Math.round(scaled.fat_g * 10) / 10,
      });
      setSelectedRecipe(null);
      setRecipeServings('1');
      onSuccess();
      Alert.alert('Logged', `${selectedRecipe.name} (${servings} serving${servings !== 1 ? 's' : ''}) logged.`);
    } catch {
      Alert.alert('Error', 'Failed to log recipe.');
    } finally {
      setLoggingRecipe(false);
    }
  };

  // ── Debounced food search ────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setSearchError('');
    setSearchEmpty(false);

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
        const safeItems = Array.isArray(items) ? items : [];
        setSearchResults(safeItems);
        setSearchEmpty(safeItems.length === 0);
        setSearchError('');
      } catch {
        setSearchError('Search failed. You can still enter macros manually.');
        setSearchResults([]);
        setSearchEmpty(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleSelectFood = (item: FoodItem) => {
    setSelectedFood(item);
    setServingMultiplier('1');
    setSearchResults([]);
    setSearchQuery(item.name);
    setNotes(item.name);

    // Build serving options from food data
    const rawOptions: ServingOption[] | undefined =
      item.micro_nutrients?._serving_options?.map((o: any) => ({
        label: o.label,
        grams: o.grams,
        isDefault: o.is_default ?? false,
      }));
    const opts = buildServingOptions(item.serving_size, item.serving_unit, rawOptions);
    setServingOptions(opts);

    // Select the default option
    const defaultOpt = opts.find((o) => o.isDefault) ?? opts[0];
    setSelectedServing(defaultOpt);

    // Apply macros scaled to the default serving
    applyServingToFood(item, defaultOpt);
  };

  const applyServingToFood = (food: FoodItem, opt: ServingOption) => {
    const base = food.serving_size;
    const target = opt.grams;

    setCalories(String(scaleToServing(base, target, food.calories)));
    setProtein(String(scaleToServing(base, target, food.protein_g)));
    setCarbs(String(scaleToServing(base, target, food.carbs_g)));
    setFat(String(scaleToServing(base, target, food.fat_g)));

    // Scale micronutrients
    if (food.micro_nutrients) {
      const micros: Record<string, string> = {};
      for (const field of MICRO_FIELDS) {
        const val = food.micro_nutrients?.[field.key];
        if (val && val > 0) {
          micros[field.key] = String(scaleToServing(base, target, val));
        }
      }
      setMicroNutrients(micros);

      const fibreVal = food.micro_nutrients?.fibre_g;
      if (fibreVal && fibreVal > 0) {
        setFibre(String(scaleToServing(base, target, fibreVal)));
      }
    }
  };

  const handleServingChange = (opt: ServingOption) => {
    setSelectedServing(opt);
    setServingMultiplier('1');
    if (selectedFood) {
      applyServingToFood(selectedFood, opt);
    }
  };

  const applyFoodMacros = (food: FoodItem, multiplier: number) => {
    const scaled = scaleMacros(food, multiplier);
    setCalories(String(Math.round(scaled.calories)));
    setProtein(String(Math.round(scaled.protein_g * 10) / 10));
    setCarbs(String(Math.round(scaled.carbs_g * 10) / 10));
    setFat(String(Math.round(scaled.fat_g * 10) / 10));

    // Scale micronutrients by the same multiplier
    if (food.micro_nutrients) {
      const micros: Record<string, string> = {};
      for (const field of MICRO_FIELDS) {
        const val = food.micro_nutrients?.[field.key];
        if (val && val > 0) {
          micros[field.key] = String(Math.round(val * multiplier * 10) / 10);
        }
      }
      setMicroNutrients(micros);

      const fibreVal = food.micro_nutrients?.fibre_g;
      if (fibreVal && fibreVal > 0) {
        setFibre(String(Math.round(fibreVal * multiplier * 10) / 10));
      }
    }
  };

  const handleMultiplierChange = (text: string) => {
    setServingMultiplier(text);
    const num = parseFloat(text);
    const maxMult = selectedServing?.label === 'Custom (g)' ? 9999 : 99;
    if (selectedFood && !isNaN(num) && num > 0 && num <= maxMult) {
      if (selectedServing) {
        // Scale from base serving to (selectedServing * multiplier)
        const effectiveGrams = selectedServing.grams * num;
        const base = selectedFood.serving_size;
        setCalories(String(scaleToServing(base, effectiveGrams, selectedFood.calories)));
        setProtein(String(scaleToServing(base, effectiveGrams, selectedFood.protein_g)));
        setCarbs(String(scaleToServing(base, effectiveGrams, selectedFood.carbs_g)));
        setFat(String(scaleToServing(base, effectiveGrams, selectedFood.fat_g)));

        if (selectedFood.micro_nutrients) {
          const micros: Record<string, string> = {};
          for (const field of MICRO_FIELDS) {
            const val = selectedFood.micro_nutrients?.[field.key];
            if (val && val > 0) {
              micros[field.key] = String(scaleToServing(base, effectiveGrams, val));
            }
          }
          setMicroNutrients(micros);

          const fibreVal = selectedFood.micro_nutrients?.fibre_g;
          if (fibreVal && fibreVal > 0) {
            setFibre(String(scaleToServing(base, effectiveGrams, fibreVal)));
          }
        }
      } else {
        applyFoodMacros(selectedFood, num);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setServingMultiplier('1');
    setServingOptions([]);
    setSelectedServing(null);
    setSearchError('');
  };

  const handleSelectFavorite = (fav: MealFavorite) => {
    setCalories(String(Math.round(fav.calories)));
    setProtein(String(Math.round(fav.protein_g * 10) / 10));
    setCarbs(String(Math.round(fav.carbs_g * 10) / 10));
    setFat(String(Math.round(fav.fat_g * 10) / 10));
    setNotes(fav.name);
    setSelectedFood(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleDeleteFavorite = (fav: MealFavorite) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${fav.name}" from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`meals/favorites/${fav.id}`);
              setFavorites((prev) => prev.filter((f) => f.id !== fav.id));
            } catch {
              Alert.alert('Error', 'Failed to remove favorite.');
            }
          },
        },
      ],
    );
  };

  const handleSaveAsFavorite = async () => {
    const name = notes.trim() || 'Unnamed meal';
    setSavingFavorite(true);
    try {
      await api.post('meals/favorites', {
        name,
        calories: Number(calories),
        protein_g: Number(protein),
        carbs_g: Number(carbs),
        fat_g: Number(fat),
      });
      Alert.alert('Saved', `"${name}" added to favorites.`);
      fetchFavorites();
    } catch {
      Alert.alert('Error', 'Failed to save favorite.');
    } finally {
      setSavingFavorite(false);
    }
  };

  const clearForm = () => {
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setNotes('');
    setFibre('');
    setWaterGlasses(0);
    setMicroNutrients({});
    setMicroExpanded(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setServingMultiplier('1');
    setSearchError('');
    setSearchEmpty(false);
    setServingOptions([]);
    setSelectedServing(null);
    setSelectedRecipe(null);
    setRecipeServings('1');
    setPlanName('');
    setPlanItems([]);
    setCreatingPlan(false);
  };

  const reset = () => {
    clearForm();
    setActiveTab('quick');
    setShowRecipeBuilder(false);
    setShowBarcodeScanner(false);
    setShowManualBarcode(false);
    setManualBarcodeValue('');
    setManualBarcodeError('');
    setManualBarcodeLoading(false);
    setUserRecipes([]);
    setSuccessMessage('');
  };

  const handleSubmit = async () => {
    // Allow water-only saves (no macros required if water was logged)
    const hasMacros = calories || protein || carbs || fat;
    const hasWater = waterGlasses > 0;

    if (!hasMacros && !hasWater) {
      Alert.alert('Nothing to log', 'Please add food or water before saving.');
      return;
    }

    if (hasMacros && (!calories || !protein || !carbs || !fat)) {
      Alert.alert('Missing fields', 'Please fill in all macro fields.');
      return;
    }

    if (selectedFood) {
      const mult = parseFloat(servingMultiplier);
      const maxMult = selectedServing?.label === 'Custom (g)' ? 9999 : 99;
      if (isNaN(mult) || mult <= 0 || mult > maxMult) {
        Alert.alert('Invalid amount', `Please enter a value between 1 and ${maxMult}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const microPayload = serializeMicroNutrients(microNutrients, fibre, waterGlasses);
      await api.post('nutrition/entries', {
        entry_date: selectedDate,
        meal_name: notes.trim() || (hasWater && !hasMacros ? 'Water' : 'Quick entry'),
        calories: Number(calories) || 0,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(Object.keys(microPayload).length > 0 ? { micro_nutrients: microPayload } : {}),
      });
      setSuccessMessage(`${calories} kcal logged ✓`);
      onSuccess();
      clearForm();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(''), 2000);
    } catch {
      Alert.alert('Error', 'Failed to log nutrition entry.');
    } finally {
      setLoading(false);
    }
  };

  const hasUnsavedData = (): boolean => {
    return (
      calories !== '' ||
      protein !== '' ||
      carbs !== '' ||
      fat !== '' ||
      notes !== '' ||
      searchQuery !== '' ||
      waterGlasses > 0
    );
  };

  const handleClose = () => {
    if (hasUnsavedData()) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved data. Are you sure you want to close?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => { reset(); onClose(); } },
        ],
      );
    } else {
      reset();
      onClose();
    }
  };

  const handleCloseAfterSave = () => {
    reset();
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <ModalContainer visible={visible} onClose={handleClose} title="Log Nutrition" testID="add-nutrition-modal" closeButtonTestID="nutrition-cancel-button">
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* ── Inline Success Message ──────────────────────────── */}
        {successMessage && (
          <View style={styles.successRow}>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity onPress={handleSaveAsFavorite}>
              <Text style={styles.saveFavLink}>Save as Favorite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tab Selector ────────────────────────────────────── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'quick' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('quick')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'quick' && styles.tabTextActive,
              ]}
            >
              Quick Log
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'mealPlans' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('mealPlans')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'mealPlans' && styles.tabTextActive,
              ]}
            >
              Meal Plans
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'recipes' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('recipes')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'recipes' && styles.tabTextActive,
              ]}
            >
              Recipes
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Meal Plans Tab ──────────────────────────────────── */}
        {activeTab === 'mealPlans' && (
          <View>
            {customMealsLoading && (
              <ActivityIndicator color={colors.accent.primary} style={{ marginVertical: spacing[3] }} />
            )}

            {!creatingPlan && (
              <>
                {customMeals.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={styles.planCard}
                    onPress={() => handleSelectPlan(meal)}
                    onLongPress={() => handleDeletePlan(meal)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.planCardHeader}>
                      <Text style={styles.planCardName} numberOfLines={1}>{meal.name}</Text>
                      <TouchableOpacity onPress={() => handleFavoritePlan(meal)} activeOpacity={0.7}>
                        <Text style={styles.planFavIcon}>⭐</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.planCardMacros}>
                      {Math.round(meal.calories)} kcal · {Math.round(meal.protein_g)}g P · {Math.round(meal.carbs_g)}g C · {Math.round(meal.fat_g)}g F
                    </Text>
                  </TouchableOpacity>
                ))}

                {!customMealsLoading && customMeals.length === 0 && (
                  <Text style={styles.emptyText}>No saved meal plans yet.</Text>
                )}

                <TouchableOpacity
                  style={styles.createPlanBtn}
                  onPress={() => { setCreatingPlan(true); setPlanItems([]); setPlanName(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.createPlanBtnText}>+ Create New Plan</Text>
                </TouchableOpacity>
              </>
            )}

            {creatingPlan && (
              <View style={styles.planForm}>
                <Text style={styles.sectionLabel}>Plan Name</Text>
                <TextInput
                  style={styles.input}
                  value={planName}
                  onChangeText={setPlanName}
                  placeholder="e.g. Post-Workout Meal"
                  placeholderTextColor={colors.text.muted}
                />

                {planItems.map((item, idx) => (
                  <View key={idx} style={styles.planItemCard}>
                    <View style={styles.planItemHeaderRow}>
                      <Text style={styles.planItemIndex}>Item {idx + 1}</Text>
                      <TouchableOpacity onPress={() => handleRemovePlanItem(idx)}>
                        <Text style={styles.planItemRemove}><Icon name="close" size={16} /></Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={item.name}
                      onChangeText={(v) => handleUpdatePlanItem(idx, 'name', v)}
                      placeholder="Item name"
                      placeholderTextColor={colors.text.muted}
                    />
                    <View style={styles.row}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.microLabel}>Calories</Text>
                        <TextInput
                          style={styles.input}
                          value={item.calories ? String(item.calories) : ''}
                          onChangeText={(v) => handleUpdatePlanItem(idx, 'calories', v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.microLabel}>Protein (g)</Text>
                        <TextInput
                          style={styles.input}
                          value={item.protein_g ? String(item.protein_g) : ''}
                          onChangeText={(v) => handleUpdatePlanItem(idx, 'protein_g', v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                        />
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.microLabel}>Carbs (g)</Text>
                        <TextInput
                          style={styles.input}
                          value={item.carbs_g ? String(item.carbs_g) : ''}
                          onChangeText={(v) => handleUpdatePlanItem(idx, 'carbs_g', v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.microLabel}>Fat (g)</Text>
                        <TextInput
                          style={styles.input}
                          value={item.fat_g ? String(item.fat_g) : ''}
                          onChangeText={(v) => handleUpdatePlanItem(idx, 'fat_g', v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.microLabel}>Serving ×</Text>
                      <TextInput
                        style={styles.input}
                        value={item.serving_multiplier ? String(item.serving_multiplier) : ''}
                        onChangeText={(v) => handleUpdatePlanItem(idx, 'serving_multiplier', v)}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={colors.text.muted}
                      />
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addItemBtn}
                  onPress={handleAddPlanItem}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addItemBtnText}>+ Add Item</Text>
                </TouchableOpacity>

                {planItems.length > 0 && (
                  <View style={styles.planAggregate}>
                    <Text style={styles.sectionLabel}>Running Total</Text>
                    {(() => {
                      const agg = aggregateMealPlan(planItems);
                      return (
                        <Text style={styles.planAggregateMacros}>
                          {Math.round(agg.calories)} kcal · {Math.round(agg.protein_g)}g P · {Math.round(agg.carbs_g)}g C · {Math.round(agg.fat_g)}g F
                        </Text>
                      );
                    })()}
                  </View>
                )}

                <View style={styles.planFormActions}>
                  <TouchableOpacity
                    style={styles.cancelPlanBtn}
                    onPress={() => { setCreatingPlan(false); setPlanItems([]); setPlanName(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelPlanBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, savingPlan && styles.submitBtnDisabled]}
                    onPress={handleSavePlan}
                    disabled={savingPlan}
                    activeOpacity={0.7}
                  >
                    {savingPlan ? (
                      <ActivityIndicator color={colors.text.primary} />
                    ) : (
                      <Text style={styles.submitText}>Save Plan</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Recipes Tab ─────────────────────────────────────── */}
        {activeTab === 'recipes' && (
          <View>
            {recipesLoading && (
              <ActivityIndicator color={colors.accent.primary} style={{ marginVertical: spacing[3] }} />
            )}

            {!selectedRecipe ? (
              <>
                {userRecipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.planCard}
                    onPress={() => handleSelectRecipe(recipe)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.planCardName} numberOfLines={1}>{recipe.name}</Text>
                    <Text style={styles.planCardMacros}>
                      {Math.round(recipe.calories)} kcal · {Math.round(recipe.protein_g)}g P · {Math.round(recipe.carbs_g)}g C · {Math.round(recipe.fat_g)}g F per serving
                    </Text>
                    {recipe.total_servings ? (
                      <Text style={styles.planCardMacros}>
                        {recipe.total_servings} total serving{recipe.total_servings !== 1 ? 's' : ''}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}

                {!recipesLoading && userRecipes.length === 0 && (
                  <Text style={styles.emptyText}>No recipes yet. Create one from the Quick Log tab.</Text>
                )}
              </>
            ) : (
              <View>
                <Text style={styles.sectionLabel}>Log Recipe</Text>
                <View style={styles.planCard}>
                  <Text style={styles.planCardName}>{selectedRecipe.name}</Text>
                  <Text style={styles.planCardMacros}>
                    Per serving: {Math.round(selectedRecipe.calories)} kcal · {Math.round(selectedRecipe.protein_g)}g P · {Math.round(selectedRecipe.carbs_g)}g C · {Math.round(selectedRecipe.fat_g)}g F
                  </Text>
                </View>

                <Text style={styles.sectionLabel}>Servings Consumed</Text>
                <TextInput
                  style={styles.input}
                  value={recipeServings}
                  onChangeText={setRecipeServings}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.text.muted}
                />

                {(() => {
                  const s = parseFloat(recipeServings) || 0;
                  if (s > 0) {
                    const scaled = scaleMacros(selectedRecipe, s);
                    return (
                      <View style={styles.planAggregate}>
                        <Text style={styles.sectionLabel}>You will log</Text>
                        <Text style={styles.planAggregateMacros}>
                          {Math.round(scaled.calories)} kcal · {Math.round(scaled.protein_g * 10) / 10}g P · {Math.round(scaled.carbs_g * 10) / 10}g C · {Math.round(scaled.fat_g * 10) / 10}g F
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                <View style={styles.planFormActions}>
                  <TouchableOpacity
                    style={styles.cancelPlanBtn}
                    onPress={() => setSelectedRecipe(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelPlanBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, loggingRecipe && styles.submitBtnDisabled]}
                    onPress={handleLogRecipe}
                    disabled={loggingRecipe}
                    activeOpacity={0.7}
                  >
                    {loggingRecipe ? (
                      <ActivityIndicator color={colors.text.primary} />
                    ) : (
                      <Text style={styles.submitText}>Log Recipe</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Quick Log Tab ───────────────────────────────────── */}
        {activeTab === 'quick' && (
          <View>
        {/* ── Favorites (rendered BEFORE search) ──────────────── */}
        {favorites.length > 0 && (
          <View style={styles.favoritesSection}>
            <Text style={styles.sectionLabel}>⭐ Favorites</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.favoritesScroll}
            >
              {favorites.map((fav) => (
                <TouchableOpacity
                  key={fav.id}
                  style={styles.favoriteChip}
                  onPress={() => handleSelectFavorite(fav)}
                  onLongPress={() => handleDeleteFavorite(fav)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.favoriteChipName} numberOfLines={1}>
                    {fav.name}
                  </Text>
                  <Text style={styles.favoriteChipCal}>
                    {Math.round(fav.calories)} kcal
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {favoritesLoading && (
          <ActivityIndicator color={colors.accent.primary} style={{ marginBottom: spacing[2] }} />
        )}

        {/* ── Create Recipe Button ─────────────────────────── */}
        <TouchableOpacity
          style={styles.createPlanBtn}
          onPress={() => setShowRecipeBuilder(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.createPlanBtnText}><Icon name="egg" /> Create Recipe</Text>
        </TouchableOpacity>

        {/* ── Food Search ─────────────────────────────────────── */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionLabel}>Search Food</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput]}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search foods (min 2 chars)..."
              placeholderTextColor={colors.text.muted}
              autoCorrect={false}
              testID="nutrition-food-name-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}><Icon name="close" size={16} /></Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                const mode = resolveScannerMode(Platform.OS as 'ios' | 'android' | 'web' | 'windows' | 'macos', cameraFlagEnabled);
                if (mode === 'camera') {
                  setShowBarcodeScanner(true);
                } else {
                  setShowManualBarcode(true);
                }
              }}
              style={styles.barcodeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="barcode-outline" size={24} color={colors.accent.primary} />
            </TouchableOpacity>
          </View>

          {/* Manual barcode input — shown when flag is off or on web */}
          {showManualBarcode && (
            <View style={{ marginTop: spacing[2] }}>
              <View style={{ flexDirection: 'row', gap: spacing[1] }}>
                <TextInput
                  style={[styles.searchInput, { flex: 1 }]}
                  placeholder="Enter barcode (8-14 digits)"
                  placeholderTextColor={colors.text.muted}
                  value={manualBarcodeValue}
                  onChangeText={(t) => {
                    setManualBarcodeValue(t);
                    setManualBarcodeError('');
                  }}
                  keyboardType="numeric"
                  maxLength={14}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.barcodeBtn, { opacity: manualBarcodeLoading ? 0.5 : 1 }]}
                  disabled={manualBarcodeLoading}
                  onPress={async () => {
                    if (!/^\d{8,14}$/.test(manualBarcodeValue)) {
                      setManualBarcodeError('Enter 8-14 digits');
                      return;
                    }
                    setManualBarcodeLoading(true);
                    await handleManualBarcodeEntry(manualBarcodeValue);
                    setManualBarcodeLoading(false);
                    setShowManualBarcode(false);
                    setManualBarcodeValue('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search-outline" size={20} color={colors.accent.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.barcodeBtn}
                  onPress={() => {
                    setShowManualBarcode(false);
                    setManualBarcodeValue('');
                    setManualBarcodeError('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-outline" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              {manualBarcodeError ? (
                <Text style={[styles.errorText, { marginTop: 4 }]}>{manualBarcodeError}</Text>
              ) : null}
            </View>
          )}

          {searchLoading && (
            <ActivityIndicator color={colors.accent.primary} style={styles.searchSpinner} />
          )}

          {searchError ? (
            <Text style={styles.errorText}>{searchError}</Text>
          ) : null}

          {searchResults.length > 0 && (
            <ScrollView style={styles.resultsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {searchResults.slice(0, 15).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultItem}
                  onPress={() => handleSelectFood(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <SourceBadge source={item.source || 'community'} />
                  </View>
                  <Text style={styles.resultMeta}>
                    {Math.round(item.calories)} kcal · {item.protein_g}g protein
                    {item.serving_size ? ` · ${item.serving_size}${item.serving_unit}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {searchEmpty && searchResults.length === 0 && !searchLoading && (
            <Text style={styles.emptyText}>No results found — try a different term or enter macros manually</Text>
          )}
        </View>

        {/* ── Serving Unit Selector (shown when food selected) ── */}
        {selectedFood && servingOptions.length > 0 && (
          <View style={styles.servingSelector}>
            <Text style={styles.sectionLabel}>Serving Size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {servingOptions.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.servingPill,
                    selectedServing?.label === opt.label && styles.servingPillActive,
                  ]}
                  onPress={() => handleServingChange(opt)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.servingPillText,
                      selectedServing?.label === opt.label && styles.servingPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Serving Multiplier (shown when food selected) ──── */}
        {selectedFood && (
          <View style={styles.multiplierSection}>
            <Text style={styles.sectionLabel}>
              Servings of {selectedFood.name}
            </Text>
            <TextInput
              style={[styles.input, styles.multiplierInput]}
              value={servingMultiplier}
              onChangeText={handleMultiplierChange}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={styles.multiplierHint}>
              {selectedServing
                ? `${selectedServing.grams}${selectedFood.serving_unit} per ${selectedServing.label}`
                : `${selectedFood.serving_size}${selectedFood.serving_unit} per serving`}
            </Text>
          </View>
        )}

        {/* ── Manual Macro Fields ─────────────────────────────── */}
        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              style={[styles.input, selectedFood && styles.inputLocked]}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="kcal"
              placeholderTextColor={colors.text.muted}
              editable={!selectedFood}
              testID="nutrition-calories-input"
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              style={[styles.input, selectedFood && styles.inputLocked]}
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={colors.text.muted}
              editable={!selectedFood}
              testID="nutrition-protein-input"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Carbs (g)</Text>
            <TextInput
              style={[styles.input, selectedFood && styles.inputLocked]}
              value={carbs}
              onChangeText={setCarbs}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={colors.text.muted}
              editable={!selectedFood}
              testID="nutrition-carbs-input"
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Fat (g)</Text>
            <TextInput
              style={[styles.input, selectedFood && styles.inputLocked]}
              value={fat}
              onChangeText={setFat}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={colors.text.muted}
              editable={!selectedFood}
              testID="nutrition-fat-input"
            />
          </View>
        </View>

        {/* ── Fibre Field ─────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.label}>Fibre (g)</Text>
          <TextInput
            style={styles.input}
            value={fibre}
            onChangeText={setFibre}
            keyboardType="numeric"
            placeholder="g"
            placeholderTextColor={colors.text.muted}
          />
        </View>

        {/* ── Water Tracker ───────────────────────────────────── */}
        <WaterTracker
          glasses={waterGlasses}
          onIncrement={() => setWaterGlasses(incrementGlasses(waterGlasses, 12))}
          onDecrement={() => setWaterGlasses(decrementGlasses(waterGlasses))}
        />

        {/* ── Collapsible Micronutrients ──────────────────────── */}
        <View style={styles.microSection}>
          <TouchableOpacity
            style={styles.microHeader}
            onPress={() => setMicroExpanded(!microExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLabel}>
              Micronutrients ({countFilledFields(microNutrients)} filled)
            </Text>
            <Text style={styles.microChevron}>{microExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {microExpanded && (
            <View style={styles.microGrid}>
              {MICRO_FIELDS.map((field) => (
                <View key={field.key} style={styles.microFieldHalf}>
                  <Text style={styles.microLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={microNutrients[field.key] ?? ''}
                    onChangeText={(text) =>
                      setMicroNutrients((prev) => ({ ...prev, [field.key]: text }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Post-workout meal"
            placeholderTextColor={colors.text.muted}
            multiline
          />
        </View>
          </View>
        )}
      </ScrollView>

      {activeTab === 'quick' && (
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.7}
        testID="nutrition-submit-button"
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <Text style={styles.submitText}>Save</Text>
        )}
      </TouchableOpacity>
      )}

      <TouchableOpacity onPress={handleCloseAfterSave} style={styles.doneBtn} activeOpacity={0.7}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </ModalContainer>

    {/* Recipe Builder overlay */}
    <RecipeBuilderScreen
      visible={showRecipeBuilder}
      onClose={() => setShowRecipeBuilder(false)}
      onSaved={() => {
        setShowRecipeBuilder(false);
        onSuccess();
      }}
    />

    {/* Barcode Scanner overlay — mobile only */}
    {Platform.OS !== 'web' && (
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <BarcodeScanner
          onFoodSelected={handleBarcodeFoodSelected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      </Modal>
    )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Search ───────────────────────────────────────────────────────────────
  searchSection: {
    marginBottom: spacing[3],
    zIndex: 10,
    position: 'relative' as const,
  },
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
  },
  clearBtn: {
    marginLeft: spacing[2],
    padding: spacing[2],
  },
  clearBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  barcodeBtn: {
    marginLeft: spacing[2],
    padding: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSpinner: {
    marginTop: spacing[2],
  },
  errorText: {
    color: colors.semantic.warning,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[1],
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[1],
    textAlign: 'center' as const,
  },
  resultsList: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginTop: spacing[1],
    maxHeight: 300,
    overflow: 'hidden' as const,
    zIndex: 10,
  },
  resultItem: {
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  resultName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.medium,
  },
  resultMeta: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[1],
  },

  // ── Multiplier ───────────────────────────────────────────────────────────
  multiplierSection: {
    marginBottom: spacing[3],
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  multiplierInput: {
    width: 80,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  multiplierHint: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[1],
  },

  // ── Serving Selector ─────────────────────────────────────────────────────
  servingSelector: {
    marginBottom: spacing[3],
  },
  servingPill: {
    height: 28,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.bg.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[2],
  },
  servingPillActive: {
    backgroundColor: colors.accent.primaryMuted,
  },
  servingPillText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },
  servingPillTextActive: {
    color: colors.accent.primary,
  },

  // ── Favorites ────────────────────────────────────────────────────────────
  favoritesSection: {
    marginBottom: spacing[3],
  },
  favoritesScroll: {
    marginTop: spacing[1],
  },
  favoriteChip: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginRight: spacing[2],
    minWidth: 100,
    alignItems: 'center',
  },
  favoriteChipName: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
    maxWidth: 120,
  },
  favoriteChipCal: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[1],
  },

  // ── Macro fields ─────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  field: { marginBottom: spacing[3] },
  fieldHalf: { flex: 1 },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    padding: spacing[3],
  },
  inputLocked: {
    opacity: 0.6,
    backgroundColor: colors.bg.surface,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // ── Submit ───────────────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    padding: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    fontWeight: typography.weight.semibold,
  },

  // ── Micronutrients ───────────────────────────────────────────────────────
  microSection: {
    marginBottom: spacing[3],
  },
  microHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  microChevron: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  microGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[1],
  },
  microFieldHalf: {
    width: '47%' as unknown as number,
  },
  microLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },

  // ── Post-save inline success ──────────────────────────────────────────
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.semantic.positive + '18',
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  successText: {
    color: colors.semantic.positive,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },
  saveFavLink: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.semibold,
    textDecorationLine: 'underline',
  },
  doneBtn: {
    padding: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  doneBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.accent.primaryMuted,
  },
  tabText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },
  tabTextActive: {
    color: colors.accent.primary,
  },

  // ── Meal Plan Cards ──────────────────────────────────────────────────────
  planCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planCardName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  planFavIcon: {
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    marginLeft: spacing[2],
  },
  planCardMacros: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[1],
  },
  createPlanBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    borderStyle: 'dashed',
    padding: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  createPlanBtnText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },

  // ── Plan Creation Form ───────────────────────────────────────────────────
  planForm: {
    marginTop: spacing[2],
  },
  planItemCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    marginTop: spacing[2],
    gap: spacing[2],
  },
  planItemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planItemIndex: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },
  planItemRemove: {
    color: colors.semantic.negative,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    padding: spacing[1],
  },
  addItemBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[2],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  addItemBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  planAggregate: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[3],
  },
  planAggregateMacros: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[1],
  },
  planFormActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  cancelPlanBtn: {
    flex: 1,
    padding: spacing[3],
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelPlanBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
});
