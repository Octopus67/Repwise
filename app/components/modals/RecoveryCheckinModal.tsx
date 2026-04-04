import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { ModalContainer } from '../common/ModalContainer';
import api from '../../services/api';
import type { AxiosError } from 'axios';
import { getApiErrorMessage } from '../../utils/errors';
import { useStore } from '../../store';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LABELS = {
  soreness: ['None', 'Mild', 'Moderate', 'High', 'Very Sore'],
  stress: ['None', 'Low', 'Moderate', 'High', 'Very High'],
  sleep_quality: ['Poor', 'Fair', 'Okay', 'Good', 'Excellent'],
};

function Stepper({ label, value, onChange, labels }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  labels: string[];
}) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={styles.stepperContainer}>
      <Text style={[styles.stepperLabel, { color: c.text.secondary }]}>{label}</Text>
      <View style={styles.stepperRow}>
        {[1, 2, 3, 4, 5].map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.stepperBtn, value === v && styles.stepperBtnActive]}
            onPress={() => onChange(v)}
          >
            <Text style={[styles.stepperBtnText, value === v && styles.stepperBtnTextActive]}>
              {v}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.stepperHint, { color: c.text.muted }]}>{labels[value - 1]}</Text>
    </View>
  );
}

export function RecoveryCheckinModal({ visible, onClose, onSuccess }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const selectedDate = useStore((s) => s.selectedDate);
  const [soreness, setSoreness] = useState(1);
  const [stress, setStress] = useState(1);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens so stale values don't persist on reopen
  React.useEffect(() => {
    if (visible) {
      setSoreness(1);
      setStress(1);
      setSleepQuality(3);
    }
  }, [visible]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post('readiness/checkin', {
        soreness,
        stress,
        sleep_quality: sleepQuality,
        checkin_date: selectedDate,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to save check-in. Please try again.');
      console.warn('Recovery checkin failed:', (err as AxiosError)?.response?.status, msg);
      // Show error to user via Alert if available
      try {
        const { Alert } = require('react-native');
        Alert.alert('Error', msg);
      } catch (err) { console.warn('[RecoveryCheckin] Alert unavailable:', String(err)); }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Recovery Check-in" testID="recovery-checkin-modal">
          <Stepper label="Soreness" value={soreness} onChange={setSoreness} labels={LABELS.soreness} />
          <Stepper label="Stress" value={stress} onChange={setStress} labels={LABELS.stress} />
          <Stepper label="Sleep Quality" value={sleepQuality} onChange={setSleepQuality} labels={LABELS.sleep_quality} />
          <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={c.text.inverse} />
            ) : (
              <Text style={[styles.submitText, { color: c.text.inverse }]}>Submit</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: c.text.muted }]}>Skip</Text>
          </TouchableOpacity>
    </ModalContainer>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing[5],
    paddingBottom: spacing[8],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing[5],
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  closeBtn: {
    padding: spacing[2],
  },
  closeBtnText: {
    color: c.text.secondary,
    fontSize: typography.size.md,
  },
  stepperContainer: {
    marginBottom: spacing[4],
  },
  stepperLabel: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[2],
  },
  stepperRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  stepperBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: c.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  stepperBtnActive: {
    backgroundColor: c.accent.primaryMuted,
    borderColor: c.accent.primary,
  },
  stepperBtnText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  stepperBtnTextActive: {
    color: c.accent.primary,
  },
  stepperHint: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: c.text.inverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: spacing[3],
  },
  cancelText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
  },
});
