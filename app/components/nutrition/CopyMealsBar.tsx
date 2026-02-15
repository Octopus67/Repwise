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
import api from '../../services/api';

interface CopyMealsBarProps {
  targetDate: string;
  onCopyComplete: () => void;
}

export function CopyMealsBar({ targetDate, onCopyComplete }: CopyMealsBarProps) {
  const [loading, setLoading] = useState(false);
  const [showDateInput, setShowDateInput] = useState(false);
  const [sourceDate, setSourceDate] = useState('');

  const copyFromDate = async (source: string) => {
    setLoading(true);
    try {
      const res = await api.post('nutrition/entries/copy', {
        source_date: source,
        target_date: targetDate,
      });
      const copied = res.data;
      if (Array.isArray(copied) && copied.length === 0) {
        Alert.alert('No entries', 'No entries found for that date.');
      } else {
        onCopyComplete();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to copy entries.';
      Alert.alert('Error', typeof msg === 'string' ? msg : 'Failed to copy entries.');
    } finally {
      setLoading(false);
      setShowDateInput(false);
      setSourceDate('');
    }
  };

  const handleCopyYesterday = () => {
    const d = new Date(targetDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];
    copyFromDate(yesterday);
  };

  const handleCopyFromDate = () => {
    if (!sourceDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Please enter a date in YYYY-MM-DD format.');
      return;
    }
    copyFromDate(sourceDate);
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCopyYesterday}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading && !showDateInput ? (
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <Text style={styles.buttonText}>Copy Yesterday</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => setShowDateInput(!showDateInput)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Copy from Date</Text>
        </TouchableOpacity>
      </View>

      {showDateInput && (
        <View style={styles.dateInputRow}>
          <TextInput
            style={styles.dateInput}
            value={sourceDate}
            onChangeText={setSourceDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.goButton, loading && styles.buttonDisabled]}
            onPress={handleCopyFromDate}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.primary} size="small" />
            ) : (
              <Text style={styles.goButtonText}>Copy</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  button: {
    flex: 1,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  dateInput: {
    flex: 1,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.text.primary,
    fontSize: typography.size.sm,
  },
  goButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
    alignItems: 'center',
  },
  goButtonText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
});
