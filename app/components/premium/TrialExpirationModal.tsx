import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';
import api from '../../services/api';
import type { TrialInsights } from '../../utils/trialLogic';

interface WinbackOffer {
  eligible: boolean;
  discount_pct: number;
  original_price: number;
  discounted_price: number;
  deadline: string;
  remaining_seconds: number;
}

interface TrialExpirationModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: (planId?: string) => void;
  insights: TrialInsights | null;
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TrialExpirationModal({
  visible,
  onClose,
  onUpgrade,
  insights,
}: TrialExpirationModalProps) {
  const c = useThemeColors();
  const [offer, setOffer] = useState<WinbackOffer | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setOffer(null);
      setRemaining(0);
      return;
    }
    let cancelled = false;
    api.get('payments/winback-offer').then(({ data }) => {
      if (!cancelled && data?.eligible && data.remaining_seconds > 0) {
        setOffer(data);
        setRemaining(data.remaining_seconds);
      }
    }).catch(() => {}); // Intentional: analytics/winback offer is fire-and-forget
    return () => { cancelled = true; };
  }, [visible]);

  const isCountingDown = remaining > 0;

  useEffect(() => {
    if (remaining <= 0) return;
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isCountingDown]);

  const hasOffer = offer && remaining > 0;

  const stats = insights
    ? [
        { label: 'Workouts logged', value: insights.workouts_logged, icon: 'dumbbell' as const },
        { label: 'PRs hit', value: insights.prs_hit, icon: 'trophy' as const },
        { label: 'Volume lifted', value: `${Math.round(insights.total_volume_kg).toLocaleString()} kg`, icon: 'chart' as const },
        { label: 'Meals logged', value: insights.meals_logged, icon: 'utensils' as const },
        { label: 'Measurements', value: insights.measurements_tracked, icon: 'scale' as const },
      ]
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: c.bg.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.bg.surface }]}>
          <View style={[styles.handle, { backgroundColor: c.border.default }]} />

          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: spacing[4], right: spacing[4], zIndex: 1 }} accessibilityLabel="Close" accessibilityRole="button">
            <Icon name="close" size={24} color={c.text.muted} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: c.text.primary }]}>
              Your Trial Has Ended
            </Text>
            <Text style={[styles.subtitle, { color: c.text.secondary }]}>
              Here's what you accomplished in 14 days
            </Text>

            {stats.length > 0 && (
              <View style={styles.statsGrid}>
                {stats.map((stat) => (
                  <View
                    key={stat.label}
                    style={[styles.statCard, { backgroundColor: c.bg.surfaceRaised }]}
                  >
                    <Icon name={stat.icon} size={20} color={c.accent.primary} />
                    <Text style={[styles.statValue, { color: c.text.primary }]}>
                      {stat.value}
                    </Text>
                    <Text style={[styles.statLabel, { color: c.text.muted }]}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {hasOffer ? (
              <View style={styles.offerSection}>
                <Text style={[styles.offerHeading, { color: c.accent.primary }]}>
                  Special offer: {offer.discount_pct}% off Premium
                </Text>
                <Text style={[styles.countdown, { color: c.text.primary }]}>
                  {formatCountdown(remaining)}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.originalPrice, { color: c.text.muted }]}>
                    ${offer.original_price.toFixed(2)}/yr
                  </Text>
                  <Text style={[styles.discountedPrice, { color: c.semantic.positive }]}>
                    ${offer.discounted_price.toFixed(2)}/yr
                  </Text>
                </View>
                <Button title={`Claim ${offer.discount_pct}% Off`} onPress={() => onUpgrade('yearly_winback_discount')} style={styles.cta} />
              </View>
            ) : (
              <Button title="Upgrade to Premium" onPress={() => onUpgrade()} style={styles.cta} />
            )}

            <Button
              title="Maybe later"
              onPress={onClose}
              variant="ghost"
              style={styles.dismiss}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[6],
    paddingBottom: spacing[10],
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  statCard: {
    width: '47%',
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[1],
  },
  statValue: {
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
  },
  statLabel: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  offerSection: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  offerHeading: {
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  countdown: {
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing[2],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  originalPrice: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
  },
  cta: {
    marginBottom: spacing[3],
  },
  dismiss: {},
});
