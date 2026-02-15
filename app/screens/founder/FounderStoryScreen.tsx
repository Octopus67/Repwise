import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import api from '../../services/api';

interface FounderContent {
  narrative: string;
  philosophy: string;
  timeline: Array<{ year: string; event: string }>;
  before_metrics: Record<string, string>;
  after_metrics: Record<string, string>;
  media_gallery: string[];
}

export function FounderStoryScreen() {
  const navigation = useNavigation();
  const [content, setContent] = useState<FounderContent | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const { data } = await api.get('founder');
      setContent(data.content ?? data);
    } catch {
      // Use fallback content
      setContent({
        narrative:
          'From overweight and sedentary to competitive natural bodybuilder — this platform was born from a real transformation, not a marketing pitch.',
        philosophy:
          'Evidence-based training and nutrition. No shortcuts, no gimmicks. Just consistent effort guided by data and science.',
        timeline: [
          { year: '2018', event: 'Started lifting — 95kg, 30% body fat' },
          { year: '2019', event: 'First cut — discovered macro tracking' },
          { year: '2020', event: 'Built first spreadsheet tracker' },
          { year: '2022', event: 'First natural bodybuilding competition' },
          { year: '2024', event: 'HypertrophyOS launched' },
        ],
        before_metrics: { weight: '95 kg', bodyFat: '30%', bench: '60 kg' },
        after_metrics: { weight: '82 kg', bodyFat: '12%', bench: '140 kg' },
        media_gallery: [],
      });
    }
  };

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="founder-story-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: spacing[2], marginBottom: spacing[2] }} activeOpacity={0.7}>
            <Text style={{ color: colors.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium }}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Founder's Story</Text>

        {/* Narrative */}
        <Card style={styles.narrativeCard}>
          <Text style={styles.narrative}>{content.narrative}</Text>
        </Card>

        {/* Before / After metrics */}
        <Text style={styles.sectionTitle}>Transformation</Text>
        <View style={styles.metricsRow}>
          <Card style={styles.metricsCard}>
            <Text style={styles.metricsLabel}>Before</Text>
            {Object.entries(content.before_metrics).map(([key, val]) => (
              <View key={key} style={styles.metricItem}>
                <Text style={styles.metricKey}>{key}</Text>
                <Text style={styles.metricVal}>{val}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.metricsCard}>
            <Text style={[styles.metricsLabel, { color: colors.semantic.positive }]}>After</Text>
            {Object.entries(content.after_metrics).map(([key, val]) => (
              <View key={key} style={styles.metricItem}>
                <Text style={styles.metricKey}>{key}</Text>
                <Text style={[styles.metricVal, { color: colors.semantic.positive }]}>{val}</Text>
              </View>
            ))}
          </Card>
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Timeline</Text>
        <Card>
          {content.timeline.map((item, i) => (
            <View key={i} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              {i < content.timeline.length - 1 && <View style={styles.timelineLine} />}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineYear}>{item.year}</Text>
                <Text style={styles.timelineEvent}>{item.event}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Philosophy */}
        <Text style={styles.sectionTitle}>Philosophy</Text>
        <Card>
          <Text style={styles.philosophy}>{content.philosophy}</Text>
        </Card>

        {/* Media gallery */}
        {content.media_gallery.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
              {content.media_gallery.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.galleryImage} />
              ))}
            </ScrollView>
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
  loading: { color: colors.text.muted, textAlign: 'center', marginTop: spacing[10], fontSize: typography.size.base },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[4],
  },
  narrativeCard: { marginBottom: spacing[2] },
  narrative: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  metricsRow: { flexDirection: 'row', gap: spacing[3] },
  metricsCard: { flex: 1 },
  metricsLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  metricKey: { color: colors.text.muted, fontSize: typography.size.sm, textTransform: 'capitalize' },
  metricVal: { color: colors.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  timelineItem: { flexDirection: 'row', marginBottom: spacing[4], position: 'relative' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.primary,
    marginTop: 4,
    marginRight: spacing[3],
  },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 14,
    bottom: -spacing[4],
    width: 2,
    backgroundColor: colors.border.default,
  },
  timelineContent: { flex: 1 },
  timelineYear: { color: colors.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  timelineEvent: { color: colors.text.primary, fontSize: typography.size.base, marginTop: 2 },
  philosophy: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
    fontStyle: 'italic',
  },
  gallery: { marginTop: spacing[2] },
  galleryImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    marginRight: spacing[3],
    backgroundColor: colors.bg.surface,
  },
});
