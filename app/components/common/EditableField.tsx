import { useState, useCallback } from 'react';
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
import { Icon } from './Icon';

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  editable?: boolean;
}

export function EditableField({
  label,
  value,
  onSave,
  editable = true,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleTap = useCallback(() => {
    if (!editable) return;
    setDraft(value);
    setEditing(true);
  }, [editable, value]);

  const handleCancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
      setDraft(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, value]);

  // Edit mode
  if (editing) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          autoFocus
          placeholderTextColor={colors.text.muted}
        />
        <View style={styles.actions}>
          {saving ? (
            <ActivityIndicator color={colors.accent.primary} size="small" />
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          )}
          {!saving && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Read-only mode (not editable)
  if (!editable) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.viewRow}>
          <Text style={styles.value} numberOfLines={1}>{value || '—'}</Text>
          <Icon name="lock" size={14} color={colors.text.muted} />
        </View>
      </View>
    );
  }

  // View mode (editable, not editing)
  return (
    <TouchableOpacity style={styles.container} onPress={handleTap} activeOpacity={0.7}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.viewRow}>
        <Text style={styles.value} numberOfLines={1}>{value || '—'}</Text>
        <Icon name="edit" size={14} color={colors.text.muted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  viewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  icon: {},
  input: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.focus,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  saveBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
  },
  saveBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  cancelBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
  },
  cancelBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});
