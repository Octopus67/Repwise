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
import { colors, radius, spacing, typography, opacityScale } from '../../theme/tokens';
import { groupMicroFields, MicroField } from '../../utils/microNutrientSerializer';
import { getRDA, computeRDAPercentage, rdaColor, Sex } from '../../utils/rdaValues';
import { useStore } from '../../store';
import { useOnboardingStore, computeAge } from '../../store/onboardingSlice';
import { Icon } from '../../components/common/Icon';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import api from '../../services/api';

interface NutritionEntry {
  meal_name: string;
  food_name?: string;
  micro_nutrients: Record<string, number> | null;
}

interface ContributingFood {
  foodName: string;
  amount: number;
  percentage: number;
}

const COLOR_MAP = {
  green: colors.semantic.positive,
  yellow: colors.semantic.warning,
  red: colors.semantic.negative,
} as const;

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

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
  const [expanded, setExpanded] = useState(false);

  const percentage = rda > 0 ? computeRDAPercentage(intake, rda) : 0;
  const colorKey = rdaColor(percentage);
  const barColor = COLOR_MAP[colorKey];
  const barWidth = Math.min(percentage, 100);
  const hasData = intake > 0;

  const contributions = expanded ? computeNutrientContributions(entries, field.key) : [];

  return (
    <TouchableOpacity
      style={styles.nutrientRow}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.nutrientHeader}>
        <Text style={styles.nutrientLabel}>{field.label}</Text>
        <View style={styles.nutrientValues}>
          {hasData ? (
            <>
              <Text style={styles.intakeText}>
                {intake.toFixed(1)} {field.unit}
              </Text>
              {rda > 0 && (
                <Text style={styles.rdaActual}>/ {rda.toFixed(0)}{field.unit}</Text>
              )}
              {rda > 0 && (
                <Text style={[styles.rdaPct, { color: barColor }]}>
                  {Math.round(percentage)}%
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.noDataText}>—</Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        {hasData && rda > 0 && (
          <View
            style={[
              styles.barFill,
              { width: `${barWidth}%`, backgroundColor: barColor },
            ]}
          />
        )}
      </View>

      {/* Expanded: top contributing foods */}
      {expanded && hasData && contributions.length > 0 && (
        <View style={styles.contributionList}>
          {contributions.map((c, i) => (
            <View key={i} style={styles.contributionRow}>
              <Text style={styles.contributionName} numberOfLines={1}>
                {c.foodName}
              </Text>
              <Text style={styles.contributionAmount}>
                {c.amount.toFixed(1)} {field.unit}
              </Text>
              <Text style={styles.contributionPct}>
                {Math.round(c.percentage)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function NutritionReportScreen({ navigation }: { navigation?: any }) {
  const store = useStore();
  const birthYear = useOnboardingStore((s) => s.birthYear);
  const birthMonth = useOnboardingStore((s) => s.birthMonth);
  const sex = useOnboardingStore((s) => s.sex);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
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
    } catch (err) {
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
    setSelectedDate(formatDate(d));
  };

  function formatDisplayDate(isoDate: string): string {
    const d = new Date(isoDate + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const todayStr = formatDate(new Date());
  const canGoForward = selectedDate < todayStr;

  const hasAnyData = Object.keys(dailyTotals).length > 0;

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: MicroField }) => {
    const intake = dailyTotals[item.key] ?? 0;
    const rda = getRDA(item.key, userSex, userAge);
    return <NutrientRow field={item} intake={intake} rda={rda} entries={entries} />;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {navigation && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Nutrition Report</Text>
      </View>

      {/* Date selector */}
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Text style={styles.dateArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => canGoForward && changeDate(1)}
          style={styles.dateArrow}
          disabled={!canGoForward}
        >
          <Text style={[styles.dateArrowText, !canGoForward && styles.dateArrowDisabled]}>›</Text>
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
        <View style={styles.rdaWarningBanner}>
          <Text style={styles.rdaWarningText}>
            <Icon name="warning" /> RDA values use defaults (age 30, male). Set your profile for accurate values.
          </Text>
          <TouchableOpacity
            onPress={() => navigation?.navigate?.('Profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.rdaWarningLink}>Set Profile →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      ) : !hasAnyData ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}><Icon name="salad" /></Text>
          <Text style={styles.emptyTitle}>No nutrient data</Text>
          <Text style={styles.emptyText}>Log food to see your nutrition report</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backBtn: { marginRight: spacing[3], minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.accent.primary, fontSize: typography.size['2xl'], lineHeight: typography.lineHeight['2xl'] },
  title: {
    color: colors.text.primary,
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
  dateArrowText: { color: colors.accent.primary, fontSize: typography.size['2xl'], lineHeight: typography.lineHeight['2xl'] },
  dateArrowDisabled: { color: colors.text.muted, opacity: opacityScale.disabled },
  dateText: {
    color: colors.text.primary,
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
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
  nutrientRow: {
    backgroundColor: colors.bg.surface,
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
    color: colors.text.primary,
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
    color: colors.text.secondary,
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
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  noDataText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.bg.surfaceRaised,
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
    borderTopColor: colors.border.subtle,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  contributionName: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    flex: 1,
  },
  contributionAmount: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginRight: spacing[2],
  },
  contributionPct: {
    color: colors.text.muted,
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
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
    marginBottom: spacing[2],
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
  },
  rdaWarningBanner: {
    backgroundColor: colors.semantic.warningSubtle,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  rdaWarningText: {
    color: colors.semantic.warning,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    flex: 1,
  },
  rdaWarningLink: {
    color: colors.semantic.warning,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});
