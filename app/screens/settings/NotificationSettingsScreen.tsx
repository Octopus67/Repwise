import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { SectionHeader } from '../../components/common/SectionHeader';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { Skeleton } from '../../components/common/Skeleton';
import api from '../../services/api';

interface NotificationPreferences {
  workout_reminders: boolean;
  meal_reminders: boolean;
  pr_celebrations: boolean;
  weekly_checkin_alerts: boolean;
  volume_warnings: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const DEFAULT_PREFS: NotificationPreferences = {
  workout_reminders: true,
  meal_reminders: true,
  pr_celebrations: true,
  weekly_checkin_alerts: true,
  volume_warnings: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

const TOGGLE_ITEMS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'workout_reminders', label: 'Workout Reminders', description: 'Daily reminders to train' },
  { key: 'meal_reminders', label: 'Meal Reminders', description: 'Reminders to log meals' },
  { key: 'pr_celebrations', label: 'PR Celebrations', description: 'Celebrate personal records' },
  { key: 'weekly_checkin_alerts', label: 'Weekly Check-In', description: 'Weekly progress review alerts' },
  { key: 'volume_warnings', label: 'Volume Warnings', description: 'Alerts when volume exceeds MRV' },
];

export function NotificationSettingsScreen() {
  const c = useThemeColors();
  const navigation = useNavigation();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const checkPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
    } catch {
      setPermissionStatus('undetermined');
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get('notifications/preferences');
      setPrefs({ ...DEFAULT_PREFS, ...data });
    } catch {
      setError('Unable to load notification preferences.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermission();
    loadPreferences();
  }, [checkPermission, loadPreferences]);

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    const prev = prefs;
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await api.patch('notifications/preferences', { [key]: value });
    } catch {
      setPrefs(prev);
      Alert.alert('Error', 'Failed to update preference. Please try again.');
    }
  };

  const handleRequestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'denied') {
      Alert.alert(
        'Notifications Disabled',
        'Open Settings to enable notifications for Repwise.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Repwise Test',
          body: 'Notifications are working!',
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
      });
    } catch {
      Alert.alert('Error', 'Failed to send test notification.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleQuietHoursToggle = async (enabled: boolean) => {
    const update = enabled
      ? { quiet_hours_start: '22:00', quiet_hours_end: '07:00' }
      : { quiet_hours_start: null, quiet_hours_end: null };
    const prev = prefs;
    setPrefs((p) => ({ ...p, ...update }));
    try {
      await api.patch('notifications/preferences', update);
    } catch {
      setPrefs(prev);
      Alert.alert('Error', 'Failed to update quiet hours.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton width="100%" height={60} borderRadius={12} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={300} borderRadius={12} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="notification-settings-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text.primary }]}>Notifications</Text>
        </View>

        {error && (
          <ErrorBanner message={error} onRetry={loadPreferences} onDismiss={() => setError(null)} />
        )}

        {/* Permission Status */}
        <SectionHeader title="Permission" />
        <Card>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: c.text.primary }]}>Push Notifications</Text>
              <Text style={[styles.description, { color: c.text.muted }]}>
                {permissionStatus === 'granted' ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
            {permissionStatus !== 'granted' && (
              <Button
                title="Enable"
                variant="secondary"
                onPress={handleRequestPermission}
                testID="enable-notifications-btn"
              />
            )}
            {permissionStatus === 'granted' && (
              <View style={[styles.statusBadge, { backgroundColor: c.semantic.positiveSubtle }]} testID="permission-granted-badge">
                <Text style={[styles.statusText, { color: c.semantic.positive }]}>Active</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Notification Toggles */}
        <SectionHeader title="Notification Types" />
        <Card>
          {TOGGLE_ITEMS.map((item) => (
            <View key={item.key} style={styles.toggleRow} testID={`toggle-${item.key}`}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: c.text.primary }]}>{item.label}</Text>
                <Text style={[styles.description, { color: c.text.muted }]}>{item.description}</Text>
              </View>
              <Switch
                value={prefs[item.key] as boolean}
                onValueChange={(v) => handleToggle(item.key, v)}
                trackColor={{ false: c.border.default, true: c.accent.primaryMuted }}
                thumbColor={prefs[item.key] ? c.accent.primary : c.text.muted}
                accessibilityLabel={`Toggle ${item.label}`}
                accessibilityRole="switch"
              />
            </View>
          ))}
        </Card>

        {/* Quiet Hours */}
        <SectionHeader title="Quiet Hours" />
        <Card>
          <View style={styles.toggleRow}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: c.text.primary }]}>Quiet Hours</Text>
              <Text style={[styles.description, { color: c.text.muted }]}>
                {prefs.quiet_hours_start
                  ? `${prefs.quiet_hours_start} – ${prefs.quiet_hours_end}`
                  : 'No notifications during sleep'}
              </Text>
            </View>
            <Switch
              value={prefs.quiet_hours_start !== null}
              onValueChange={handleQuietHoursToggle}
              trackColor={{ false: c.border.default, true: c.accent.primaryMuted }}
              thumbColor={prefs.quiet_hours_start ? c.accent.primary : c.text.muted}
              accessibilityLabel="Toggle quiet hours"
              accessibilityRole="switch"
              testID="toggle-quiet-hours"
            />
          </View>
        </Card>

        {/* Test Button */}
        <View style={styles.testSection}>
          <Button
            title="Send Test Notification"
            variant="secondary"
            onPress={handleSendTest}
            loading={sendingTest}
            disabled={permissionStatus !== 'granted'}
            testID="send-test-btn"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[4] },
  header: { marginBottom: spacing[2] },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  rowText: { flex: 1, marginRight: spacing[3] },
  label: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  description: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[0.5],
  },
  statusBadge: {
    backgroundColor: colors.semantic.positiveSubtle,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  statusText: {
    color: colors.semantic.positive,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  testSection: { marginTop: spacing[2] },
});
