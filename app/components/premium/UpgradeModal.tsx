import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';
import api from '../../services/api';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
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

export function UpgradeModal({ visible, onClose }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = React.useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await api.post('payments/subscribe', { plan: selectedPlan });
      Alert.alert('Success', 'Subscription activated!');
      onClose();
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.subtitle}>
              Unlock the full HypertrophyOS experience
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
                  <Text style={styles.planLabel}>{plan.label}</Text>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  {plan.savings ? (
                    <Text style={styles.planSavings}>{plan.savings}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.features}>
              {FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Icon name="check" size={16} color={colors.semantic.positive} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <Button
              title="Subscribe Now"
              onPress={handleSubscribe}
              loading={loading}
              style={styles.cta}
            />
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Maybe later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[6],
    paddingBottom: spacing[10],
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[6],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.secondary,
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
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    alignItems: 'center',
  },
  planCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  planLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },
  planPrice: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[1],
  },
  planSavings: {
    color: colors.semantic.positive,
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
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  cta: {
    marginBottom: spacing[3],
  },
  cancelBtn: {
    alignItems: 'center',
    padding: spacing[3],
  },
  cancelText: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
});
