/**
 * MeasurementInput — Form for entering body measurements.
 * Supports metric/imperial toggle. All values stored in metric.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { radius, spacing, typography, opacityScale } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../common/Button';
import { useStore } from '../../store';
import { lbsToKg, kgToLbs } from '../../utils/unitConversion';
import { inchesToCm, cmToInches } from '../../utils/navyBFCalculator';
import { validateMeasurementForm } from '../../utils/measurementValidation';
import type { MeasurementFormData } from '../../types/measurements';

interface MeasurementInputProps {
  onSubmit: (data: MeasurementFormData) => void;
  loading?: boolean;
  onOpenNavyCalc?: () => void;
  bodyFatPctFromCalc?: string;
}

const CIRCUMFERENCE_FIELDS = [
  { key: 'waist' as const, label: 'Waist' },
  { key: 'neck' as const, label: 'Neck' },
  { key: 'hips' as const, label: 'Hips' },
  { key: 'chest' as const, label: 'Chest' },
  { key: 'bicepLeft' as const, label: 'Bicep (Left)' },
  { key: 'bicepRight' as const, label: 'Bicep (Right)' },
  { key: 'thighLeft' as const, label: 'Thigh (Left)' },
  { key: 'thighRight' as const, label: 'Thigh (Right)' },
  { key: 'calfLeft' as const, label: 'Calf (Left)' },
  { key: 'calfRight' as const, label: 'Calf (Right)' },
];

function todayISO(): string {
  return getLocalDateString();
}

export function MeasurementInput({ onSubmit, loading, onOpenNavyCalc, bodyFatPctFromCalc }: MeasurementInputProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const unitSystem = useStore((s) => s.unitSystem);
  const isImperial = unitSystem === 'imperial';
  const weightUnit = isImperial ? 'lbs' : 'kg';
  const lengthUnit = isImperial ? 'in' : 'cm';

  const [form, setForm] = useState<MeasurementFormData>({
    measuredAt: todayISO(),
    weight: '', bodyFatPct: '', waist: '', neck: '', hips: '',
    chest: '', bicepLeft: '', bicepRight: '', thighLeft: '', thighRight: '',
    calfLeft: '', calfRight: '', notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof MeasurementFormData, string>>>({});

  useEffect(() => {
    if (bodyFatPctFromCalc) {
      updateField('bodyFatPct', bodyFatPctFromCalc);
    }
  }, [bodyFatPctFromCalc]);

  const updateField = useCallback((field: keyof MeasurementFormData, value: string) => {
    // Prevent future dates using proper date comparison
    if (field === 'measuredAt') {
      const parsed = new Date(value + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!isNaN(parsed.getTime()) && parsed > today) return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    // Convert to metric for validation
    const metricForm: MeasurementFormData = { ...form };

    if (isImperial) {
      if (form.weight.trim()) {
        metricForm.weight = String(lbsToKg(parseFloat(form.weight)));
      }
      for (const f of CIRCUMFERENCE_FIELDS) {
        if (form[f.key].trim()) {
          metricForm[f.key] = String(inchesToCm(parseFloat(form[f.key])));
        }
      }
    }

    const result = validateMeasurementForm(metricForm);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    onSubmit(metricForm);
  }, [form, isImperial, onSubmit]);

  const renderField = (
    key: keyof MeasurementFormData,
    label: string,
    unit: string,
    placeholder: string,
  ) => (
    <View style={styles.field} key={key}>
      <Text style={[styles.label, { color: c.text.muted }]}>{label} ({unit})</Text>
      <TextInput
        style={[styles.input, errors[key] ? styles.inputError : undefined]}
        value={form[key]}
        onChangeText={(v) => updateField(key, v)}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={c.text.muted}
        accessibilityLabel={`${label} in ${unit}`}
      />
      {errors[key] ? <Text style={[styles.errorText, { color: c.semantic.negative }]}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Date */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: c.text.muted }]}>Date</Text>
        <TextInput
          style={[styles.input, errors.measuredAt ? styles.inputError : undefined]}
          value={form.measuredAt}
          onChangeText={(v) => updateField('measuredAt', v)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.text.muted}
          accessibilityLabel="Measurement date"
        />
        {errors.measuredAt ? <Text style={[styles.errorText, { color: c.semantic.negative }]}>{errors.measuredAt}</Text> : null}
      </View>

      {/* Weight */}
      {renderField('weight', 'Weight', weightUnit, isImperial ? '176' : '80')}

      {/* Body Fat */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: c.text.muted }]}>Body Fat (%)</Text>
          {onOpenNavyCalc && (
            <TouchableOpacity onPress={onOpenNavyCalc} accessibilityRole="button" accessibilityLabel="Open Navy BF calculator">
              <Text style={[styles.calcLink, { color: c.accent.primary }]}>Navy Calculator →</Text>
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={[styles.input, errors.bodyFatPct ? styles.inputError : undefined]}
          value={form.bodyFatPct}
          onChangeText={(v) => updateField('bodyFatPct', v)}
          keyboardType="decimal-pad"
          placeholder="e.g. 16"
          placeholderTextColor={c.text.muted}
          accessibilityLabel="Body fat percentage"
        />
        {errors.bodyFatPct ? <Text style={[styles.errorText, { color: c.semantic.negative }]}>{errors.bodyFatPct}</Text> : null}
      </View>

      {/* Circumference fields */}
      {CIRCUMFERENCE_FIELDS.map((f) =>
        renderField(f.key, f.label, lengthUnit, isImperial ? '32' : '80'),
      )}

      {/* Notes */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: c.text.muted }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={form.notes}
          onChangeText={(v) => updateField('notes', v)}
          placeholder="Optional notes..."
          placeholderTextColor={c.text.muted}
          multiline
          numberOfLines={3}
          accessibilityLabel="Measurement notes"
        />
      </View>

      <Button
        title="Save Measurement"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
        testID="save-measurement-btn"
      />
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  field: { marginBottom: spacing[3] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    color: c.text.muted, fontSize: typography.size.sm,
    fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[1],
  },
  calcLink: {
    color: c.accent.primary, fontSize: typography.size.sm,
    fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm,
  },
  input: {
    color: c.text.primary, fontSize: typography.size.base,
    backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  inputError: { borderColor: c.semantic.negative },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  errorText: {
    color: c.semantic.negative, fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs, marginTop: spacing[0.5],
  },
  submitBtn: { marginTop: spacing[2], marginBottom: spacing[6] },
});
