/**
 * MicronutrientDashboardScreen — Consolidated weekly micronutrient view.
 *
 * Shows:
 * - Nutrient Quality Score (0-100) with color ring
 * - Deficiency alerts (nutrients consistently below 50% RDA)
 * - Top 5 / Worst 5 nutrients by RDA%
 * - Full nutrient breakdown grouped by category with progress bars
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useMicroDashboard, NutrientSummary, DeficiencyAlert } from '../../hooks/useMicroDashboard';
import {
  getStatusColor,
  getStatusLabel,
  getScoreColor,
  getScoreLabel,
  formatNutrientValue,
  clampPct,
} from '../../utils/microDashboardLogic';
import { getWeekStart, formatWeekRange, getAdjacentWeek, isCurrentOrFutureWeek } from '../../utils/muscleVolumeLogic';

function NutrientRow({ nutrient }: { nutrient: NutrientSummary }) {
  const hasData = nutrient.status !== 'no_data' && (nutrient as any).has_data !== false;
  const barWidth = hasData ? clampPct(nutrient.rda_pct) : 0;
  const barColor = hasData ? getStatusColor(nutrient.status) : '#6B7280';

  return (
    <View style={styles.nutrientRow}>
      <View style={styles.nutrientHeader}>
        <Text style={[styles.nutrientLabel, { color: colors.text.primary }]}>{nutrient.label}</Text>
        <Text style={[styles.nutrientValue, { color: colors.text.muted }]}>
          {hasData
            ? `${formatNutrientValue(nutrient.daily_average, nutrient.unit)} / ${formatNutrientValue(nutrient.rda, nutrient.unit)}`
            : 'No data'}
        </Text>
      </View>
      <View style={[styles.barBg, { backgroundColor: colors.bg.surfaceRaised }]}>
        <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.rdaPct, { color: barColor }]}>
        {hasData ? `${nutrient.rda_pct.toFixed(0)}% RDA` : 'Not in your foods'}
      </Text>
    </View>
  );
}

function DeficiencyCard({ alert }: { alert: DeficiencyAlert }) {
  return (
    <View style={[styles.deficiencyCard, { backgroundColor: colors.semantic.negativeSubtle }]}>
      <View style={[styles.deficiencyDot, { backgroundColor: colors.semantic.negative }]} />
      <View style={styles.deficiencyContent}>
        <Text style={[styles.deficiencyLabel, { color: colors.text.primary }]}>{alert.label}</Text>
        <Text style={[styles.deficiencyDetail, { color: colors.text.muted }]}>
          {alert.deficit_pct.toFixed(0)}% below RDA · {alert.days_below_50pct}/{alert.total_days} days deficient
        </Text>
      </View>
    </View>
  );
}

export function MicronutrientDashboardScreen() {
  const c = useThemeColors();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }, [weekStart]);

  const { data, loading, error } = useMicroDashboard(weekStart, weekEnd);

  const sections = useMemo(() => {
    if (!data) return [];
    const groups: Record<string, NutrientSummary[]> = {};
    for (const n of data.nutrients) {
      (groups[n.group] ??= []).push(n);
    }
    return [
      { title: 'Vitamins', data: groups['vitamins'] ?? [] },
      { title: 'Minerals', data: groups['minerals'] ?? [] },
      { title: 'Fatty Acids', data: groups['fatty_acids'] ?? [] },
      { title: 'Other', data: groups['other'] ?? [] },
    ].filter(s => s.data.length > 0);
  }, [data]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={[styles.errorText, { color: c.semantic.negative }]}>{error ?? 'No data available'}</Text>
      </View>
    );
  }

  // Empty state — no nutrition data logged this week
  if (data.days_with_data === 0) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: c.bg.base }]} contentContainerStyle={styles.content}>
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setWeekStart(getAdjacentWeek(weekStart, 'prev'))}>
            <Text style={[styles.navArrow, { color: c.accent.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.weekLabel, { color: c.text.primary }]}>{formatWeekRange(weekStart)}</Text>
          <TouchableOpacity
            onPress={() => setWeekStart(getAdjacentWeek(weekStart, 'next'))}
            disabled={isCurrentOrFutureWeek(getAdjacentWeek(weekStart, 'next'))}
          >
            <Text style={[styles.navArrow, isCurrentOrFutureWeek(getAdjacentWeek(weekStart, 'next')) && styles.navDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: c.text.primary }]}>No nutrition data this week</Text>
          <Text style={[styles.emptySubtext, { color: c.text.muted }]}>
            Log your meals to see micronutrient insights, deficiency alerts, and your Nutrient Quality Score.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const scoreColor = getScoreColor(data.nutrient_score);
  const scoreLabel = getScoreLabel(data.nutrient_score);

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg.base }]} contentContainerStyle={styles.content}>
      {/* Week Navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekStart(getAdjacentWeek(weekStart, 'prev'))}>
          <Text style={[styles.navArrow, { color: c.accent.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.weekLabel, { color: c.text.primary }]}>{formatWeekRange(weekStart)}</Text>
        <TouchableOpacity
          onPress={() => setWeekStart(getAdjacentWeek(weekStart, 'next'))}
          disabled={isCurrentOrFutureWeek(getAdjacentWeek(weekStart, 'next'))}
        >
          <Text style={[styles.navArrow, isCurrentOrFutureWeek(getAdjacentWeek(weekStart, 'next')) && styles.navDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Score Card */}
      <View style={[styles.scoreCard, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreNumber, { color: scoreColor }]}>{data.nutrient_score.toFixed(0)}</Text>
        </View>
        <View style={styles.scoreInfo}>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
          <Text style={[styles.scoreSubtext, { color: c.text.muted }]}>
            Nutrient Quality Score · {data.days_with_data}/{data.days_tracked} days tracked
            {data.nutrients_with_data != null && ` · ${data.nutrients_with_data}/${data.total_nutrients} nutrients tracked`}
          </Text>
        </View>
      </View>

      {/* Deficiency Alerts */}
      {data.deficiencies.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>⚠️ Deficiency Alerts</Text>
          {data.deficiencies.slice(0, 5).map(a => (
            <DeficiencyCard key={a.key} alert={a} />
          ))}
        </View>
      )}

      {/* Top & Worst */}
      <View style={styles.topWorstRow}>
        <View style={[styles.topWorstCol, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>✅ Best</Text>
          {data.top_nutrients.map(n => (
            <Text key={n.key} style={[styles.topWorstItem, { color: c.text.secondary }]}>
              {n.label}: {n.rda_pct.toFixed(0)}%
            </Text>
          ))}
        </View>
        <View style={[styles.topWorstCol, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>🔻 Needs Work</Text>
          {data.worst_nutrients.map(n => (
            <Text key={n.key} style={[styles.topWorstItem, { color: c.text.secondary }]}>
              {n.label}: {n.rda_pct.toFixed(0)}%
            </Text>
          ))}
        </View>
      </View>

      {/* Full Breakdown */}
      <Text style={[styles.sectionTitle, { marginTop: spacing[4] }]}>Full Breakdown</Text>
      {sections.map(section => (
        <View key={section.title} style={styles.groupSection}>
          <Text style={[styles.groupTitle, { color: c.text.muted }]}>{section.title}</Text>
          {section.data.map(n => <NutrientRow key={n.key} nutrient={n} />)}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
  content: { padding: spacing[4], paddingBottom: spacing[8] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.semantic.negative, fontSize: typography.size.sm },
  emptyState: { alignItems: 'center', paddingVertical: spacing[8] },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text.primary, marginBottom: spacing[2] },
  emptySubtext: { fontSize: typography.size.sm, color: colors.text.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing[4] },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] },
  navArrow: { fontSize: 24, color: colors.accent.primary, paddingHorizontal: spacing[3] },
  navDisabled: { opacity: 0.3 },
  weekLabel: { fontSize: typography.size.sm, color: colors.text.primary, fontWeight: typography.weight.medium },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    backgroundColor: colors.bg.surface, borderRadius: radius.lg,
    padding: spacing[4], marginBottom: spacing[4],
    borderWidth: 1, borderColor: colors.border.subtle,
  },
  scoreRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreNumber: { fontSize: 24, fontWeight: typography.weight.bold },
  scoreInfo: { flex: 1 },
  scoreLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  scoreSubtext: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: 2 },
  section: { marginBottom: spacing[4] },
  sectionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text.primary, marginBottom: spacing[2] },
  deficiencyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.semantic.negativeSubtle, borderRadius: radius.md,
    padding: spacing[3], marginBottom: spacing[2],
  },
  deficiencyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.semantic.negative },
  deficiencyContent: { flex: 1 },
  deficiencyLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.text.primary },
  deficiencyDetail: { fontSize: typography.size.xs, color: colors.text.muted },
  topWorstRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  topWorstCol: { flex: 1, backgroundColor: colors.bg.surface, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.border.subtle },
  topWorstItem: { fontSize: typography.size.xs, color: colors.text.secondary, marginTop: 4 },
  groupSection: { marginBottom: spacing[4] },
  groupTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2] },
  nutrientRow: { marginBottom: spacing[3] },
  nutrientHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  nutrientLabel: { fontSize: typography.size.sm, color: colors.text.primary },
  nutrientValue: { fontSize: typography.size.xs, color: colors.text.muted },
  barBg: { height: 6, backgroundColor: colors.bg.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  rdaPct: { fontSize: typography.size.xs, marginTop: 2 },
});
