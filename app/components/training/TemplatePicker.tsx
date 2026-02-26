import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import api from '../../services/api';
import { orderTemplates } from '../../utils/templateConversion';
import type { WorkoutTemplateResponse } from '../../types/training';
import { colors, spacing, typography, radius, shadows, letterSpacing as ls } from '../../theme/tokens';

interface TemplatePickerProps {
  onSelectTemplate: (templateId: string, isSystem: boolean) => void;
  onCopyLast: () => void;
  onStartEmpty: () => void;
}

export function TemplatePicker({
  onSelectTemplate,
  onCopyLast,
  onStartEmpty,
}: TemplatePickerProps) {
  const [userTemplates, setUserTemplates] = useState<WorkoutTemplateResponse[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<WorkoutTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTemplates() {
      try {
        const [userRes, systemRes] = await Promise.allSettled([
          api.get<WorkoutTemplateResponse[]>('training/user-templates'),
          api.get<WorkoutTemplateResponse[]>('training/templates'),
        ]);

        if (cancelled) return;

        if (userRes.status === 'fulfilled') {
          setUserTemplates(
            userRes.value.data.map((t) => ({ ...t, is_system: false })),
          );
        }
        if (systemRes.status === 'fulfilled') {
          setSystemTemplates(
            systemRes.value.data.map((t) => ({ ...t, is_system: true })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTemplates();
    return () => { cancelled = true; };
  }, []);

  const handleLongPress = useCallback(
    (template: WorkoutTemplateResponse) => {
      if (template.is_system) return;

      if (Platform.OS === 'ios') {
        const options = ['Edit', 'Delete', 'Cancel'];
        ActionSheetIOS.showActionSheetWithOptions(
          { options, destructiveButtonIndex: 1, cancelButtonIndex: 2 },
          (index) => {
            if (index === 0) {
              onSelectTemplate(template.id, false);
            } else if (index === 1) {
              deleteTemplate(template.id);
            }
          },
        );
      } else {
        // Android: use Alert
        Alert.alert(
          template.name,
          'What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Edit', onPress: () => onSelectTemplate(template.id, false) },
            { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(template.id) },
          ],
        );
      }
    },
    [onSelectTemplate],
  );

  async function deleteTemplate(id: string) {
    try {
      await api.delete(`training/user-templates/${id}`);
      setUserTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['OK'], cancelButtonIndex: 0, title: 'Failed to delete template. Please try again.' },
          () => {},
        );
      }
    }
  }

  const ordered = orderTemplates(userTemplates, systemTemplates);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Quick actions */}
      <TouchableOpacity style={styles.quickAction} onPress={onCopyLast} activeOpacity={0.7}>
        <Text style={styles.quickActionText}>📋 Copy Last Workout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quickAction} onPress={onStartEmpty} activeOpacity={0.7}>
        <Text style={styles.quickActionText}>➕ Start Empty Workout</Text>
      </TouchableOpacity>

      {/* My Templates */}
      {userTemplates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>My Templates</Text>
          {userTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onPress={() => onSelectTemplate(t.id, false)}
              onLongPress={() => handleLongPress(t)}
            />
          ))}
        </>
      )}

      {/* System Templates */}
      {systemTemplates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>System Templates</Text>
          {systemTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onPress={() => onSelectTemplate(t.id, true)}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function TemplateCard({
  template,
  onPress,
  onLongPress,
}: {
  template: WorkoutTemplateResponse;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <Text style={styles.cardName}>{template.name}</Text>
      {template.description ? (
        <Text style={styles.cardDesc} numberOfLines={1}>
          {template.description}
        </Text>
      ) : null}
      <Text style={styles.cardMeta}>
        {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    gap: spacing[3],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  quickAction: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  quickActionText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: ls.wide,
    marginTop: spacing[2],
  },
  card: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm,
  },
  cardName: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
  },
  cardDesc: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginBottom: spacing[1],
  },
  cardMeta: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
  },
});
