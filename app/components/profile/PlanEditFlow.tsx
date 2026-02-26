import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import api from '../../services/api';
import {
  initializeDraft,
  validateDraft,
  buildRecalculatePayload,
} from '../../utils/editPlanLogic';
import type { EditDraft, ActivityLevel, GoalType } from '../../utils/editPlanLogic';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
];

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: 'cutting', label: 'Cutting' },
  { value: 'maintaining', label: 'Maintaining' },
  { value: 'bulking', label: 'Bulking' },
];

// Body stats field keys — used to determine which step has the first error
const BODY_STATS_FIELDS: (keyof EditDraft)[] = [
  'weight',
  'heightCm',
  'heightFeet',
  'heightInches',
  'bodyFatPct',
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface PlanEditFlowProps {
  metrics: {
    id: string;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    activityLevel: string | null;
    recordedAt: string;
  } | null;
  goals: {
    id: string;
    userId: string;
    goalType: string;
    targetWeightKg: number | null;
    goalRatePerWeek: number | null;
  } | null;
  unitSystem: 'metric' | 'imperial';
  onSave: (result: {
    metrics: {
      id: string;
      heightCm: number | null;
      weightKg: number | null;
      bodyFatPct: number | null;
      activityLevel: string | null;
      recordedAt: string;
    };
    goals: {
      id: string;
      userId: string;
      goalType: string;
      targetWeightKg: number | null;
      goalRatePerWeek: number | null;
    };
    targets: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
  }) => void;
  onCancel: () => void;
}

// ─── BodyStatsStep ───────────────────────────────────────────────────────────

function BodyStatsStep({
  draft,
  fieldErrors,
  unitSystem,
  onDraftChange,
}: {
  draft: EditDraft;
  fieldErrors: Partial<Record<keyof EditDraft, string>>;
  unitSystem: 'metric' | 'imperial';
  onDraftChange: (patch: Partial<EditDraft>) => void;
}) {
  return (
    <View>
      {/* Weight */}
      <View style={fieldStyles.field}>
        <Text style={fieldStyles.label}>
          Weight ({unitSystem === 'imperial' ? 'lbs' : 'kg'})
        </Text>
        <TextInput
          style={[fieldStyles.input, !!fieldErrors.weight && fieldStyles.inputError]}
          value={draft.weight}
          onChangeText={(v) => onDraftChange({ weight: v })}
          keyboardType="decimal-pad"
          placeholder={unitSystem === 'imperial' ? 'e.g. 176' : 'e.g. 80'}
          placeholderTextColor={colors.text.muted}
        />
        {fieldErrors.weight && (
          <Text style={fieldStyles.errorText}>{fieldErrors.weight}</Text>
        )}
      </View>

      {/* Height */}
      {unitSystem === 'imperial' ? (
        <View style={fieldStyles.field}>
          <Text style={fieldStyles.label}>Height (ft / in)</Text>
          <View style={fieldStyles.heightRow}>
            <TextInput
              style={[
                fieldStyles.input,
                fieldStyles.heightInput,
                !!(fieldErrors.heightFeet || fieldErrors.heightInches) && fieldStyles.inputError,
              ]}
              value={draft.heightFeet}
              onChangeText={(v) => onDraftChange({ heightFeet: v })}
              keyboardType="number-pad"
              placeholder="ft"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={fieldStyles.heightSep}>′</Text>
            <TextInput
              style={[
                fieldStyles.input,
                fieldStyles.heightInput,
                !!fieldErrors.heightInches && fieldStyles.inputError,
              ]}
              value={draft.heightInches}
              onChangeText={(v) => onDraftChange({ heightInches: v })}
              keyboardType="number-pad"
              placeholder="in"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={fieldStyles.heightSep}>″</Text>
          </View>
          {(fieldErrors.heightFeet || fieldErrors.heightInches) && (
            <Text style={fieldStyles.errorText}>
              {fieldErrors.heightFeet || fieldErrors.heightInches}
            </Text>
          )}
        </View>
      ) : (
        <View style={fieldStyles.field}>
          <Text style={fieldStyles.label}>Height (cm)</Text>
          <TextInput
            style={[fieldStyles.input, !!fieldErrors.heightCm && fieldStyles.inputError]}
            value={draft.heightCm}
            onChangeText={(v) => onDraftChange({ heightCm: v })}
            keyboardType="number-pad"
            placeholder="e.g. 180"
            placeholderTextColor={colors.text.muted}
          />
          {fieldErrors.heightCm && (
            <Text style={fieldStyles.errorText}>{fieldErrors.heightCm}</Text>
          )}
        </View>
      )}

      {/* Body Fat % */}
      <View style={fieldStyles.field}>
        <Text style={fieldStyles.label}>Body Fat (%)</Text>
        <TextInput
          style={[fieldStyles.input, !!fieldErrors.bodyFatPct && fieldStyles.inputError]}
          value={draft.bodyFatPct}
          onChangeText={(v) => onDraftChange({ bodyFatPct: v })}
          keyboardType="decimal-pad"
          placeholder="optional"
          placeholderTextColor={colors.text.muted}
        />
        {fieldErrors.bodyFatPct && (
          <Text style={fieldStyles.errorText}>{fieldErrors.bodyFatPct}</Text>
        )}
      </View>

      {/* Activity Level Picker */}
      <View style={pickerStyles.container}>
        <Text style={pickerStyles.label}>Activity Level</Text>
        <View style={pickerStyles.options}>
          {ACTIVITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                pickerStyles.option,
                draft.activityLevel === level.value && pickerStyles.optionActive,
              ]}
              onPress={() => onDraftChange({ activityLevel: level.value })}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  pickerStyles.optionText,
                  draft.activityLevel === level.value && pickerStyles.optionTextActive,
                ]}
              >
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── GoalsStep ───────────────────────────────────────────────────────────────

function GoalsStep({
  draft,
  fieldErrors,
  unitSystem,
  onDraftChange,
}: {
  draft: EditDraft;
  fieldErrors: Partial<Record<keyof EditDraft, string>>;
  unitSystem: 'metric' | 'imperial';
  onDraftChange: (patch: Partial<EditDraft>) => void;
}) {
  const isMaintaining = draft.goalType === 'maintaining';
  const weightSuffix = unitSystem === 'imperial' ? 'lbs' : 'kg';
  const rateSuffix = unitSystem === 'imperial' ? 'lbs/week' : 'kg/week';

  return (
    <View>
      {/* Goal Type Picker */}
      <View style={pickerStyles.container}>
        <Text style={pickerStyles.label}>Goal Type</Text>
        <View style={pickerStyles.options}>
          {GOAL_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                pickerStyles.option,
                draft.goalType === type.value && pickerStyles.optionActive,
              ]}
              onPress={() => onDraftChange({ goalType: type.value })}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  pickerStyles.optionText,
                  draft.goalType === type.value && pickerStyles.optionTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Target Weight — hidden when maintaining */}
      {!isMaintaining && (
        <View style={fieldStyles.field}>
          <Text style={fieldStyles.label}>Target Weight ({weightSuffix})</Text>
          <TextInput
            style={[fieldStyles.input, !!fieldErrors.targetWeight && fieldStyles.inputError]}
            value={draft.targetWeight}
            onChangeText={(v) => onDraftChange({ targetWeight: v })}
            keyboardType="decimal-pad"
            placeholder="optional"
            placeholderTextColor={colors.text.muted}
          />
          {fieldErrors.targetWeight && (
            <Text style={fieldStyles.errorText}>{fieldErrors.targetWeight}</Text>
          )}
        </View>
      )}

      {/* Goal Rate — hidden when maintaining */}
      {!isMaintaining && (
        <View style={fieldStyles.field}>
          <Text style={fieldStyles.label}>Goal Rate ({rateSuffix})</Text>
          <TextInput
            style={[fieldStyles.input, !!fieldErrors.goalRate && fieldStyles.inputError]}
            value={draft.goalRate}
            onChangeText={(v) => onDraftChange({ goalRate: v })}
            keyboardType="decimal-pad"
            placeholder="optional"
            placeholderTextColor={colors.text.muted}
          />
          {fieldErrors.goalRate && (
            <Text style={fieldStyles.errorText}>{fieldErrors.goalRate}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── PlanEditFlow ────────────────────────────────────────────────────────────

export function PlanEditFlow({
  metrics,
  goals,
  unitSystem,
  onSave,
  onCancel,
}: PlanEditFlowProps) {
  const [draft, setDraft] = useState<EditDraft>(() =>
    initializeDraft(metrics, goals, unitSystem),
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EditDraft, string>>>({});

  const handleDraftChange = useCallback((patch: Partial<EditDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    // Clear field errors for changed fields
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof EditDraft)[]) {
        delete next[key];
      }
      return next;
    });
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const handleBack = useCallback(() => {
    setCurrentStep(0);
  }, []);

  const handleSave = useCallback(async () => {
    // Validate
    const result = validateDraft(draft, unitSystem);
    if (!result.valid) {
      setFieldErrors(result.errors);
      // Navigate to the step containing the first error
      const firstErrorKey = Object.keys(result.errors)[0] as keyof EditDraft;
      if (BODY_STATS_FIELDS.includes(firstErrorKey)) {
        setCurrentStep(0);
      } else {
        setCurrentStep(1);
      }
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildRecalculatePayload(draft, unitSystem);
      const { data } = await api.post('users/recalculate', payload);

      // Map snake_case response to camelCase — explicit field-by-field
      const mappedMetrics = {
        id: data.metrics.id,
        heightCm: data.metrics.height_cm,
        weightKg: data.metrics.weight_kg,
        bodyFatPct: data.metrics.body_fat_pct,
        activityLevel: data.metrics.activity_level,
        recordedAt: data.metrics.recorded_at,
      };

      const mappedGoals = {
        id: data.goals.id,
        userId: data.goals.user_id,
        goalType: data.goals.goal_type,
        targetWeightKg: data.goals.target_weight_kg,
        goalRatePerWeek: data.goals.goal_rate_per_week,
      };

      const mappedTargets = {
        calories: data.targets.calories,
        protein_g: data.targets.protein_g,
        carbs_g: data.targets.carbs_g,
        fat_g: data.targets.fat_g,
      };

      onSave({
        metrics: mappedMetrics,
        goals: mappedGoals,
        targets: mappedTargets,
      });
    } catch {
      setError("Couldn't save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }, [draft, unitSystem, onSave]);

  return (
    <View style={flowStyles.container}>
      {/* Step content */}
      {currentStep === 0 ? (
        <BodyStatsStep
          draft={draft}
          fieldErrors={fieldErrors}
          unitSystem={unitSystem}
          onDraftChange={handleDraftChange}
        />
      ) : (
        <GoalsStep
          draft={draft}
          fieldErrors={fieldErrors}
          unitSystem={unitSystem}
          onDraftChange={handleDraftChange}
        />
      )}

      {/* Error message */}
      {error && (
        <TouchableOpacity onPress={() => setError(null)} activeOpacity={0.7}>
          <Text style={flowStyles.error}>{error} (tap to dismiss)</Text>
        </TouchableOpacity>
      )}

      {/* Navigation buttons */}
      <View style={flowStyles.actions}>
        {currentStep === 0 ? (
          <>
            <TouchableOpacity
              style={flowStyles.primaryBtn}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={flowStyles.primaryBtnText}>Next</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={flowStyles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={flowStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[flowStyles.primaryBtn, saving && flowStyles.primaryBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={colors.text.primary} size="small" />
              ) : (
                <Text style={flowStyles.primaryBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={flowStyles.secondaryBtn}
              onPress={handleBack}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={flowStyles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={flowStyles.cancelBtn}
              onPress={onCancel}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={flowStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const fieldStyles = StyleSheet.create({
  field: {
    marginBottom: spacing[3],
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  input: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  inputError: {
    borderColor: colors.semantic.negative,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  heightInput: {
    flex: 1,
  },
  heightSep: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  errorText: {
    color: colors.semantic.negative,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[2],
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  option: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  optionActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  optionText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  optionTextActive: {
    color: colors.accent.primary,
  },
});

const flowStyles = StyleSheet.create({
  container: {
    paddingTop: spacing[2],
  },
  error: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  primaryBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  secondaryBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  secondaryBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  cancelBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
