import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { spacing, typography, radius, opacityScale } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';
import { ExerciseFrequencyPicker } from './ExerciseFrequencyPicker';
import { ExerciseTypesPicker } from './ExerciseTypesPicker';
import { DietStylePicker } from './DietStylePicker';
import { ProteinTargetSlider } from './ProteinTargetSlider';
import { DietaryRestrictionsPicker } from './DietaryRestrictionsPicker';
import { AllergiesPicker } from './AllergiesPicker';
import { CuisinePreferencesPicker } from './CuisinePreferencesPicker';
import { MealFrequencyStepper } from './MealFrequencyStepper';
import { useStore } from '../../store';
import api from '../../services/api';
import { useRecalculate } from '../../hooks/useRecalculate';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Draft state shape ───────────────────────────────────────────────────────

interface DraftState {
  exerciseFrequency: number;
  exerciseTypes: string[];
  dietStyle: string;
  proteinPerKg: number;
  dietaryRestrictions: string[];
  allergies: string[];
  cuisinePreferences: string[];
  mealFrequency: number;
}

function extractDraft(prefs: Record<string, unknown> | null | undefined): DraftState {
  const p = prefs ?? {};
  return {
    exerciseFrequency: (p.exercise_sessions_per_week as number) ?? 3,
    exerciseTypes: (p.exercise_types as string[]) ?? ['strength'],
    dietStyle: (p.diet_style as string) ?? 'balanced',
    proteinPerKg: (p.protein_per_kg as number) ?? 2.0,
    dietaryRestrictions: (p.dietary_restrictions as string[]) ?? [],
    allergies: (p.allergies as string[]) ?? [],
    cuisinePreferences: (p.cuisine_preferences as string[]) ?? [],
    mealFrequency: (p.meal_frequency as number) ?? 3,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdvancedSettingsSection() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useStore();
  const profile = store.profile;
  const latestMetrics = store.latestMetrics;

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { recalculate } = useRecalculate();

  // Draft state initialized from profile preferences
  const [draft, setDraft] = useState<DraftState>(() =>
    extractDraft(profile?.preferences),
  );

  // Re-sync draft when profile changes externally
  useEffect(() => {
    if (!expanded) {
      setDraft(extractDraft(profile?.preferences));
    }
  }, [profile?.preferences, expanded]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
    setError(null);
    setSuccess(false);
  }, []);

  const updateDraft = useCallback(<K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Save preferences to profile
      const existingPrefs = profile?.preferences ?? {};
      const updatedPrefs = {
        ...existingPrefs,
        exercise_sessions_per_week: draft.exerciseFrequency,
        exercise_types: draft.exerciseTypes,
        diet_style: draft.dietStyle,
        protein_per_kg: draft.proteinPerKg,
        dietary_restrictions: draft.dietaryRestrictions,
        allergies: draft.allergies,
        cuisine_preferences: draft.cuisinePreferences,
        meal_frequency: draft.mealFrequency,
      };

      const { data: profileData } = await api.put('users/profile', {
        preferences: updatedPrefs,
      });

      // Update store with mapped profile
      store.setProfile({
        id: profileData.id,
        userId: profileData.user_id,
        displayName: profileData.display_name ?? null,
        avatarUrl: profileData.avatar_url ?? null,
        timezone: profileData.timezone ?? null,
        preferredCurrency: profileData.preferred_currency ?? null,
        region: profileData.region ?? null,
        coachingMode: profileData.coaching_mode ?? undefined,
        preferences: profileData.preferences ?? null,
      });

      // 2. Recalculate targets with current metrics
      if (latestMetrics) {
        const metricsPayload: Record<string, unknown> = {
          activity_level: latestMetrics.activityLevel ?? 'moderate',
        };
        if (latestMetrics.weightKg != null) metricsPayload.weight_kg = latestMetrics.weightKg;
        if (latestMetrics.heightCm != null) metricsPayload.height_cm = latestMetrics.heightCm;
        if (latestMetrics.bodyFatPct != null) metricsPayload.body_fat_pct = latestMetrics.bodyFatPct;

        await recalculate({ metrics: metricsPayload });
      }

      setSuccess(true);
    } catch {
      setError("Couldn't save settings. Check your connection.");
    } finally {
      setSaving(false);
    }
  }, [draft, profile, latestMetrics, store, recalculate]);

  return (
    <Card>
      {/* Collapsible header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Advanced Settings"
      >
        <View style={styles.headerLeft}>
          <Icon name="gear" size={18} color={c.text.secondary} />
          <Text style={[styles.headerTitle, { color: c.text.primary }]}>Advanced Settings</Text>
        </View>
        <Icon
          name={expanded ? 'chevron-left' : 'chevron-right'}
          size={16}
          color={c.text.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* ── Section 1: Exercise & Activity ── */}
          <Text style={[styles.sectionTitle, { color: c.text.secondary }]}>Exercise & Activity</Text>
          <ExerciseFrequencyPicker
            value={draft.exerciseFrequency}
            onChange={(v) => updateDraft('exerciseFrequency', v)}
          />
          <ExerciseTypesPicker
            value={draft.exerciseTypes}
            onChange={(v) => updateDraft('exerciseTypes', v)}
          />

          {/* ── Section 2: Nutrition Preferences ── */}
          <View style={[styles.divider, { backgroundColor: c.border.subtle }]} />
          <Text style={[styles.sectionTitle, { color: c.text.secondary }]}>Nutrition Preferences</Text>
          <DietStylePicker
            value={draft.dietStyle}
            onChange={(v) => updateDraft('dietStyle', v)}
          />
          <ProteinTargetSlider
            value={draft.proteinPerKg}
            weightKg={latestMetrics?.weightKg ?? 70}
            onChange={(v) => updateDraft('proteinPerKg', v)}
          />

          {/* ── Section 3: Food DNA ── */}
          <View style={[styles.divider, { backgroundColor: c.border.subtle }]} />
          <Text style={[styles.sectionTitle, { color: c.text.secondary }]}>Food DNA</Text>
          <DietaryRestrictionsPicker
            value={draft.dietaryRestrictions}
            onChange={(v) => updateDraft('dietaryRestrictions', v)}
          />
          <AllergiesPicker
            value={draft.allergies}
            onChange={(v) => updateDraft('allergies', v)}
          />
          <CuisinePreferencesPicker
            value={draft.cuisinePreferences}
            onChange={(v) => updateDraft('cuisinePreferences', v)}
          />
          <MealFrequencyStepper
            value={draft.mealFrequency}
            onChange={(v) => updateDraft('mealFrequency', v)}
          />

          {/* ── Feedback ── */}
          {error && <Text style={[styles.error, { color: c.semantic.negative }]}>{error}</Text>}
          {success && <Text style={[styles.success, { color: c.semantic.positive }]}>Settings saved ✓</Text>}

          {/* ── Save button ── */}
          <Button
            title={saving ? 'Saving…' : 'Save Settings'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
          />
        </View>
      )}
    </Card>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerTitle: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
  },
  body: {
    marginTop: spacing[4],
  },
  sectionTitle: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: c.border.subtle,
    marginVertical: spacing[4],
  },
  error: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[2],
  },
  success: {
    color: c.semantic.positive,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[2],
  },
  saveBtn: {
    marginTop: spacing[2],
  },
});
