import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useThemeStore } from '../../store/useThemeStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../../components/common/Icon';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EditableField } from '../../components/common/EditableField';
import { SectionHeader } from '../../components/common/SectionHeader';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { Skeleton } from '../../components/common/Skeleton';
import { PremiumBadge } from '../../components/premium/PremiumBadge';
import { UpgradeModal } from '../../components/premium/UpgradeModal';
import { FeatureNavItem } from '../../components/profile/FeatureNavItem';
import { EditPlanPanel } from '../../components/profile/EditPlanPanel';
import { PreferencesSection } from '../../components/profile/PreferencesSection';
import { AdvancedSettingsSection } from '../../components/profile/AdvancedSettingsSection';
import { AccountSection } from '../../components/profile/AccountSection';
import { AchievementGrid } from '../../components/achievements/AchievementGrid';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { useStore, isPremium } from '../../store';
import api from '../../services/api';

const TOKEN_KEYS = { access: 'rw_access_token', refresh: 'rw_refresh_token' };

async function secureClear() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEYS.access);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh);
  }
}

export function ProfileScreen() {
  const c = useThemeColors();
  const store = useStore();
  const premium = isPremium(store);
  const navigation = useNavigation<any>();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeMode = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const headerAnim = useStaggeredEntrance(0, 60);
  const planPanelAnim = useStaggeredEntrance(1, 60);
  const preferencesAnim = useStaggeredEntrance(2, 60);
  const advancedSettingsAnim = useStaggeredEntrance(3, 60);
  const featuresAnim = useStaggeredEntrance(4, 60);
  const achievementsAnim = useStaggeredEntrance(5, 60);
  const subscriptionAnim = useStaggeredEntrance(6, 60);
  const accountAnim = useStaggeredEntrance(7, 60);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileRes, metricsRes, goalsRes] = await Promise.allSettled([
        api.get('users/profile'),
        api.get('users/metrics/history', { params: { limit: 1 } }),
        api.get('users/goals'),
      ]);
      if (profileRes.status === 'fulfilled') {
        const d = profileRes.value.data;
        store.setProfile({
          id: d.id, userId: d.user_id, displayName: d.display_name,
          avatarUrl: d.avatar_url, timezone: d.timezone,
          preferredCurrency: d.preferred_currency, region: d.region,
          preferences: d.preferences, coachingMode: d.coaching_mode,
          createdAt: d.created_at,
        });
      }
      if (metricsRes.status === 'fulfilled') {
        const raw = metricsRes.value.data;
        const m = raw?.items?.[0] ?? (Array.isArray(raw) ? raw[0] : raw);
        if (m && m.id) {
          store.setLatestMetrics({
            id: m.id, heightCm: m.height_cm, weightKg: m.weight_kg,
            bodyFatPct: m.body_fat_pct, activityLevel: m.activity_level,
            recordedAt: m.recorded_at,
          });
        }
      }
      if (goalsRes.status === 'fulfilled' && goalsRes.value.data) {
        const g = goalsRes.value.data;
        store.setGoals({
          id: g.id, userId: g.user_id, goalType: g.goal_type,
          targetWeightKg: g.target_weight_kg, goalRatePerWeek: g.goal_rate_per_week,
        });
      }
      // Show error if the critical profile request failed
      if (profileRes.status === 'rejected') {
        setError('Unable to load profile data. Check your connection.');
      }
    } catch {
      setError('Unable to load profile data. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);


  const handleSaveDisplayName = async (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed.length === 0) throw new Error('Display name cannot be empty');
    if (trimmed.length > 100) throw new Error('Display name must be 100 characters or less');
    await api.put('users/profile', { display_name: trimmed });
    store.setProfile({ ...store.profile!, displayName: trimmed });
  };

  const handleLogout = async () => {
    await secureClear();
    store.clearAuth();
  };

  const avatarInitial = (
    (store.profile?.displayName && store.profile.displayName.length > 0
      ? store.profile.displayName : store.user?.email) || '?'
  )[0].toUpperCase();

  const memberSince = store.profile
    ? new Date((store.profile as any).createdAt ?? Date.now()).toLocaleDateString(undefined, {
        month: 'short', year: 'numeric',
      })
    : '';

  if (isLoading && !store.profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={{ alignItems: 'center', paddingTop: spacing[6] }}>
            <Skeleton width={80} height={80} variant="circle" />
            <View style={{ height: spacing[3] }} />
            <Skeleton width={160} height={20} />
            <View style={{ height: spacing[2] }} />
            <Skeleton width={100} height={16} />
          </View>
          <View style={{ height: spacing[6] }} />
          <Skeleton width="100%" height={120} borderRadius={12} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={80} borderRadius={12} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={200} borderRadius={12} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="profile-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {error && (
          <ErrorBanner message={error} onRetry={loadProfile} onDismiss={() => setError(null)} />
        )}
        <Animated.View style={headerAnim}>
          <Card style={styles.profileCard}>
            <View style={[styles.avatarCircle, { backgroundColor: c.accent.primaryMuted }]}>
              <Text style={[styles.avatarText, { color: c.accent.primary }]}>{avatarInitial}</Text>
            </View>
            {premium && <PremiumBadge size="md" />}
            <View style={styles.fieldsContainer}>
              <EditableField label="Display Name" value={store.profile?.displayName || 'Set your name'} onSave={handleSaveDisplayName} />
              <EditableField label="Email" value={store.user?.email ?? '—'} onSave={async () => {}} editable={false} />
              {memberSince ? <Text style={[styles.memberSince, { color: c.text.muted }]}>Member since {memberSince}</Text> : null}
            </View>
          </Card>
        </Animated.View>

        <Animated.View style={planPanelAnim} testID="profile-body-stats">
          <EditPlanPanel metrics={store.latestMetrics} goals={store.goals} adaptiveTargets={store.adaptiveTargets} unitSystem={store.unitSystem} />
        </Animated.View>
        <Animated.View style={preferencesAnim} testID="profile-goals">
          {store.profile && <PreferencesSection profile={store.profile} unitSystem={store.unitSystem} coachingMode={store.coachingMode} />}
        </Animated.View>
        <Animated.View style={advancedSettingsAnim}>
          <AdvancedSettingsSection />
        </Animated.View>

        <SectionHeader title="Appearance" />
        <Card>
          <View style={styles.subRow}>
            <Text style={[styles.subLabel, { color: c.text.primary }]}>Dark Mode</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: c.border.default, true: c.accent.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle dark mode"
              accessibilityRole="switch"
            />
          </View>
        </Card>

        <Animated.View style={featuresAnim}>
          <SectionHeader title="Features" />
          <Card>
            <FeatureNavItem icon={<Icon name="target" size={22} color={c.text.secondary} />} label="Coaching" description="AI-powered training guidance" onPress={() => navigation.navigate('Coaching')} />
            <FeatureNavItem icon={<Icon name="chat" size={22} color={c.text.secondary} />} label="Community" description="Connect with other lifters" onPress={() => navigation.navigate('Community')} />
            <FeatureNavItem icon={<Icon name="dumbbell" size={22} color={c.text.secondary} />} label="Founder's Story" description="The story behind Repwise" onPress={() => navigation.navigate('FounderStory')} />

            <FeatureNavItem icon={<Icon name="book" size={22} color={c.text.secondary} />} label="Learn" description="Articles and educational content" onPress={() => navigation.navigate('Learn')} testID="profile-learn-link" />
            <FeatureNavItem icon={<Icon name="camera" size={22} color={c.text.secondary} />} label="Progress Photos" description="Track your transformation visually" onPress={() => navigation.navigate('ProgressPhotos')} testID="profile-photos-link" />
            <FeatureNavItem icon={<Icon name="scale" size={22} color={c.text.secondary} />} label="Body Measurements" description="Track weight, body fat, and circumferences" onPress={() => navigation.navigate('Measurements')} testID="profile-measurements-link" />
            <FeatureNavItem icon={<Icon name="mail" size={22} color={c.text.secondary} />} label="Notifications" description="Manage push notification preferences" onPress={() => navigation.navigate('NotificationSettings')} testID="profile-notifications-link" />
          </Card>
        </Animated.View>

        <Animated.View style={achievementsAnim}>
          <SectionHeader title="Achievements" />
          <AchievementGrid />
        </Animated.View>

        <Animated.View style={subscriptionAnim}>
          <SectionHeader title="Subscription" />
          <Card>
            <View style={styles.subRow}>
              <Text style={[styles.subLabel, { color: c.text.secondary }]}>Status</Text>
              <Text style={[styles.subValue, premium && styles.subActive]}>
                {store.subscription?.status ?? 'Free'}
              </Text>
            </View>
            {store.subscription?.currentPeriodEnd && (
              <View style={styles.subRow}>
                <Text style={[styles.subLabel, { color: c.text.secondary }]}>Renews</Text>
                <Text style={[styles.subValue, { color: c.text.primary }]}>
                  {new Date(store.subscription.currentPeriodEnd).toLocaleDateString()}
                </Text>
              </View>
            )}
            {!premium && (
              <Button title="Upgrade to Premium" onPress={() => setShowUpgrade(true)} style={styles.upgradeBtn} />
            )}
          </Card>
        </Animated.View>
        <Animated.View style={accountAnim} testID="profile-account">
          <AccountSection onLogout={handleLogout} />
        </Animated.View>
      </ScrollView>
      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[4] },
  profileCard: { alignItems: 'center', paddingVertical: spacing[6] },
  avatarCircle: {
    width: 64, height: 64, borderRadius: radius.full,
    backgroundColor: colors.accent.primaryMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3],
  },
  avatarText: {
    color: colors.accent.primary, fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight['2xl'],
  },
  fieldsContainer: {
    alignSelf: 'stretch', paddingHorizontal: spacing[4], marginTop: spacing[3],
  },
  memberSince: {
    color: colors.text.muted, fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[3], textAlign: 'center',
  },
  subRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2],
  },
  subLabel: { color: colors.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
  subValue: {
    color: colors.text.primary, fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  subActive: { color: colors.semantic.positive },
  upgradeBtn: { marginTop: spacing[4] },
});
