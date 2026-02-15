import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { ModalContainer } from '../common/ModalContainer';
import { useStore } from '../../store';
import { kgToLbs, lbsToKg, parseWeightToKg } from '../../utils/unitConversion';
import api from '../../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddBodyweightModal({ visible, onClose, onSuccess }: Props) {
  const unitSystem = useStore((s) => s.unitSystem);
  const selectedDate = useStore((s) => s.selectedDate);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>(unitSystem === 'imperial' ? 'lbs' : 'kg');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setWeight('');
    setUnit(unitSystem === 'imperial' ? 'lbs' : 'kg');
  };

  const handleUnitToggle = (newUnit: 'kg' | 'lbs') => {
    if (newUnit === unit) return;
    const numVal = parseFloat(weight);
    if (!isNaN(numVal) && numVal > 0) {
      if (newUnit === 'lbs') {
        setWeight(String(kgToLbs(numVal)));
      } else {
        setWeight(String(lbsToKg(numVal)));
      }
    }
    setUnit(newUnit);
  };

  const handleSubmit = async () => {
    if (!weight) {
      Alert.alert('Missing field', 'Please enter your weight.');
      return;
    }
    const numVal = Number(weight);
    if (isNaN(numVal) || numVal <= 0) {
      Alert.alert('Invalid', 'Please enter a valid weight.');
      return;
    }
    setLoading(true);
    try {
      await api.post('users/bodyweight', {
        recorded_date: selectedDate,
        weight_kg: parseWeightToKg(numVal, unit),
      });
      reset();
      Alert.alert('Logged!', 'Weight entry saved.');
      onSuccess();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to log bodyweight.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <ModalContainer visible={visible} onClose={handleClose} title="Log Bodyweight" testID="add-bodyweight-modal" closeButtonTestID="bodyweight-cancel-button">
      <View>
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{`Weight (${unit})`}</Text>
          <SegmentedControl
            options={[
              { label: 'kg', value: 'kg' },
              { label: 'lbs', value: 'lbs' },
            ]}
            selected={unit}
            onSelect={(val) => handleUnitToggle(val as 'kg' | 'lbs')}
          />
        </View>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder={unit === 'kg' ? 'e.g. 82.5' : 'e.g. 181.9'}
          placeholderTextColor={colors.text.muted}
          testID="bodyweight-weight-input"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.7}
        testID="bodyweight-submit-button"
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <Text style={styles.submitText}>Save</Text>
        )}
      </TouchableOpacity>
      </View>
    </ModalContainer>
  );
}

function SegmentedControl({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={segmentStyles.container} testID="bodyweight-unit-toggle">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            segmentStyles.segment,
            selected === opt.value && segmentStyles.segmentActive,
          ]}
          onPress={() => onSelect(opt.value)}
        >
          <Text
            style={[
              segmentStyles.segmentText,
              selected === opt.value && segmentStyles.segmentTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segmentStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.accent.primaryMuted,
  },
  segmentText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  segmentTextActive: {
    color: colors.accent.primary,
    fontWeight: typography.weight.medium,
  },
});

const styles = StyleSheet.create({
  field: { marginBottom: spacing[3] },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.base,
    padding: spacing[3],
  },
  submitBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    padding: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
