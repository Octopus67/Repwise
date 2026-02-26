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
import { Card } from '../../components/common/Card';
import { computeDaySummary, computeWeeklySummary } from '../../utils/mealPrepLogic';
import type { MacroSummary, MealAssignment } from '../../utils/mealPrepLogic';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayPlan {
  day_index: number;
  assignments: MealAssignment[];
  unfilled_slots: string[];
}

interface GeneratedPlan {
  days: DayPlan[];
  weekly_macro_summary: MacroSummary;
}

export function MealPlanScreen({ navigation }: any) {
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/meal-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_days: 5 }),
      });
      if (!res.ok) throw new Error('Failed to generate plan');
      const data = await res.json();
      setPlan(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/meal-plans/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Meal Plan ${new Date().toLocaleDateString()}`,
          start_date: new Date().toISOString().split('T')[0],
          days: plan.days,
        }),
      });
      if (!res.ok) throw new Error('Failed to save plan');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }, [plan]);

  const daySummaries = plan?.days.map((d) => computeDaySummary(d.assignments)) ?? [];
  const weeklySummary = daySummaries.length > 0 ? computeWeeklySummary(daySummaries) : null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Meal Prep</Text>

      {weeklySummary && (
        <Card style={styles.weeklyCard}>
          <Text style={styles.weeklyLabel}>Weekly Totals</Text>
          <Text style={styles.macroText}>
            {weeklySummary.calories} cal · {weeklySummary.protein_g}g P ·{' '}
            {weeklySummary.carbs_g}g C · {weeklySummary.fat_g}g F
          </Text>
        </Card>
      )}

      {loading && <ActivityIndicator size="large" color={colors.accent.primary} />}
      {error && (
        <TouchableOpacity onPress={() => setError(null)} style={styles.errorRow}>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.errorDismiss}>✕</Text>
        </TouchableOpacity>
      )}

      {plan?.days.map((day) => {
        const summary = computeDaySummary(day.assignments);
        return (
          <Card key={day.day_index} style={styles.dayCard}>
            <Text style={styles.dayLabel}>{DAY_LABELS[day.day_index] ?? `Day ${day.day_index + 1}`}</Text>
            {day.assignments.map((a, i) => (
              <View key={i} style={styles.slotRow}>
                <Text style={styles.slotName}>{a.slot}</Text>
                <Text style={styles.foodName}>{a.name}</Text>
                <Text style={styles.slotCal}>{a.calories} cal</Text>
              </View>
            ))}
            {day.unfilled_slots.map((s) => (
              <View key={s} style={styles.slotRow}>
                <Text style={styles.slotName}>{s}</Text>
                <Text style={styles.unfilled}>Unfilled</Text>
              </View>
            ))}
            <Text style={styles.daySummary}>
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
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <Text style={styles.btnText}>Generate Plan</Text>
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
                <ActivityIndicator color={colors.text.primary} size="small" />
              ) : (
                <Text style={styles.btnText}>Save Plan</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => navigation?.navigate?.('ShoppingList')}
            >
              <Text style={styles.btnText}>Shopping List</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base, padding: spacing[4] },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.text.primary, marginBottom: spacing[4] },
  weeklyCard: { marginBottom: spacing[4], padding: spacing[3] },
  weeklyLabel: { fontSize: typography.size.sm, color: colors.text.muted, marginBottom: spacing[1] },
  macroText: { fontSize: typography.size.base, color: colors.text.primary },
  dayCard: { marginBottom: spacing[3], padding: spacing[3] },
  dayLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text.primary, marginBottom: spacing[2] },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] },
  slotName: { fontSize: typography.size.sm, color: colors.text.muted, width: 80 },
  foodName: { flex: 1, fontSize: typography.size.sm, color: colors.text.primary },
  slotCal: { fontSize: typography.size.sm, color: colors.text.secondary },
  unfilled: { fontSize: typography.size.sm, color: colors.semantic.negative, fontStyle: 'italic' },
  daySummary: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: spacing[2], textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[8] },
  btn: { flex: 1, backgroundColor: colors.accent.primary, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnSecondary: { flex: 1, backgroundColor: colors.bg.surface, padding: spacing[3], borderRadius: 8, alignItems: 'center' },
  btnText: { color: colors.text.primary, fontWeight: typography.weight.semibold },
  error: { color: colors.semantic.negative, flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], backgroundColor: colors.semantic.negativeSubtle ?? colors.bg.surface, padding: spacing[2], borderRadius: 6 },
  errorDismiss: { color: colors.semantic.negative, fontWeight: typography.weight.bold, paddingLeft: spacing[2] },
});
