import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from './Icon';

interface PickerFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => Promise<void>;
}

export function PickerField({ label, value, options, onSelect }: PickerFieldProps) {
  const c = useThemeColors();
  const styles = getStyles(c);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayLabel = options.find((o) => o.value === value)?.label ?? value ?? '—';

  const handleSelect = async (val: string) => {
    setVisible(false);
    if (val === value) return;
    setSaving(true);
    try {
      await onSelect(val);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.row}>
          <Text style={styles.value} numberOfLines={1}>{displayLabel}</Text>
          {saving ? (
            <ActivityIndicator color={c.accent.primary} size="small" />
          ) : (
            <Icon name="chevron-right" size={14} color={c.text.muted} />
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)} // Audit fix 4.3 — Android back button
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} accessibilityLabel="Close">
                <Icon name="close" size={20} color={c.text.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(i) => i.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => handleSelect(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.label}
                    </Text>
                    {active && <Icon name="check" size={16} color={c.accent.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: c.border.subtle,
    },
    label: {
      color: c.text.muted,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
      marginBottom: spacing[1],
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    value: {
      color: c.text.primary,
      fontSize: typography.size.base,
      fontWeight: typography.weight.medium,
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.bg.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '60%',
      paddingBottom: spacing[6],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: c.border.subtle,
    },
    headerTitle: {
      color: c.text.primary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    option: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: c.border.subtle,
    },
    optionActive: {
      backgroundColor: c.accent.primaryMuted,
    },
    optionText: {
      color: c.text.primary,
      fontSize: typography.size.base,
    },
    optionTextActive: {
      color: c.accent.primary,
      fontWeight: typography.weight.semibold,
    },
  });
