import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, opacityScale } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { groupMicroFields, MicroField } from '../../utils/microNutrientSerializer';
import { getRDA, computeRDAPercentage, rdaColor, Sex } from '../../utils/rdaValues';
import { useStore } from '../../store';
import { useOnboardingStore, computeAge } from '../../store/onboardingSlice';
import { Icon } from '../../components/common/Icon';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import api from '../../services/api';
import { formatDateISO } from '../../utils/formatting';
import type { AnalyticsScreenProps } from '../../types/navigation';

type NutritionEntry = import('../../types/nutrition').NutritionEntry & { meal_name: string };

interface ContributingFood {
  foodName: string;
  amount: number;
  percentage: number;
}

const getCOLOR_MAP = (c: ThemeColors) => ({
  green: c.semantic.positive,
  yellow: c.semantic.warning,
  red: c.semantic.negative,
} as const);

function computeNutrientContributions(
  entries: NutritionEntry[],
  nutrientKey: string,
): ContributingFood[] {
  const contributions = entries
    .filter((e) => e.micro_nutrients?.[nutrientKey] != null && e.micro_nutrients[nutrientKey] > 0)
    .map((e) => ({
      foodName: e.food_name || e.meal_name || 'Unknown',
      amount: e.micro_nutrients![nutrientKey],
    }));
  const total = contributions.reduce((sum, c) => sum + c.amount, 0);
  return contributions
    .map((c) => ({ ...c, percentage: total > 0 ? (c.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function NutrientRow({
  field,
  intake,
  rda,
  entries,
}: {
  field: MicroField;
  intake: number;
  rda: number;
  entries: NutritionEntry[];
}) {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const percentage = rda > 0 ? computeRDAPercentage(intake, rda) : 0;
  const colorKey = rdaColor(percentage);
  const barColor = getCOLOR_MAP(c)[colorKey];
  const barWidth = Math.min(percentage, 100);
  const hasData = intake > 0;

  const contributions = expanded ? computeNutrientContributions(entries, field.key) : [];

  return (
    <TouchableOpacity
      style={[getStyles().nutrientRow, { backgroundColor: c.bg.surface }]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={getStyles().nutrientHeader}>
        <Text style={[getStyles().nutrientLabel, { color: c.text.primary }]}>{field.label}</Text>
        <View style={getStyles().nutrientValues}>
          {hasData ? (
            <>
              <Text style={[getStyles().intakeText, { color: c.text.secondary }]}>
                {intake.toFixed(1)} {field.unit}
              </Text>
              {rda > 0 && (
                <Text style={[getStyles().rdaActual, { color: c.text.muted }]}>/ {rda.toFixed(0)}{field.unit}</Text>
              )}
              {rda > 0 && (
                <Text style={[getStyles().rdaPct, { color: barColor }]}>
                  {Math.round(percentage)}%
                </Text>
              )}
            </>
          ) : (
            <Text style={[getStyles().noDataText, { color: c.text.muted }]}>—</Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[getStyles().barTrack, { backgroundColor: c.bg.surfaceRaised }]}>
        {hasData && rda > 0 && (
          <View
            style={[
              getStyles().barFill,
              { width: `${barWidth}%`, backgroundColor: barColor },
            ]}
          />
        )}
      </View>

      {/* Expanded: top contributing foods */}
      {expanded && hasData && contributions.length > 0 && (
        <View style={[getStyles().contributionList, { borderTopColor: c.border.subtle }]}>
          {contributions.map((item, i) => (
            <View key={i} style={getStyles().contributionRow}>
              <Text style={[getStyles().contributionName, { color: c.text.secondary }]} numberOfLines={1}>
                {item.foodName}
              </Text>
              <Text style={[getStyles().contributionAmount, { color: c.text.muted }]}>
                {item.amount.toFixed(1)} {field.unit}
              </Text>
              <Text style={[getStyles().contributionPct, { color: c.text.muted }]}>
                {Math.round(item.percentage)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function NutritionReportScreen({ navigation }: { navigation?: AnalyticsScreenProps<'NutritionReport'>['navigation'] }) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useStore();
  const birthYear = useOnboardingStore((s) => s.birthYear);
  const birthMonth = useOnboardingStore((s) => s.birthMonth);
  const sex = useOnboardingStore((s) => s.sex);
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyTotals, setDailyTotals] = useState<Record<string, number>>({});

  // Use real profile data when available, fall back to defaults
  const userAge: number = birthYear ? computeAge(birthYear, birthMonth) : 30;
  const userSex: Sex = (sex as Sex) || 'male';

  // Hide the warning banner when real data is available
  const profileIncomplete = !birthYear || !sex;

  const sections = groupMicroFields();

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('nutrition/entries', {
        params: { start_date: selectedDate, end_date: selectedDate, limit: 200 },
      });
      const items: NutritionEntry[] = data.items ?? [];
      setEntries(items);

      // Aggregate daily totals for each micro nutrient
      const totals: Record<string, number> = {};
      for (const entry of items) {
        if (entry.micro_nutrients) {
          for (const [key, val] of Object.entries(entry.micro_nutrients)) {
            if (typeof val === 'number' && val > 0) {
              totals[key] = (totals[key] ?? 0) + val;
            }
          }
        }
      }
      setDailyTotals(totals);
    } catch (err: unknown) {
      setError('Failed to load nutrition data. Pull down to retry.');
      setEntries([]);
      setDailyTotals({});
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDateISO(d));
  };

  function formatDisplayDate(isoDate: string): string {
    const d = new Date(isoDate + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const todayStr = formatDateISO(new Date());
  const canGoForward = selectedDate < todayStr;

  const hasAnyData = Object.keys(dailyTotals).length > 0;

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={getStyles().sectionHeader}>
      <Text style={[getStyles().sectionTitle, { color: c.text.primary }]}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: MicroField }) => {
    const intake = dailyTotals[item.key] ?? 0;
    const rda = getRDA(item.key, userSex, userAge);
    return <NutrientRow field={item} intake={intake} rda={rda} entries={entries} />;
  };

  return (
    <SafeAreaView style={[getStyles().safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      {/* Header */}
      <View style={getStyles().header}>
        {navigation && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={getStyles().backBtn}>
            <Text style={[getStyles().backText, { color: c.accent.primary }]}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={[getStyles().title, { color: c.text.primary }]}>Nutrition Report</Text>
      </View>

      {/* Date selector */}
      <View style={getStyles().dateRow}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={getStyles().dateArrow}>
          <Text style={[getStyles().dateArrowText, { color: c.accent.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[getStyles().dateText, { color: c.text.primary }]}>{formatDisplayDate(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => canGoForward && changeDate(1)}
          style={getStyles().dateArrow}
          disabled={!canGoForward}
        >
          <Text style={[getStyles().dateArrowText, !canGoForward && getStyles().dateArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => { setError(null); loadEntries(); }}
          onDismiss={() => setError(null)}
        />
      )}

      {/* RDA defaults warning */}
      {profileIncomplete && (
        <View style={[getStyles().rdaWarningBanner, { backgroundColor: c.semantic.warningSubtle }]}>
          <Text style={[getStyles().rdaWarningText, { color: c.semantic.warning }]}>
            <Icon name="warning" /> RDA values use defaults (age 30, male). Set your profile for accurate values.
          </Text>
          <TouchableOpacity
            onPress={() => navigation?.getParent()?.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Text style={[getStyles().rdaWarningLink, { color: c.semantic.warning }]}>Set Profile →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={getStyles().emptyContainer}>
          <ActivityIndicator size="large" color={c.accent.primary} />
        </View>
      ) : !hasAnyData ? (
        <View style={getStyles().emptyContainer}>
          <Text style={getStyles().emptyIcon}><Icon name="salad" /></Text>
          <Text style={[getStyles().emptyTitle, { color: c.text.primary }]}>No nutrient data</Text>
          <Text style={[getStyles().emptyText, { color: c.text.muted }]}>Log food to see your nutrition report</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={getStyles().listContent}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backBtn: { marginRight: spacing[3], minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: c.accent.primary, fontSize: typography.size['2xl'], lineHeight: typography.lineHeight['2xl'] },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.xl,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    gap: spacing[4],
  },
  dateArrow: { padding: spacing[2], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dateArrowText: { color: c.accent.primary, fontSize: typography.size['2xl'], lineHeight: typography.lineHeight['2xl'] },
  dateArrowDisabled: { color: c.text.muted, opacity: opacityScale.disabled },
  dateText: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.md,
  },
  listContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[12] },
  sectionHeader: {
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
  nutrientRow: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  nutrientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  nutrientLabel: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
    flex: 1,
  },
  nutrientValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  intakeText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  rdaPct: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
    minWidth: 40,
    textAlign: 'right',
  },
  rdaActual: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  noDataText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  barTrack: {
    height: 6,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  contributionList: {
    marginTop: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  contributionName: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    flex: 1,
  },
  contributionAmount: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginRight: spacing[2],
  },
  contributionPct: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    width: 36,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
    marginBottom: spacing[2],
  },
  emptyText: {
    color: c.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
  },
  rdaWarningBanner: {
    backgroundColor: c.semantic.warningSubtle,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  rdaWarningText: {
    color: c.semantic.warning,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    flex: 1,
  },
  rdaWarningLink: {
    color: c.semantic.warning,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});
