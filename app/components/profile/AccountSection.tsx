import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { spacing, typography } from '../../theme/tokens';
import { secureGet, TOKEN_KEYS } from '../../utils/secureStorage';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useStore } from '../../store';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import api from '../../services/api';
import { queryClient } from '../../services/queryClient';
import { mmkv } from '../../services/mmkvStorage';
import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { useTooltipStore } from '../../store/tooltipStore';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import { useOnboardingStore } from '../../store/onboardingSlice';
import * as Sentry from '@sentry/react-native';
import { useThemeStore } from '../../store/useThemeStore'; // Audit fix 1.1
import { LEGAL_URLS } from '../../constants/urls';

interface AccountSectionProps {
  onLogout: () => void | Promise<void>;
}

export function AccountSection({ onLogout }: AccountSectionProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useStore();
  const setNeedsOnboarding = useStore((s) => s.setNeedsOnboarding);
  const reduceMotion = useReduceMotion();
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleDangerZone = useCallback(() => {
    setDangerZoneExpanded((prev) => !prev);
  }, []);

  const performLogout = useCallback(async () => {
    try {
      const refreshToken = await secureGet(TOKEN_KEYS.refresh);

      // Call backend logout to blacklist both tokens
      await api.post('auth/logout', { refresh_token: refreshToken });
    } catch (error: unknown) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', String(error));
    } finally {
      // Clear local auth state — await onLogout (secureClear) before clearing Zustand
      await onLogout();
      store.clearAuth();
      Sentry.setUser(null);
      Sentry.addBreadcrumb({ category: 'auth', message: 'Logged out', level: 'info' });

      // ── Cross-user data leak prevention (Audit Task 1.1) ──────────────
      // Every persisted store and cache MUST be wiped on logout so the next
      // user who logs in does not see stale data from the previous session.
      // Clear all caches and stores — each wrapped individually so one failure doesn't block others

      // 1. TanStack Query in-memory cache (server state)
      try { queryClient.clear(); } catch (e) { console.warn('Failed to clear query cache:', e); }
      // 2. MMKV-persisted query cache (survives app restart)
      try { mmkv.clearAll(); } catch (e) { console.warn('Failed to clear MMKV:', e); }
      // 3. Active workout (persisted to AsyncStorage for crash recovery)
      try { useActiveWorkoutStore.getState().discardWorkout(); } catch (e) { console.warn('Failed to clear workout store:', e); }
      // 4. Tooltip dismissals (persisted via zustand/persist)
      try { useTooltipStore.persist.clearStorage(); } catch (e) { console.warn('Failed to clear tooltip store:', e); }
      // 5. Workout preferences (persisted via zustand/persist)
      try { useWorkoutPreferencesStore.persist.clearStorage(); } catch (e) { console.warn('Failed to clear workout preferences:', e); }
      // 6. Onboarding wizard (persisted to AsyncStorage)
      try { useOnboardingStore.getState().reset(); } catch (e) { console.warn('Failed to clear onboarding store:', e); }
      // 7. Theme preference (persisted to AsyncStorage) — Audit fix 1.1
      try { useThemeStore.persist.clearStorage(); } catch (e) { console.warn('Failed to clear theme store:', e); }
    }
  }, [store, onLogout]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: performLogout },
    ]);
  }, [performLogout]);

  const handleRedoOnboarding = useCallback(() => {
    Alert.alert(
      'Retake Setup Wizard',
      'This will reset your goals and preferences. Your training and nutrition history will be preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('users/goals');
              setNeedsOnboarding(true);
            } catch {
              Alert.alert('Error', 'Failed to reset. Please try again.');
            }
          },
        },
      ],
    );
  }, [setNeedsOnboarding]);

  const performAccountDeletion = useCallback(async () => {
    setIsDeleting(true);
    try {
      await api.delete('auth/delete-account');
      // Mirror performLogout cleanup to prevent data leaks
      await onLogout();
      store.clearAuth();
      Sentry.setUser(null);
      Sentry.addBreadcrumb({ category: 'auth', message: 'Account deleted', level: 'info' });
      try { queryClient.clear(); } catch (e) { console.warn('Failed to clear query cache:', e); }
      try { mmkv.clearAll(); } catch (e) { console.warn('Failed to clear MMKV:', e); }
      try { useActiveWorkoutStore.getState().discardWorkout(); } catch (e) { console.warn('Failed to clear workout store:', e); }
      try { useTooltipStore.persist.clearStorage(); } catch (e) { console.warn('Failed to clear tooltip store:', e); }
      try { useWorkoutPreferencesStore.persist.clearStorage(); } catch (e) { console.warn('Failed to clear workout preferences:', e); }
      try { useOnboardingStore.getState().reset(); } catch (e) { console.warn('Failed to clear onboarding store:', e); }
      try { useThemeStore.persist.clearStorage(); } catch (e) { console.warn('Failed to clear theme store:', e); }
    } catch {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [store, onLogout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Your account will be permanently deleted. All your data — workouts, nutrition, progress — will be lost forever. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation step
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? This is irreversible.',
              [
                { text: 'Go Back', style: 'cancel' },
                { text: 'Permanently Delete', style: 'destructive', onPress: performAccountDeletion },
              ],
            );
          },
        },
      ],
    );
  }, [performAccountDeletion]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Card>
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Account</Text>

      {/* Log Out */}
      <View style={styles.logoutRow}>
        <Button title="Log Out" variant="secondary" onPress={handleLogout} />
      </View>

      {/* Retake Setup Wizard */}
      <View style={styles.redoOnboardingRow}>
        <Button title="Retake Setup Wizard" variant="secondary" onPress={handleRedoOnboarding} />
      </View>

      {/* Legal Links */}
      <View style={[styles.legalSection, { borderBottomColor: c.border.subtle }]}>
        <TouchableOpacity
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
          accessibilityRole="link"
        >
          <Text style={[styles.legalText, { color: c.accent.primary }]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.terms)}
          accessibilityRole="link"
        >
          <Text style={[styles.legalText, { color: c.accent.primary }]}>Terms of Service</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <TouchableOpacity
        style={[styles.dangerZoneHeader, { borderTopColor: c.border.subtle }]}
        onPress={toggleDangerZone}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: dangerZoneExpanded }}
        accessibilityLabel="Danger Zone"
      >
        <Text style={[styles.dangerZoneText, { color: c.semantic.negative }]}>
          {dangerZoneExpanded ? '▾' : '▸'} Danger Zone
        </Text>
      </TouchableOpacity>

      {dangerZoneExpanded && (
        <Animated.View layout={reduceMotion ? undefined : Layout} style={styles.dangerZoneContent}>
          <Button
            title={isDeleting ? "Deleting Account…" : "Delete Account"}
            variant="danger"
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          />
        </Animated.View>
      )}

      {/* App Version */}
      <Text style={[styles.version, { color: c.text.muted }]}>App version: {appVersion}</Text>
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing[2],
  },
  logoutRow: {
    marginBottom: spacing[4],
  },
  redoOnboardingRow: {
    marginBottom: spacing[4],
  },
  legalSection: {
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  legalLink: {
    paddingVertical: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  legalText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
  },
  dangerZoneHeader: {
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  dangerZoneText: {
    color: c.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  dangerZoneContent: {
    paddingBottom: spacing[4],
  },
  version: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[4],
    textAlign: 'center',
  },
});
