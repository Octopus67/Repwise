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
import { Card } from '../../components/common/Card';
import api from '../../services/api';
import { extractApiError } from '../../utils/extractApiError';
import type { ProfileScreenProps } from '../../types/navigation';
import { computeDaySummary, computeWeeklyMacroTotal } from '../../utils/mealPrepLogic';
import type { MacroSummary, MealAssignment } from '../../utils/mealPrepLogic';
import type { DayPlan } from '../../types/common';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface GeneratedPlan {
  days: DayPlan[];
  weekly_macro_summary: MacroSummary;
}

export function MealPlanScreen({ navigation }: ProfileScreenProps<'MealPlan'>) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('meal-plans/generate', { num_days: 5 });
      setPlan(data);
    } catch (e: unknown) {
      setError(extractApiError(e, 'Failed to generate meal plan'));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('meal-plans/save', {
        name: `Meal Plan ${new Date().toLocaleDateString()}`,
        start_date: getLocalDateString(),
        days: plan.days,
      });
    } catch (e: unknown) {
      setError(extractApiError(e, 'Failed to save meal plan'));
    } finally {
      setSaving(false);
    }
  }, [plan]);

  const daySummaries = plan?.days.map((d) => computeDaySummary(d.assignments)) ?? [];
  const weeklySummary = daySummaries.length > 0 ? computeWeeklyMacroTotal(daySummaries) : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg.base }]}>
      <Text style={[styles.title, { color: c.text.primary }]}>Meal Prep</Text>

      {weeklySummary && (
        <Card style={styles.weeklyCard}>
          <Text style={[styles.weeklyLabel, { color: c.text.muted }]}>Weekly Totals</Text>
          <Text style={[styles.macroText, { color: c.text.primary }]}>
            {weeklySummary.calories} cal · {weeklySummary.protein_g}g P ·{' '}
            {weeklySummary.carbs_g}g C · {weeklySummary.fat_g}g F
          </Text>
        </Card>
      )}

      {loading && <ActivityIndicator size="large" color={c.accent.primary} />}
      {error && (
        <TouchableOpacity onPress={() => setError(null)} style={[styles.errorRow, { backgroundColor: c.semantic.negativeSubtle }]}>
          <Text style={[styles.error, { color: c.semantic.negative }]}>{error}</Text>
          <Text style={[styles.errorDismiss, { color: c.semantic.negative }]}>✕</Text>
        </TouchableOpacity>
      )}

      {plan?.days.map((day) => {
        const summary = computeDaySummary(day.assignments);
        return (
          <Card key={day.day_index} style={styles.dayCard}>
            <Text style={[styles.dayLabel, { color: c.text.primary }]}>{DAY_LABELS[day.day_index] ?? `Day ${day.day_index + 1}`}</Text>
            {day.assignments.map((a, i) => (
              <View key={i} style={styles.slotRow}>
                <Text style={[styles.slotName, { color: c.text.muted }]}>{a.slot}</Text>
                <Text style={[styles.foodName, { color: c.text.primary }]}>{a.name}</Text>
                <Text style={[styles.slotCal, { color: c.text.secondary }]}>{a.calories} cal</Text>
              </View>
            ))}
            {day.unfilled_slots.map((s) => (
              <View key={s} style={styles.slotRow}>
                <Text style={[styles.slotName, { color: c.text.muted }]}>{s}</Text>
                <Text style={[styles.unfilled, { color: c.semantic.negative }]}>Unfilled</Text>
              </View>
            ))}
            <Text style={[styles.daySummary, { color: c.text.muted }]}>
              {summary.calories} cal · {summary.protein_g}g P · {summary.carbs_g}g C · {summary.fat_g}g F
            </Text>
          </Card>
        );
      })}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={c.text.primary} size="small" />
          ) : (
            <Text style={[styles.btnText, { color: c.text.primary }]}>Generate Plan</Text>
          )}
        </TouchableOpacity>
        {plan && (
          <>
            <TouchableOpacity
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.text.primary} size="small" />
              ) : (
                <Text style={[styles.btnText, { color: c.text.primary }]}>Save Plan</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondary, { backgroundColor: c.bg.surface }]}
              onPress={() => navigation.navigate('ShoppingList', { planId: 'current' })}
            >
              <Text style={[styles.btnText, { color: c.text.primary }]}>Shopping List</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.base, padding: spacing[4] },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: c.text.primary, marginBottom: spacing[4] },
  weeklyCard: { marginBottom: spacing[4], padding: spacing[3] },
  weeklyLabel: { fontSize: typography.size.sm, color: c.text.muted, marginBottom: spacing[1] },
  macroText: { fontSize: typography.size.base, color: c.text.primary },
  dayCard: { marginBottom: spacing[3], padding: spacing[3] },
  dayLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: c.text.primary, marginBottom: spacing[2] },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] },
  slotName: { fontSize: typography.size.sm, color: c.text.muted, width: 80 },
  foodName: { flex: 1, fontSize: typography.size.sm, color: c.text.primary },
  slotCal: { fontSize: typography.size.sm, color: c.text.secondary },
  unfilled: { fontSize: typography.size.sm, color: c.semantic.negative, fontStyle: 'italic' },
  daySummary: { fontSize: typography.size.xs, color: c.text.muted, marginTop: spacing[2], textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[8] },
  btn: { flex: 1, backgroundColor: c.accent.primary, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnSecondary: { flex: 1, backgroundColor: c.bg.surface, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  btnText: { color: c.text.primary, fontWeight: typography.weight.semibold },
  error: { color: c.semantic.negative, flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], backgroundColor: c.semantic.negativeSubtle ?? c.bg.surface, padding: spacing[2], borderRadius: 6 },
  errorDismiss: { color: c.semantic.negative, fontWeight: typography.weight.bold, paddingLeft: spacing[2] },
});
