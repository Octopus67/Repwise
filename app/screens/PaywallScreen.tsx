import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../theme/tokens';
import { useThemeColors, ThemeColors } from '../hooks/useThemeColors';
import { Icon } from '../components/common/Icon';
import { GradientButton } from '../components/common/GradientButton';
import { Button } from '../components/common/Button';
import { useSubscription } from '../hooks/useSubscription';

const FEATURES = [
  { icon: 'brain' as const, label: 'AI Coaching & adaptive engine' },
  { icon: 'chart' as const, label: 'Advanced analytics & reports' },
  { icon: 'utensils' as const, label: 'Micro-nutrient tracking' },
  { icon: 'muscle' as const, label: 'Health & recovery insights' },
  { icon: 'book' as const, label: 'Premium content library' },
  { icon: 'star' as const, label: 'Priority support' },
];

type PlanKey = 'monthly' | 'annual';

export function PaywallScreen() {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const { offerings, isLoading, purchase, restore } = useSubscription();
  const [selected, setSelected] = useState<PlanKey>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async () => {
    if (!offerings) return;
    setPurchasing(true);
    try {
      const pkg = selected === 'annual'
        ? (offerings.annual ?? offerings.availablePackages.find(p => p.identifier === '$rc_annual'))
        : (offerings.monthly ?? offerings.availablePackages.find(p => p.identifier === '$rc_monthly'));
      if (!pkg) { Alert.alert('Error', 'Plan not available'); return; }
      const success = await purchase(pkg);
      if (success) Alert.alert('Welcome!', 'You now have Repwise Pro.');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '1') return;
      Alert.alert('Purchase Failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restore();
      Alert.alert(restored ? 'Restored!' : 'No Purchases Found',
        restored ? 'Your subscription has been restored.' : 'No active subscriptions to restore.');
    } catch (e) {
      Alert.alert('Restore Failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  const monthlyPrice = offerings?.monthly?.product.priceString ?? '$9.99';
  const annualPrice = offerings?.annual?.product.priceString ?? '$79.99';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.bg.base }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: c.text.primary }]}>Unlock Repwise Pro</Text>
        <Text style={[s.subtitle, { color: c.text.secondary }]}>
          Train smarter with the full experience
        </Text>

        {/* Plan cards */}
        <View style={s.plans}>
          <TouchableOpacity
            style={[s.planCard, { backgroundColor: c.bg.surfaceRaised, borderColor: selected === 'annual' ? c.accent.primary : c.border.subtle }]}
            onPress={() => setSelected('annual')}
            activeOpacity={0.8}
          >
            <View style={[s.badge, { backgroundColor: c.accent.primary }]}>
              <Text style={[s.badgeText, { color: c.text.inverse }]}>Best Value</Text>
            </View>
            <Text style={[s.planLabel, { color: c.text.secondary }]}>Annual</Text>
            <Text style={[s.planPrice, { color: c.text.primary }]}>{annualPrice}/yr</Text>
            <Text style={[s.planSavings, { color: c.semantic.positive }]}>Save 33%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.planCard, { backgroundColor: c.bg.surfaceRaised, borderColor: selected === 'monthly' ? c.accent.primary : c.border.subtle }]}
            onPress={() => setSelected('monthly')}
            activeOpacity={0.8}
          >
            <Text style={[s.planLabel, { color: c.text.secondary, marginTop: spacing[6] }]}>Monthly</Text>
            <Text style={[s.planPrice, { color: c.text.primary }]}>{monthlyPrice}/mo</Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map(({ icon, label }) => (
            <View key={label} style={s.featureRow}>
              <Icon name={icon} size={18} color={c.semantic.positive} />
              <Text style={[s.featureText, { color: c.text.primary }]}>{label}</Text>
            </View>
          ))}
        </View>

        <GradientButton
          title="Start Free Trial"
          onPress={handlePurchase}
          loading={purchasing}
          disabled={purchasing || isLoading || !offerings}
          style={s.cta}
        />
        {isLoading && <ActivityIndicator size="small" style={{ marginBottom: spacing[3] }} />}

        <Button
          title="Restore Purchases"
          onPress={handleRestore}
          loading={restoring}
          variant="ghost"
          style={s.restoreBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing[6], paddingBottom: spacing[16] },
  title: {
    fontSize: typography.size['2xl'],
    lineHeight: typography.lineHeight['2xl'],
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginTop: spacing[8],
  },
  subtitle: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[8],
  },
  plans: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[8] },
  planCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing[4],
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  planLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  planPrice: {
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[1],
  },
  planSavings: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginTop: spacing[1],
  },
  features: { gap: spacing[4], marginBottom: spacing[8] },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  featureText: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  cta: { marginBottom: spacing[3] },
  restoreBtn: { marginBottom: spacing[3] },
});
