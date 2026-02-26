import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';
import { computeDaySummary, computeWeeklySummary } from '../../utils/mealPrepLogic';
import type { MacroSummary, MealAssignment } from '../../utils/mealPrepLogic';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

interface DayPlan {
  day_index: number;
  assignments: MealAssignment[];
  unfilled_slots: string[];
}

type Step = 'days' | 'slots' | 'fill' | 'review' | 'confirm';

export function PrepSundayFlow({ navigation }: any) {
  const [step, setStep] = useState<Step>('days');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/meal-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_days: selectedDays.length }),
      });
      if (!res.ok) throw new Error('Failed to generate plan');
      const data = await res.json();
      setDayPlans(data.days ?? []);
      setStep('review');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/meal-plans/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Prep Sunday ${new Date().toLocaleDateString()}`,
          start_date: new Date().toISOString().split('T')[0],
          days: dayPlans,
        }),
      });
      if (!res.ok) throw new Error('Failed to save plan');
      setStep('confirm');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  }, [dayPlans]);

  const daySummaries = dayPlans.map((d) => computeDaySummary(d.assignments));
  const weeklySummary = daySummaries.length > 0 ? computeWeeklySummary(daySummaries) : null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Prep Sunday</Text>

      {loading && <ActivityIndicator size="large" color={colors.accent.primary} />}
      {error && (
        <TouchableOpacity onPress={() => setError(null)} style={styles.errorRow}>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.errorDismiss}>✕</Text>
        </TouchableOpacity>
      )}

      {step === 'days' && (
        <View>
          <Text style={styles.stepLabel}>Step 1: Select Days</Text>
          {ALL_DAYS.map((day, idx) => (
            <TouchableOpacity key={day} style={styles.dayRow} onPress={() => toggleDay(idx)}>
              <View style={[styles.checkbox, selectedDays.includes(idx) && styles.checked]} />
              <Text style={styles.dayText}>{day}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('slots')}>
            <Text style={styles.btnText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'slots' && (
        <View>
          <Text style={styles.stepLabel}>Step 2: Meal Slots</Text>
          {slots.map((s) => (
            <Text key={s} style={styles.slotItem}>• {s}</Text>
          ))}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('days')}>
              <Text style={styles.btnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={loading}
            >
              <Text style={styles.btnText}>Auto-Fill</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'review' && (
        <View>
          <Text style={styles.stepLabel}>Step 3: Review</Text>
          {weeklySummary && (
            <Text style={styles.weeklyText}>
              Weekly: {weeklySummary.calories} cal · {weeklySummary.protein_g}g P
            </Text>
          )}
          {dayPlans.map((day, i) => (
            <View key={i} style={styles.reviewDay}>
              <Text style={styles.reviewDayLabel}>{ALL_DAYS[selectedDays[i]] ?? `Day ${i + 1}`}</Text>
              <Text style={styles.reviewMacros}>
                {daySummaries[i]?.calories ?? 0} cal · {daySummaries[i]?.protein_g ?? 0}g P
              </Text>
            </View>
          ))}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('slots')}>
              <Text style={styles.btnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.btnDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.btnText}>Save Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'confirm' && (
        <View style={styles.confirmView}>
          <Text style={styles.confirmText}>Plan saved! 🎉</Text>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => navigation?.navigate?.('MealPlan')}
          >
            <Text style={styles.btnText}>View Plan</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base, padding: spacing[4] },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.text.primary, marginBottom: spacing[4] },
  stepLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text.primary, marginBottom: spacing[3] },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2] },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.text.muted, marginRight: spacing[3] },
  checked: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
  dayText: { fontSize: typography.size.base, color: colors.text.primary },
  slotItem: { fontSize: typography.size.base, color: colors.text.secondary, paddingVertical: spacing[1] },
  navRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  nextBtn: { flex: 1, backgroundColor: colors.accent.primary, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  backBtn: { flex: 1, backgroundColor: colors.bg.surface, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  btnText: { color: colors.text.primary, fontWeight: typography.weight.semibold },
  weeklyText: { fontSize: typography.size.base, color: colors.accent.primary, marginBottom: spacing[3] },
  reviewDay: { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  reviewDayLabel: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary },
  reviewMacros: { fontSize: typography.size.sm, color: colors.text.secondary },
  confirmView: { alignItems: 'center', paddingTop: spacing[8] },
  confirmText: { fontSize: typography.size.xl, color: colors.text.primary, marginBottom: spacing[4] },
  error: { color: colors.semantic.negative, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], backgroundColor: colors.bg.surface, padding: spacing[2], borderRadius: 6 },
  errorDismiss: { color: colors.semantic.negative, fontWeight: typography.weight.bold, paddingLeft: spacing[2] },
  btnDisabled: { opacity: 0.5 },
});
