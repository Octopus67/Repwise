import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme/tokens';
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

export function CoachingScreen() {
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
        return colors.semantic.positive;
      case 'pending':
      case 'scheduled':
        return colors.semantic.warning;
      case 'rejected':
      case 'cancelled':
        return colors.semantic.negative;
      default:
        return colors.text.muted;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="coaching-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>Coaching</Text>
          <PremiumBadge size="md" />
        </View>

        {error && <ErrorBanner message={error} onRetry={loadData} onDismiss={() => setError(null)} />}

        {/* Request form */}
        <Text style={styles.sectionTitle}>New Request</Text>
        <Card>
          <Text style={styles.label}>What are your coaching goals?</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe your goals, current progress, and what you'd like help with..."
            placeholderTextColor={colors.text.muted}
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
        <Text style={styles.sectionTitle}>Requests</Text>
        {requests.length === 0 ? (
          <EmptyState icon={<Icon name="target" />} title="No coaching requests" description="Submit a request to get started" />
        ) : (
          requests.map((req) => (
            <Card key={req.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={[styles.status, { color: statusColor(req.status) }]}>
                  {req.status.toUpperCase()}
                </Text>
                <Text style={styles.date}>
                  {new Date(req.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.goalsText} numberOfLines={2}>{req.goals}</Text>
            </Card>
          ))
        )}

        {/* Session history */}
        <Text style={styles.sectionTitle}>Sessions</Text>
        {sessions.length === 0 ? (
          <EmptyState icon={<Icon name="calendar" />} title="No coaching sessions" description="Sessions will appear here after your request is reviewed" />
        ) : (
          sessions.map((session) => (
            <Card key={session.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={[styles.status, { color: statusColor(session.status) }]}>
                  {session.status.toUpperCase()}
                </Text>
                <Text style={styles.date}>
                  {session.scheduled_at
                    ? new Date(session.scheduled_at).toLocaleDateString()
                    : '—'}
                </Text>
              </View>
              {session.notes && (
                <Text style={styles.notesText} numberOfLines={3}>{session.notes}</Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  backButton: { paddingVertical: spacing[2], marginBottom: spacing[2], minHeight: 44, justifyContent: 'center' as const },
  backButtonText: { color: colors.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium, lineHeight: typography.size.base * typography.lineHeight.normal },
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
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing[2],
  },
  textArea: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.normal,
    padding: spacing[3],
    minHeight: 100,
    marginBottom: spacing[4],
  },
  itemCard: { marginBottom: spacing[3] },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  status: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, lineHeight: typography.size.xs * typography.lineHeight.normal },
  date: { color: colors.text.muted, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },
  goalsText: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  notesText: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  empty: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.normal,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
});
