import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Linking, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { PremiumBadge } from '../../components/premium/PremiumBadge';
import api from '../../services/api';

interface CoachingRequest {
  id: string;
  status: string;
  goals: string;
  created_at: string;
}

interface CoachingSession {
  id: string;
  status: string;
  notes: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
}

const openTelegramLink = () => {
  const url = 'https://t.me/repwiseCommunity';
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url);
  }
};

export function CoachingScreen() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const navigation = useNavigation();
  const [requests, setRequests] = useState<CoachingRequest[]>([]);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [goals, setGoals] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const [reqRes, sesRes] = await Promise.allSettled([
        api.get('coaching/requests'),
        api.get('coaching/sessions'),
      ]);
      if (reqRes.status === 'fulfilled') setRequests(reqRes.value.data.items ?? []);
      if (sesRes.status === 'fulfilled') setSessions(sesRes.value.data.items ?? []);
      // If both failed, show error
      if (reqRes.status === 'rejected' && sesRes.status === 'rejected') {
        setError('Unable to load coaching data. Check your connection.');
      }
    } catch {
      setError('Unable to load coaching data. Check your connection.');
    }
  };

  const handleSubmit = async () => {
    if (!goals.trim()) {
      Alert.alert('Error', 'Please describe your coaching goals');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('coaching/requests', { goals });
      setGoals('');
      await loadData();
      Alert.alert('Success', 'Coaching request submitted');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to submit request';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return c.semantic.positive;
      case 'pending':
      case 'scheduled':
        return c.semantic.warning;
      case 'rejected':
      case 'cancelled':
        return c.semantic.negative;
      default:
        return c.text.muted;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="coaching-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Text style={[styles.backButtonText, { color: c.accent.primary }]}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text.primary }]}>Coaching</Text>
          <PremiumBadge size="md" />
        </View>

        {error && <ErrorBanner message={error} onRetry={loadData} onDismiss={() => setError(null)} />}

        {/* 1:1 Coaching */}
        <Card style={styles.coachingCard}>
          <Text style={[styles.coachingTitle, { color: c.text.primary }]}>1:1 Personal Coaching</Text>
          <Text style={[styles.coachingDesc, { color: c.text.secondary }]}>
            Get personalized training and nutrition guidance from an experienced coach. Available for premium members.
          </Text>
          <TouchableOpacity
            onPress={openTelegramLink}
            style={[styles.dmButton, { backgroundColor: c.accent.primaryMuted }]}
            activeOpacity={0.8}
          >
            <Icon name="chat" size={18} color={c.accent.primary} />
            <Text style={[styles.dmButtonText, { color: c.accent.primary }]}>Message on Telegram</Text>
          </TouchableOpacity>
          <Text style={[styles.comingSoonNote, { color: c.text.muted }]}>Full in-app messaging — coming soon</Text>
        </Card>

        {/* Request form */}
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>New Request</Text>
        <Card>
          <Text style={[styles.label, { color: c.text.secondary }]}>What are your coaching goals?</Text>
          <TextInput
            style={[styles.textArea, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}
            placeholder="Describe your goals, current progress, and what you'd like help with..."
            placeholderTextColor={c.text.muted}
            multiline
            numberOfLines={4}
            value={goals}
            onChangeText={setGoals}
            textAlignVertical="top"
            testID="coaching-goals-input"
          />
          <Button title="Submit Request" onPress={handleSubmit} loading={submitting} disabled={submitting} testID="coaching-submit-button" />
        </Card>

        {/* Request history */}
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Requests</Text>
        {requests.length === 0 ? (
          <EmptyState icon={<Icon name="target" />} title="No coaching requests" description="Submit a request to get started" />
        ) : (
          requests.map((req) => (
            <Card key={req.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={[styles.status, { color: statusColor(req.status) }]}>
                  {req.status.toUpperCase()}
                </Text>
                <Text style={[styles.date, { color: c.text.muted }]}>
                  {new Date(req.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.goalsText, { color: c.text.secondary }]} numberOfLines={2}>{req.goals}</Text>
            </Card>
          ))
        )}

        {/* Session history */}
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Sessions</Text>
        {sessions.length === 0 ? (
          <EmptyState icon={<Icon name="calendar" />} title="No coaching sessions" description="Sessions will appear here after your request is reviewed" />
        ) : (
          sessions.map((session) => (
            <Card key={session.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={[styles.status, { color: statusColor(session.status) }]}>
                  {session.status.toUpperCase()}
                </Text>
                <Text style={[styles.date, { color: c.text.muted }]}>
                  {session.scheduled_at
                    ? new Date(session.scheduled_at).toLocaleDateString()
                    : '—'}
                </Text>
              </View>
              {session.notes && (
                <Text style={[styles.notesText, { color: c.text.secondary }]} numberOfLines={3}>{session.notes}</Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  backButton: { paddingVertical: spacing[2], marginBottom: spacing[2], minHeight: 44, justifyContent: 'center' as const },
  backButtonText: { color: c.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium, lineHeight: typography.size.base * typography.lineHeight.normal },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  label: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing[2],
  },
  textArea: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.subtle,
    color: c.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.normal,
    padding: spacing[3],
    minHeight: 100,
    marginBottom: spacing[4],
  },
  itemCard: { marginBottom: spacing[3] },
  coachingCard: { marginBottom: spacing[2], padding: spacing[4] },
  coachingTitle: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold, marginBottom: spacing[2] },
  coachingDesc: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: 20, marginBottom: spacing[3] },
  dmButton: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.accent.primaryMuted, paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radius.md, alignSelf: 'flex-start' },
  dmButtonText: { color: c.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  comingSoonNote: { color: c.text.muted, fontSize: typography.size.xs, marginTop: spacing[2] },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  status: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, lineHeight: typography.size.xs * typography.lineHeight.normal },
  date: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },
  goalsText: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  notesText: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  empty: {
    color: c.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.normal,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
});
