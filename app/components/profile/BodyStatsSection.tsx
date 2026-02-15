import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import { EditableField } from '../common/EditableField';
import { EmptyState } from '../common/EmptyState';
import { Icon } from '../common/Icon';
import {
  formatHeight,
  formatWeight,
  parseWeightInput,
  cmToFtIn,
  ftInToCm,
} from '../../utils/unitConversion';
import { useStore } from '../../store';
import api from '../../services/api';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
] as const;

interface BodyStatsSectionProps {
  metrics: {
    id: string;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    activityLevel: string | null;
    recordedAt: string;
  } | null;
  unitSystem: 'metric' | 'imperial';
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const recorded = new Date(dateStr);
  const diffMs = now.getTime() - recorded.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function ActivityLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (level: string) => void;
}) {
  return (
    <View style={pickerStyles.container}>
      <Text style={pickerStyles.label}>Activity Level</Text>
      <View style={pickerStyles.options}>
        {ACTIVITY_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.value}
            style={[
              pickerStyles.option,
              value === level.value && pickerStyles.optionActive,
            ]}
            onPress={() => onChange(level.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                pickerStyles.optionText,
                value === level.value && pickerStyles.optionTextActive,
              ]}
            >
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function BodyStatsSection({ metrics, unitSystem }: BodyStatsSectionProps) {
  const navigation = useNavigation<any>();
  const store = useStore();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft state for editing
  const [draftWeight, setDraftWeight] = useState('');
  const [draftHeightCm, setDraftHeightCm] = useState('');
  const [draftFeet, setDraftFeet] = useState('');
  const [draftInches, setDraftInches] = useState('');
  const [draftBodyFat, setDraftBodyFat] = useState('');
  const [draftActivity, setDraftActivity] = useState('moderate');

  const startEditing = useCallback(() => {
    if (metrics) {
      const weightDisplay = metrics.weightKg != null
        ? String(unitSystem === 'imperial'
          ? Math.round(metrics.weightKg * 2.20462 * 10) / 10
          : metrics.weightKg)
        : '';
      setDraftWeight(weightDisplay);

      if (unitSystem === 'imperial' && metrics.heightCm != null) {
        const { feet, inches } = cmToFtIn(metrics.heightCm);
        setDraftFeet(String(feet));
        setDraftInches(String(inches));
      } else {
        setDraftHeightCm(metrics.heightCm != null ? String(Math.round(metrics.heightCm)) : '');
      }

      setDraftBodyFat(metrics.bodyFatPct != null ? String(metrics.bodyFatPct) : '');
      setDraftActivity(metrics.activityLevel ?? 'moderate');
    } else {
      setDraftWeight('');
      setDraftHeightCm('');
      setDraftFeet('');
      setDraftInches('');
      setDraftBodyFat('');
      setDraftActivity('moderate');
    }
    setError(null);
    setEditing(true);
  }, [metrics, unitSystem]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Parse weight
      const weightNum = parseFloat(draftWeight);
      const weightKg = !isNaN(weightNum) && weightNum > 0
        ? parseWeightInput(weightNum, unitSystem)
        : undefined;

      // Parse height
      let heightCm: number | undefined;
      if (unitSystem === 'imperial') {
        const ft = parseInt(draftFeet, 10);
        const inc = parseInt(draftInches, 10);
        if (!isNaN(ft) && ft >= 0 && !isNaN(inc) && inc >= 0) {
          heightCm = ftInToCm(ft, inc);
        }
      } else {
        const cm = parseFloat(draftHeightCm);
        if (!isNaN(cm) && cm > 0) heightCm = Math.round(cm);
      }

      // Parse body fat
      const bfNum = parseFloat(draftBodyFat);
      const bodyFatPct = !isNaN(bfNum) && bfNum >= 0 && bfNum <= 100 ? bfNum : undefined;

      const payload: Record<string, unknown> = {
        activity_level: draftActivity,
      };
      if (weightKg !== undefined) payload.weight_kg = weightKg;
      if (heightCm !== undefined) payload.height_cm = heightCm;
      if (bodyFatPct !== undefined) payload.body_fat_pct = bodyFatPct;

      const { data } = await api.post('users/recalculate', { metrics: payload });

      // Update store — map snake_case to camelCase
      if (data.metrics) {
        store.setLatestMetrics({
          id: data.metrics.id,
          heightCm: data.metrics.height_cm,
          weightKg: data.metrics.weight_kg,
          bodyFatPct: data.metrics.body_fat_pct,
          activityLevel: data.metrics.activity_level,
          recordedAt: data.metrics.recorded_at,
        });
      }
      if (data.targets) {
        store.setAdaptiveTargets({
          calories: data.targets.calories,
          protein_g: data.targets.protein_g,
          carbs_g: data.targets.carbs_g,
          fat_g: data.targets.fat_g,
        });
      }

      setEditing(false);
    } catch {
      setError("Couldn't save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }, [draftWeight, draftHeightCm, draftFeet, draftInches, draftBodyFat, draftActivity, unitSystem, store]);

  // Handle single-field save for non-edit-all mode
  const handleFieldSave = useCallback(
    (field: 'height' | 'weight' | 'bodyFat') =>
      async (newValue: string) => {
        const payload: Record<string, unknown> = {
          activity_level: metrics?.activityLevel ?? 'moderate',
        };

        if (field === 'weight') {
          const num = parseFloat(newValue);
          if (isNaN(num) || num <= 0) throw new Error('Invalid weight');
          payload.weight_kg = parseWeightInput(num, unitSystem);
        } else if (field === 'height') {
          const num = parseFloat(newValue);
          if (isNaN(num) || num <= 0) throw new Error('Invalid height');
          payload.height_cm = Math.round(num);
        } else if (field === 'bodyFat') {
          const num = parseFloat(newValue);
          if (isNaN(num) || num < 0 || num > 100) throw new Error('Invalid body fat');
          payload.body_fat_pct = num;
        }

        // Carry forward existing values
        if (field !== 'weight' && metrics?.weightKg != null) payload.weight_kg = metrics.weightKg;
        if (field !== 'height' && metrics?.heightCm != null) payload.height_cm = metrics.heightCm;
        if (field !== 'bodyFat' && metrics?.bodyFatPct != null) payload.body_fat_pct = metrics.bodyFatPct;

        const { data } = await api.post('users/recalculate', { metrics: payload });

        if (data.metrics) {
          store.setLatestMetrics({
            id: data.metrics.id,
            heightCm: data.metrics.height_cm,
            weightKg: data.metrics.weight_kg,
            bodyFatPct: data.metrics.body_fat_pct,
            activityLevel: data.metrics.activity_level,
            recordedAt: data.metrics.recorded_at,
          });
        }
        if (data.targets) {
          store.setAdaptiveTargets({
            calories: data.targets.calories,
            protein_g: data.targets.protein_g,
            carbs_g: data.targets.carbs_g,
            fat_g: data.targets.fat_g,
          });
        }
      },
    [metrics, unitSystem, store],
  );

  // Handle activity level save
  const handleActivitySave = useCallback(
    async (newLevel: string) => {
      const payload: Record<string, unknown> = {
        activity_level: newLevel,
      };
      if (metrics?.weightKg != null) payload.weight_kg = metrics.weightKg;
      if (metrics?.heightCm != null) payload.height_cm = metrics.heightCm;
      if (metrics?.bodyFatPct != null) payload.body_fat_pct = metrics.bodyFatPct;

      const { data } = await api.post('users/recalculate', { metrics: payload });

      if (data.metrics) {
        store.setLatestMetrics({
          id: data.metrics.id,
          heightCm: data.metrics.height_cm,
          weightKg: data.metrics.weight_kg,
          bodyFatPct: data.metrics.body_fat_pct,
          activityLevel: data.metrics.activity_level,
          recordedAt: data.metrics.recorded_at,
        });
      }
      if (data.targets) {
        store.setAdaptiveTargets({
          calories: data.targets.calories,
          protein_g: data.targets.protein_g,
          carbs_g: data.targets.carbs_g,
          fat_g: data.targets.fat_g,
        });
      }
    },
    [metrics, store],
  );

  // ── Empty state ──
  if (!metrics) {
    return (
      <Card>
        <EmptyState
          icon={<Icon name="chart" size={28} color={colors.accent.primary} />}
          title="Body Stats"
          description="Add your body stats to get personalized targets"
          actionLabel="Add Stats"
          onAction={startEditing}
        />
        {editing && (
          <EditAllMode
            unitSystem={unitSystem}
            draftWeight={draftWeight}
            setDraftWeight={setDraftWeight}
            draftHeightCm={draftHeightCm}
            setDraftHeightCm={setDraftHeightCm}
            draftFeet={draftFeet}
            setDraftFeet={setDraftFeet}
            draftInches={draftInches}
            setDraftInches={setDraftInches}
            draftBodyFat={draftBodyFat}
            setDraftBodyFat={setDraftBodyFat}
            draftActivity={draftActivity}
            setDraftActivity={setDraftActivity}
            saving={saving}
            error={error}
            onSave={handleSave}
            onCancel={cancelEditing}
          />
        )}
      </Card>
    );
  }

  // ── Edit-all mode (from empty state CTA) ──
  if (editing) {
    return (
      <Card>
        <Text style={styles.sectionTitle}>Body Stats</Text>
        <EditAllMode
          unitSystem={unitSystem}
          draftWeight={draftWeight}
          setDraftWeight={setDraftWeight}
          draftHeightCm={draftHeightCm}
          setDraftHeightCm={setDraftHeightCm}
          draftFeet={draftFeet}
          setDraftFeet={setDraftFeet}
          draftInches={draftInches}
          setDraftInches={setDraftInches}
          draftBodyFat={draftBodyFat}
          setDraftBodyFat={setDraftBodyFat}
          draftActivity={draftActivity}
          setDraftActivity={setDraftActivity}
          saving={saving}
          error={error}
          onSave={handleSave}
          onCancel={cancelEditing}
        />
      </Card>
    );
  }

  // ── Normal display mode ──
  const heightDisplay = metrics.heightCm != null ? formatHeight(metrics.heightCm, unitSystem) : '—';
  const weightDisplay = metrics.weightKg != null ? formatWeight(metrics.weightKg, unitSystem) : '—';
  const bodyFatDisplay = metrics.bodyFatPct != null ? `${metrics.bodyFatPct}%` : '—';
  const activityLabel = ACTIVITY_LEVELS.find((l) => l.value === metrics.activityLevel)?.label ?? metrics.activityLevel ?? '—';

  return (
    <Card>
      <Text style={styles.sectionTitle}>Body Stats</Text>

      <EditableField
        label="Height"
        value={heightDisplay}
        onSave={handleFieldSave('height')}
      />
      <EditableField
        label="Weight"
        value={weightDisplay}
        onSave={handleFieldSave('weight')}
      />
      <EditableField
        label="Body Fat"
        value={bodyFatDisplay}
        onSave={handleFieldSave('bodyFat')}
      />
      <EditableField
        label="Activity Level"
        value={activityLabel}
        onSave={handleActivitySave}
      />

      <View style={styles.footer}>
        <Text style={styles.lastUpdated}>
          Last updated: {getRelativeTime(metrics.recordedAt)}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MetricsHistory')}
          activeOpacity={0.7}
        >
          <Text style={styles.viewHistory}>View History →</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ── Edit-all sub-component (used for empty state + bulk edit) ──

interface EditAllModeProps {
  unitSystem: 'metric' | 'imperial';
  draftWeight: string;
  setDraftWeight: (v: string) => void;
  draftHeightCm: string;
  setDraftHeightCm: (v: string) => void;
  draftFeet: string;
  setDraftFeet: (v: string) => void;
  draftInches: string;
  setDraftInches: (v: string) => void;
  draftBodyFat: string;
  setDraftBodyFat: (v: string) => void;
  draftActivity: string;
  setDraftActivity: (v: string) => void;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

function EditAllMode({
  unitSystem,
  draftWeight,
  setDraftWeight,
  draftHeightCm,
  setDraftHeightCm,
  draftFeet,
  setDraftFeet,
  draftInches,
  setDraftInches,
  draftBodyFat,
  setDraftBodyFat,
  draftActivity,
  setDraftActivity,
  saving,
  error,
  onSave,
  onCancel,
}: EditAllModeProps) {
  return (
    <View style={editStyles.container}>
      {/* Weight */}
      <View style={editStyles.field}>
        <Text style={editStyles.label}>
          Weight ({unitSystem === 'imperial' ? 'lbs' : 'kg'})
        </Text>
        <TextInput
          style={editStyles.input}
          value={draftWeight}
          onChangeText={setDraftWeight}
          keyboardType="decimal-pad"
          placeholder={unitSystem === 'imperial' ? 'e.g. 176' : 'e.g. 80'}
          placeholderTextColor={colors.text.muted}
        />
      </View>

      {/* Height */}
      {unitSystem === 'imperial' ? (
        <View style={editStyles.field}>
          <Text style={editStyles.label}>Height (ft / in)</Text>
          <View style={editStyles.heightRow}>
            <TextInput
              style={[editStyles.input, editStyles.heightInput]}
              value={draftFeet}
              onChangeText={setDraftFeet}
              keyboardType="number-pad"
              placeholder="ft"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={editStyles.heightSep}>′</Text>
            <TextInput
              style={[editStyles.input, editStyles.heightInput]}
              value={draftInches}
              onChangeText={setDraftInches}
              keyboardType="number-pad"
              placeholder="in"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={editStyles.heightSep}>″</Text>
          </View>
        </View>
      ) : (
        <View style={editStyles.field}>
          <Text style={editStyles.label}>Height (cm)</Text>
          <TextInput
            style={editStyles.input}
            value={draftHeightCm}
            onChangeText={setDraftHeightCm}
            keyboardType="number-pad"
            placeholder="e.g. 180"
            placeholderTextColor={colors.text.muted}
          />
        </View>
      )}

      {/* Body Fat */}
      <View style={editStyles.field}>
        <Text style={editStyles.label}>Body Fat (%)</Text>
        <TextInput
          style={editStyles.input}
          value={draftBodyFat}
          onChangeText={setDraftBodyFat}
          keyboardType="decimal-pad"
          placeholder="e.g. 16"
          placeholderTextColor={colors.text.muted}
        />
      </View>

      {/* Activity Level */}
      <ActivityLevelPicker value={draftActivity} onChange={setDraftActivity} />

      {/* Error */}
      {error && <Text style={editStyles.error}>{error}</Text>}

      {/* Actions */}
      <View style={editStyles.actions}>
        <TouchableOpacity
          style={[editStyles.saveBtn, saving && editStyles.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <Text style={editStyles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
        {!saving && (
          <TouchableOpacity style={editStyles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={editStyles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  lastUpdated: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
  viewHistory: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});

const editStyles = StyleSheet.create({
  container: {
    paddingTop: spacing[2],
  },
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
  saveBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
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
