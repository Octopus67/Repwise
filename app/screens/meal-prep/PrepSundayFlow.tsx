import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import api from '../../services/api';
import { extractApiError } from '../../utils/extractApiError';
import type { ProfileScreenProps } from '../../types/navigation';
import { computeDaySummary, computeWeeklyMacroTotal } from '../../utils/mealPrepLogic';
import type { MacroSummary, MealAssignment } from '../../utils/mealPrepLogic';
import type { DayPlan } from '../../types/common';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

type Step = 'days' | 'slots' | 'fill' | 'review' | 'confirm';

export function PrepSundayFlow({ navigation }: ProfileScreenProps<'PrepSunday'>) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
      const { data } = await api.post('meal-plans/generate', {
        num_days: selectedDays.length,
        slot_splits: slots,
      });
      setDayPlans(data.days ?? []);
      setStep('review');
    } catch (e: unknown) {
      setError(extractApiError(e, 'Failed to generate meal plan'));
    } finally {
      setLoading(false);
    }
  }, [selectedDays, slots]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('meal-plans/save', {
        name: `Prep Sunday ${new Date().toLocaleDateString()}`,
        start_date: getLocalDateString(),
        days: dayPlans,
      });
      setStep('confirm');
    } catch (e: unknown) {
      setError(extractApiError(e, 'Failed to save meal plan'));
    } finally {
      setLoading(false);
    }
  }, [dayPlans]);

  const daySummaries = dayPlans.map((d) => computeDaySummary(d.assignments));
  const weeklySummary = daySummaries.length > 0 ? computeWeeklyMacroTotal(daySummaries) : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg.base }]}>
      <Text style={[styles.title, { color: c.text.primary }]}>Prep Sunday</Text>

      {loading && <ActivityIndicator size="large" color={c.accent.primary} />}
      {error && (
        <TouchableOpacity onPress={() => setError(null)} style={[styles.errorRow, { backgroundColor: c.bg.surface }]} accessibilityLabel="Dismiss error" accessibilityRole="button">{/* Audit fix 7.10 */}
          <Text style={[styles.error, { color: c.semantic.negative }]}>{error}</Text>
          <Text style={[styles.errorDismiss, { color: c.semantic.negative }]}>✕</Text>
        </TouchableOpacity>
      )}

      {step === 'days' && (
        <View>
          <Text style={[styles.stepLabel, { color: c.text.primary }]}>Step 1: Select Days</Text>
          {ALL_DAYS.map((day, idx) => (
            <TouchableOpacity key={day} style={styles.dayRow} onPress={() => toggleDay(idx)} accessibilityLabel={`Toggle ${day}`} accessibilityRole="button">{/* Audit fix 7.10 */}
              <View style={[styles.checkbox, selectedDays.includes(idx) && styles.checked]} />
              <Text style={[styles.dayText, { color: c.text.primary }]}>{day}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: c.accent.primary }]} onPress={() => setStep('slots')} accessibilityLabel="Next step" accessibilityRole="button">{/* Audit fix 7.10 */}
            <Text style={[styles.btnText, { color: c.text.primary }]}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'slots' && (
        <View>
          <Text style={[styles.stepLabel, { color: c.text.primary }]}>Step 2: Meal Slots</Text>
          {slots.map((s) => (
            <Text key={s} style={[styles.slotItem, { color: c.text.secondary }]}>• {s}</Text>
          ))}
          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.backBtn, { backgroundColor: c.bg.surface }]} onPress={() => setStep('days')} accessibilityLabel="Go back" accessibilityRole="button">{/* Audit fix 7.10 */}
              <Text style={[styles.btnText, { color: c.text.primary }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={loading}
              accessibilityLabel="Auto-fill meals" // Audit fix 7.10
              accessibilityRole="button" // Audit fix 7.10
            >
              <Text style={[styles.btnText, { color: c.text.primary }]}>Auto-Fill</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'review' && (
        <View>
          <Text style={[styles.stepLabel, { color: c.text.primary }]}>Step 3: Review</Text>
          {weeklySummary && (
            <Text style={[styles.weeklyText, { color: c.accent.primary }]}>
              Weekly: {weeklySummary.calories} cal · {weeklySummary.protein_g}g P
            </Text>
          )}
          {dayPlans.map((day, i) => (
            <View key={i} style={styles.reviewDay}>
              <Text style={[styles.reviewDayLabel, { color: c.text.primary }]}>{ALL_DAYS[selectedDays[i]] ?? `Day ${i + 1}`}</Text>
              <Text style={[styles.reviewMacros, { color: c.text.secondary }]}>
                {daySummaries[i]?.calories ?? 0} cal · {daySummaries[i]?.protein_g ?? 0}g P
              </Text>
            </View>
          ))}
          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.backBtn, { backgroundColor: c.bg.surface }]} onPress={() => setStep('slots')} accessibilityLabel="Go back" accessibilityRole="button">{/* Audit fix 7.10 */}
              <Text style={[styles.btnText, { color: c.text.primary }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.btnDisabled]}
              onPress={handleSave}
              disabled={loading}
              accessibilityLabel="Save plan" // Audit fix 7.10
              accessibilityRole="button" // Audit fix 7.10
            >
              <Text style={[styles.btnText, { color: c.text.primary }]}>Save Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'confirm' && (
        <View style={styles.confirmView}>
          <Text style={[styles.confirmText, { color: c.text.primary }]}>Plan saved! 🎉</Text>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: c.accent.primary }]}
            onPress={() => navigation?.navigate?.('MealPlan')}
            accessibilityLabel="View plan" // Audit fix 7.10
            accessibilityRole="button" // Audit fix 7.10
          >
            <Text style={[styles.btnText, { color: c.text.primary }]}>View Plan</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.base, padding: spacing[4] },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: c.text.primary, marginBottom: spacing[4] },
  stepLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: c.text.primary, marginBottom: spacing[3] },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2] },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: c.text.muted, marginRight: spacing[3] },
  checked: { backgroundColor: c.accent.primary, borderColor: c.accent.primary },
  dayText: { fontSize: typography.size.base, color: c.text.primary },
  slotItem: { fontSize: typography.size.base, color: c.text.secondary, paddingVertical: spacing[1] },
  navRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  nextBtn: { flex: 1, backgroundColor: c.accent.primary, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  backBtn: { flex: 1, backgroundColor: c.bg.surface, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  btnText: { color: c.text.primary, fontWeight: typography.weight.semibold },
  weeklyText: { fontSize: typography.size.base, color: c.accent.primary, marginBottom: spacing[3] },
  reviewDay: { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  reviewDayLabel: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: c.text.primary },
  reviewMacros: { fontSize: typography.size.sm, color: c.text.secondary },
  confirmView: { alignItems: 'center', paddingTop: spacing[8] },
  confirmText: { fontSize: typography.size.xl, color: c.text.primary, marginBottom: spacing[4] },
  error: { color: c.semantic.negative, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], backgroundColor: c.bg.surface, padding: spacing[2], borderRadius: 6 },
  errorDismiss: { color: c.semantic.negative, fontWeight: typography.weight.bold, paddingLeft: spacing[2] },
  btnDisabled: { opacity: 0.5 },
});
