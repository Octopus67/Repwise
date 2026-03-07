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
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ModalContainer } from '../common/ModalContainer';
import { validateQuickAdd } from '../../utils/quickAddValidation';
import { Icon } from '../common/Icon';
import api from '../../services/api';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetDate: string;
}

export function QuickAddModal({ visible, onClose, onSuccess, targetDate }: QuickAddModalProps) {
  const c = useThemeColors();
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const doSubmit = async () => {
    if (loading) return; // guard against double-submit from Alert callback
    setLoading(true);
    try {
      const safeNum = (v: string) => { const n = Number(v); return isNaN(n) || !isFinite(n) ? 0 : Math.max(0, n); };
      await api.post('nutrition/entries', {
        entry_date: targetDate,
        meal_name: 'Quick add',
        calories: safeNum(calories),
        protein_g: safeNum(protein),
        carbs_g: safeNum(carbs),
        fat_g: safeNum(fat),
      });
      reset();
      onSuccess();
    } catch {
      Alert.alert('Error', 'Failed to log entry. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const cal = Number(calories);
    const result = validateQuickAdd(cal);

    if (!result.valid) {
      Alert.alert('Invalid', result.error ?? 'Invalid calorie value');
      return;
    }

    if (result.needsConfirmation) {
      Alert.alert(
        'Confirm',
        `You entered ${cal} calories. Is this correct?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', onPress: doSubmit },
        ],
      );
      return;
    }

    doSubmit();
  };

  return (
    <ModalContainer visible={visible} onClose={handleClose} title={<><Icon name="lightning" size={18} color={c.accent.primary} /><Text style={{ fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: c.text.primary }}>Quick Add</Text></>} testID="quick-add-modal" closeButtonTestID="quickadd-cancel-button">
      <View style={styles.field}>
        <Text style={[styles.label, { color: c.text.secondary }]}>Calories *</Text>
        <TextInput
          style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
          value={calories}
          onChangeText={setCalories}
          keyboardType="numeric"
          placeholder="e.g. 500"
          placeholderTextColor={c.text.muted}
          autoFocus
          testID="quickadd-calories-input"
        />
      </View>

      <View style={styles.optionalRow}>
        <View style={styles.optionalField}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Protein (g)</Text>
          <TextInput
            style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={protein}
            onChangeText={setProtein}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.text.muted}
            testID="quickadd-protein-input"
          />
        </View>
        <View style={styles.optionalField}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Carbs (g)</Text>
          <TextInput
            style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.text.muted}
            testID="quickadd-carbs-input"
          />
        </View>
        <View style={styles.optionalField}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Fat (g)</Text>
          <TextInput
            style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={fat}
            onChangeText={setFat}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.text.muted}
            testID="quickadd-fat-input"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.7}
        testID="quickadd-submit-button"
      >
        {loading ? (
          <ActivityIndicator color={c.text.primary} />
        ) : (
          <Text style={[styles.submitText, { color: c.text.primary }]}>Log Entry</Text>
        )}
      </TouchableOpacity>
    </ModalContainer>
  );
}


const styles = StyleSheet.create({
  field: {
    marginBottom: spacing[3],
  },
  label: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    color: colors.text.secondary,
    marginBottom: spacing[1],
    fontWeight: typography.weight.medium,
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  optionalRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  optionalField: {
    flex: 1,
  },
  submitBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
});
