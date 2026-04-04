import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import api from '../../services/api';
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  CATEGORIES,
  validateCustomExerciseForm,
  buildCustomExercisePayload,
  type CustomExerciseFormData,
} from '../../utils/customExerciseValidation';

interface CustomExerciseFormProps {
  initialName?: string;
  onCreated: (exercise: { id: string; name: string }) => void;
  onCancel: () => void;
}

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CustomExerciseForm({ initialName = '', onCreated, onCancel }: CustomExerciseFormProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [form, setForm] = useState<CustomExerciseFormData>({
    name: initialName,
    muscleGroup: '',
    equipment: '',
    category: 'compound',
    secondaryMuscles: [],
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = useCallback(<K extends keyof CustomExerciseFormData>(key: K, value: CustomExerciseFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const toggleSecondaryMuscle = useCallback((mg: string) => {
    setForm((prev) => {
      const current = prev.secondaryMuscles;
      const next = current.includes(mg)
        ? current.filter((m) => m !== mg)
        : [...current, mg];
      return { ...prev, secondaryMuscles: next };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const result = validateCustomExerciseForm(form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildCustomExercisePayload(form);
      const res = await api.post('training/exercises/custom', payload);
      onCreated({ id: res.data.id, name: res.data.name });
    } catch {
      Alert.alert('Error', 'Failed to create custom exercise. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [form, onCreated]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg.base }]} contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Create Custom Exercise</Text>

      {/* Name */}
      <Text style={[styles.label, { color: c.text.secondary }]}>Name *</Text>
      <TextInput
        style={[styles.input, errors.name ? styles.inputError : null]}
        value={form.name}
        onChangeText={(t) => updateField('name', t)}
        placeholder="e.g. Landmine Press"
        placeholderTextColor={c.text.muted}
        maxLength={200}
        accessibilityLabel="Exercise name"
      />
      {errors.name && <Text style={[styles.errorText, { color: c.semantic.negative }]}>{errors.name}</Text>}

      {/* Muscle Group */}
      <Text style={[styles.label, { color: c.text.secondary }]}>Muscle Group *</Text>
      <View style={styles.chipGrid}>
        {MUSCLE_GROUPS.map((mg) => (
          <TouchableOpacity
            key={mg}
            style={[styles.selectChip, form.muscleGroup === mg && styles.selectChipActive]}
            onPress={() => updateField('muscleGroup', mg)}
            accessibilityRole="button"
            accessibilityState={{ selected: form.muscleGroup === mg }}
          >
            <Text style={[styles.selectChipText, form.muscleGroup === mg && styles.selectChipTextActive]}>
              {capitalize(mg)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.muscleGroup && <Text style={[styles.errorText, { color: c.semantic.negative }]}>{errors.muscleGroup}</Text>}

      {/* Equipment */}
      <Text style={[styles.label, { color: c.text.secondary }]}>Equipment *</Text>
      <View style={styles.chipGrid}>
        {EQUIPMENT_TYPES.map((eq) => (
          <TouchableOpacity
            key={eq}
            style={[styles.selectChip, form.equipment === eq && styles.selectChipActive]}
            onPress={() => updateField('equipment', eq)}
            accessibilityRole="button"
            accessibilityState={{ selected: form.equipment === eq }}
          >
            <Text style={[styles.selectChipText, form.equipment === eq && styles.selectChipTextActive]}>
              {capitalize(eq)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.equipment && <Text style={[styles.errorText, { color: c.semantic.negative }]}>{errors.equipment}</Text>}

      {/* Category */}
      <Text style={[styles.label, { color: c.text.secondary }]}>Category</Text>
      <View style={styles.chipGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.selectChip, form.category === cat && styles.selectChipActive]}
            onPress={() => updateField('category', cat)}
            accessibilityRole="button"
            accessibilityState={{ selected: form.category === cat }}
          >
            <Text style={[styles.selectChipText, form.category === cat && styles.selectChipTextActive]}>
              {capitalize(cat)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Secondary Muscles */}
      <Text style={[styles.label, { color: c.text.secondary }]}>Secondary Muscles (optional)</Text>
      <View style={styles.chipGrid}>
        {MUSCLE_GROUPS.filter((mg) => mg !== form.muscleGroup).map((mg) => (
          <TouchableOpacity
            key={mg}
            style={[styles.selectChip, form.secondaryMuscles.includes(mg) && styles.selectChipActive]}
            onPress={() => toggleSecondaryMuscle(mg)}
            accessibilityRole="button"
            accessibilityState={{ selected: form.secondaryMuscles.includes(mg) }}
          >
            <Text style={[styles.selectChipText, form.secondaryMuscles.includes(mg) && styles.selectChipTextActive]}>
              {capitalize(mg)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notes */}
      <Text style={[styles.label, { color: c.text.secondary }]}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={form.notes}
        onChangeText={(t) => updateField('notes', t)}
        placeholder="Any notes about this exercise..."
        placeholderTextColor={c.text.muted}
        multiline
        numberOfLines={3}
        accessibilityLabel="Exercise notes"
      />

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: c.border.subtle }]} onPress={onCancel} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: c.text.secondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Save custom exercise"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={c.text.primary} />
          ) : (
            <Text style={[styles.submitText, { color: c.text.primary }]}>Save Exercise</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg.base,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  heading: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[4],
  },
  label: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  input: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.subtle,
    color: c.text.primary,
    fontSize: typography.size.base,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  inputError: {
    borderColor: c.semantic.negative,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: c.semantic.negative,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  selectChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  selectChipActive: {
    backgroundColor: c.accent.primaryMuted,
    borderColor: c.accent.primary,
  },
  selectChipText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  selectChipTextActive: {
    color: c.accent.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[3],
    marginTop: spacing[6],
  },
  cancelBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  cancelText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  submitBtn: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: c.accent.primary,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
