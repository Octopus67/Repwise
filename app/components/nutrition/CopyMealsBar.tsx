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
import { spacing, typography, radius, opacityScale } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import api from '../../services/api';

interface CopyMealsBarProps {
  targetDate: string;
  onCopyComplete: () => void;
}

export function CopyMealsBar({ targetDate, onCopyComplete }: CopyMealsBarProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
    const date = new Date(sourceDate);
    if (isNaN(date.getTime())) {
      Alert.alert('Invalid date', 'Please enter a valid date.');
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
            <ActivityIndicator color={c.text.primary} size="small" />
          ) : (
            <Text style={[styles.buttonText, { color: c.text.primary }]}>Copy Yesterday</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => setShowDateInput(!showDateInput)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, { color: c.text.primary }]}>Copy from Date</Text>
        </TouchableOpacity>
      </View>

      {showDateInput && (
        <View style={styles.dateInputRow}>
          <TextInput
            style={[styles.dateInput, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={sourceDate}
            onChangeText={setSourceDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.text.muted}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.goButton, loading && styles.buttonDisabled]}
            onPress={handleCopyFromDate}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={c.text.primary} size="small" />
            ) : (
              <Text style={[styles.goButtonText, { color: c.text.primary }]}>Copy</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  button: {
    flex: 1,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingVertical: spacing[2],
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: opacityScale.disabled,
  },
  buttonText: {
    fontSize: typography.size.sm,
    color: c.text.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  dateInput: {
    flex: 1,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: c.text.primary,
    fontSize: typography.size.sm,
  },
  goButton: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  goButtonText: {
    fontSize: typography.size.sm,
    color: c.text.primary,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});
