import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import api from '../../services/api';

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
  return (
    <View style={styles.stepperContainer}>
      <Text style={styles.stepperLabel}>{label}</Text>
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
      <Text style={styles.stepperHint}>{labels[value - 1]}</Text>
    </View>
  );
}

export function RecoveryCheckinModal({ visible, onClose, onSuccess }: Props) {
  const [soreness, setSoreness] = useState(1);
  const [stress, setStress] = useState(1);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.post('readiness/checkin', {
        soreness,
        stress,
        sleep_quality: sleepQuality,
        checkin_date: today,
      });
      onSuccess();
      onClose();
    } catch {
      // Silent fail — dashboard will show stale data
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Recovery Check-in</Text>
          <Stepper label="Soreness" value={soreness} onChange={setSoreness} labels={LABELS.soreness} />
          <Stepper label="Stress" value={stress} onChange={setStress} labels={LABELS.stress} />
          <Stepper label="Sleep Quality" value={sleepQuality} onChange={setSleepQuality} labels={LABELS.sleep_quality} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.submitText}>Submit</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Skip</Text>
          </TouchableOpacity>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing[5],
    paddingBottom: spacing[8],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  stepperContainer: {
    marginBottom: spacing[4],
  },
  stepperLabel: {
    color: colors.text.secondary,
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
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  stepperBtnActive: {
    backgroundColor: colors.accent.primaryMuted,
    borderColor: colors.accent.primary,
  },
  stepperBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  stepperBtnTextActive: {
    color: colors.accent.primary,
  },
  stepperHint: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
  },
  submitText: {
    color: colors.text.inverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: spacing[3],
  },
  cancelText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
});
