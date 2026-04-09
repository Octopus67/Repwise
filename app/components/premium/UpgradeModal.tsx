import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';
import { GradientButton } from '../common/GradientButton';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { getOfferings, purchasePackage, restorePurchases } from '../../services/purchases';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  trialEligible?: boolean;
  onStartTrial?: () => void;
}

const PLANS = [
  { key: 'monthly' as const, label: 'Monthly', price: '$9.99/mo', savings: '' },
  { key: 'yearly' as const, label: 'Yearly', price: '$79.99/yr', savings: 'Save 33%' },
];

const FEATURES = [
  '1:1 Coaching sessions',
  'Premium content library',
  'Advanced adaptive engine',
  'Health report analysis',
  'Detailed dietary gap analysis',
  'Micro-nutrient tracking',
];

export function UpgradeModal({ visible, onClose, trialEligible, onStartTrial }: UpgradeModalProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = React.useState(false);
  const [trialLoading, setTrialLoading] = React.useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [rcOfferings, setRcOfferings] = useState<any>(null);
  const [rcLoading, setRcLoading] = useState(true);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRcLoading(true);
    getOfferings().then(setRcOfferings).catch(() => {}).finally(() => setRcLoading(false));
  }, [visible]);

  const handlePurchase = async () => {
    if (!rcOfferings) return;
    const pkg = selectedPlan === 'yearly'
      ? rcOfferings.annual ?? rcOfferings.availablePackages?.find((p: { identifier: string }) => p.identifier === '$rc_annual')
      : rcOfferings.monthly ?? rcOfferings.availablePackages?.find((p: { identifier: string }) => p.identifier === '$rc_monthly');
    if (!pkg) { Alert.alert('Error', 'Package not available'); return; }
    setLoading(true);
    try {
      const customerInfo = await purchasePackage(pkg);
      if (customerInfo.entitlements.active['premium']) {
        await api.get('payments/status');
        Alert.alert('Success', 'Subscription activated!');
        onClose();
      }
    } catch (e: any) {
      if (e.userCancelled) return;
      Alert.alert('Purchase Failed', e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreLoading(true);
    try {
      const info = await restorePurchases();
      if (info?.entitlements?.active['premium']) {
        await api.get('payments/status');
        Alert.alert('Restored!', 'Your premium subscription has been restored.');
        onClose();
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions to restore.');
      }
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message ?? 'Something went wrong');
    } finally {
      setRestoreLoading(false);
    }
  };

  React.useEffect(() => {
    if (!visible) {
      setSelectedPlan('yearly');
      setLoading(false);
      setTrialLoading(false);
    }
  }, [visible]);

  const handleDismiss = () => {
    onClose();
  };

  const handleStartTrial = async () => {
    if (!onStartTrial) return;
    setTrialLoading(true);
    try {
      await api.post('trial/start');
      Alert.alert('Trial Started!', 'Enjoy 14 days of premium features.');
      onStartTrial();
      onClose();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Could not start trial');
      Alert.alert('Error', message);
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={[styles.overlay, { backgroundColor: c.bg.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.bg.surface }]}>
          <View style={[styles.handle, { backgroundColor: c.border.default }]} />

          <TouchableOpacity onPress={handleDismiss} style={{ position: 'absolute', top: spacing[4], right: spacing[4], zIndex: 1 }} accessibilityLabel="Close" accessibilityRole="button">
            <Icon name="close" size={24} color={c.text.muted} />
          </TouchableOpacity>

          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: c.text.primary }]}>Upgrade to Premium</Text>
            <Text style={[styles.subtitle, { color: c.text.secondary }]}>
              Unlock the full Repwise experience
            </Text>

            <View style={styles.plans}>
              {PLANS.map((plan) => (
                <TouchableOpacity
                  key={plan.key}
                  style={[
                    styles.planCard,
                    selectedPlan === plan.key && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedPlan(plan.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.planLabel, { color: c.text.secondary }]}>{plan.label}</Text>
                  <Text style={[styles.planPrice, { color: c.text.primary }]}>{plan.price}</Text>
                  {plan.savings ? (
                    <Text style={[styles.planSavings, { color: c.semantic.positive }]}>{plan.savings}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.features}>
              {FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Icon name="check" size={16} color={c.semantic.positive} />
                  <Text style={[styles.featureText, { color: c.text.primary }]}>{feature}</Text>
                </View>
              ))}
            </View>

            <GradientButton
              title="Subscribe Now"
              onPress={handlePurchase}
              loading={loading}
              disabled={rcLoading}
              style={styles.cta}
            />
            {rcLoading && (
              <ActivityIndicator size="small" style={{ marginBottom: spacing[3] }} />
            )}
            {trialEligible && (
              <Button
                title="Start 14-Day Free Trial"
                onPress={handleStartTrial}
                loading={trialLoading}
                variant="ghost"
                style={styles.trialCta}
              />
            )}
            <Button
              title="Restore Purchases"
              onPress={handleRestore}
              loading={restoreLoading}
              variant="ghost"
              style={styles.trialCta}
            />
            <Text style={[styles.disclosure, { color: c.text.muted }]}>
              Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your device's subscription settings.
            </Text>
            <TouchableOpacity onPress={handleDismiss} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: c.text.muted }]}>
                Maybe later
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: c.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[6],
    paddingBottom: spacing[10],
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: c.border.default,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[6],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  subtitle: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  plans: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  planCard: {
    flex: 1,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: spacing[4],
    alignItems: 'center',
  },
  planCardSelected: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  planLabel: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },
  planPrice: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[1],
  },
  planSavings: {
    color: c.semantic.positive,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.medium,
    marginTop: spacing[1],
  },
  features: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  checkmark: {},
  featureText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  cta: {
    marginBottom: spacing[3],
  },
  trialCta: {
    marginBottom: spacing[3],
  },
  cancelBtn: {
    alignItems: 'center',
    padding: spacing[3],
  },
  cancelText: {
    color: c.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  disclosure: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
});
