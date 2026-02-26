import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { PremiumBadge } from '../../components/premium/PremiumBadge';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import api from '../../services/api';

interface HealthReport {
  id: string;
  report_date: string;
  markers: Record<string, number>;
  flagged_markers: Record<string, { status: string; value: number; min: number; max: number }>;
  is_sample: boolean;
}

interface NutritionCorrelation {
  marker: string;
  status: string;
  related_nutrient: string;
  average_intake: number;
  recommended: number;
}

export function HealthReportsScreen() {
  const navigation = useNavigation();
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [correlations, setCorrelations] = useState<NutritionCorrelation[]>([]);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReports = async () => {
    setError(null);
    try {
      const { data } = await api.get('health-reports');
      setReports(data.items ?? []);
    } catch {
      setError('Unable to load health reports. Check your connection.');
    }
  };

  const loadCorrelations = async (reportId: string) => {
    setSelectedReport(reportId);
    setCorrelationsLoading(true);
    try {
      const { data } = await api.get(`health-reports/${reportId}/correlations`);
      setCorrelations(data.correlations ?? []);
    } catch {
      setCorrelations([]);
    } finally {
      setCorrelationsLoading(false);
    }
  };

  const flagColor = (status: string) => {
    switch (status) {
      case 'low': return colors.semantic.negative;
      case 'high': return colors.semantic.warning;
      default: return colors.semantic.positive;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="health-reports-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>Health Reports</Text>
          <PremiumBadge size="md" />
        </View>

        {error && (
          <ErrorBanner message={error} onRetry={loadReports} onDismiss={() => setError(null)} />
        )}

        <Button title="Upload New Report" onPress={() => {}} disabled={true} style={styles.uploadBtn} />
        <Text style={styles.uploadHint}>File upload coming soon</Text>

        {/* Report history */}
        <Text style={styles.sectionTitle}>Report History</Text>
        {reports.length === 0 ? (
          <EmptyState icon={<Icon name="chart" />} title="No health reports" description="Upload a blood report to see your health analysis" />
        ) : (
          reports.map((report) => (
            <TouchableOpacity
              key={report.id}
              onPress={() => loadCorrelations(report.id)}
              activeOpacity={0.8}
            >
              <Card style={[styles.reportCard, selectedReport === report.id && styles.reportSelected]}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportDate}>
                    {new Date(report.report_date).toLocaleDateString()}
                  </Text>
                  {report.is_sample && (
                    <Text style={styles.sampleBadge}>SAMPLE</Text>
                  )}
                </View>

                {/* Marker flags */}
                <View style={styles.markersGrid}>
                  {Object.entries(report.flagged_markers ?? {}).map(([name, info]) => (
                    <View key={name} style={styles.markerItem}>
                      <View style={[styles.markerDot, { backgroundColor: flagColor(info.status) }]} />
                      <View>
                        <Text style={styles.markerName}>{name}</Text>
                        <Text style={[styles.markerValue, { color: flagColor(info.status) }]}>
                          {info.value} ({info.status})
                        </Text>
                        <Text style={styles.markerRange}>
                          Range: {info.min}–{info.max}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {Object.keys(report.flagged_markers ?? {}).length === 0 && (
                    <Text style={styles.allNormal}>All markers normal</Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Nutrition correlations */}
        {selectedReport && correlationsLoading && (
          <ActivityIndicator size="small" color={colors.accent.primary} style={{ marginTop: spacing[4] }} />
        )}
        {selectedReport && !correlationsLoading && correlations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Nutrition Correlations</Text>
            <Card>
              {correlations.map((corr, i) => (
                <View key={i} style={styles.corrRow}>
                  <View style={[styles.corrDot, { backgroundColor: flagColor(corr.status) }]} />
                  <View style={styles.corrContent}>
                    <Text style={styles.corrMarker}>
                      {corr.marker} ({corr.status})
                    </Text>
                    <Text style={styles.corrDetail}>
                      {corr.related_nutrient}: {corr.average_intake.toFixed(1)} / {corr.recommended.toFixed(1)} daily
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  backBtn: {
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.xl,
  },
  uploadBtn: { marginBottom: spacing[2] },
  uploadHint: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  reportCard: { marginBottom: spacing[3] },
  reportSelected: { borderColor: colors.accent.primary },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  reportDate: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  sampleBadge: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.xs,
    backgroundColor: colors.bg.surfaceRaised,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  markersGrid: { gap: spacing[3] },
  markerItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  markerDot: { width: 8, height: 8, borderRadius: radius.none + 4, marginTop: spacing[1] },
  markerName: { color: colors.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  markerValue: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.sm },
  markerRange: { color: colors.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs },
  allNormal: { color: colors.semantic.positive, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  corrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  corrDot: { width: 8, height: 8, borderRadius: radius.none + 4, marginTop: spacing[1] },
  corrContent: { flex: 1 },
  corrMarker: { color: colors.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  corrDetail: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, marginTop: spacing[0.5] },
  empty: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
});
