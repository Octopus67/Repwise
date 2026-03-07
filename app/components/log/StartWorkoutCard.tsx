import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, radius, letterSpacing as ls } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { WorkoutTemplateResponse } from '../../types/training';

// ─── 5.1: Props Interface ────────────────────────────────────────────────────

interface StartWorkoutCardProps {
  userTemplates: WorkoutTemplateResponse[];
  staticTemplates: Array<{ id: string; name: string; description: string; exercises: any[] }>;
  onStartEmpty: () => void;
  onStartTemplate: (templateId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StartWorkoutCard({
  userTemplates,
  staticTemplates,
  onStartEmpty,
  onStartTemplate,
}: StartWorkoutCardProps) {
  const c = useThemeColors();
  // 5.4: Template picker toggle
  const [showPicker, setShowPicker] = useState(false);

  const hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0;

  // 5.6: Close picker and fire callback
  const handleSelectTemplate = (templateId: string) => {
    setShowPicker(false);
    onStartTemplate(templateId);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.accent.primaryMuted }]}>
      {/* 5.2: Title */}
      <Text style={[styles.title, { color: c.text.primary }]}>🏋️ Start Workout</Text>

      {/* 5.3 / 5.5: Buttons */}
      <View style={styles.buttonRow}>
        {hasTemplates ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.buttonHalf]}
              onPress={onStartEmpty}
              accessibilityRole="button"
              accessibilityLabel="Start empty workout"
            >
              <Text style={[styles.buttonText, { color: c.text.inverse }]}>Empty Workout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonHalf, showPicker && styles.buttonActive]}
              onPress={() => setShowPicker((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel="Start workout from template"
            >
              <Text style={[styles.buttonText, { color: c.text.inverse }]}>From Template</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* 5.5: No templates — single full-width button */
          <TouchableOpacity
            style={[styles.button, styles.buttonFull]}
            onPress={onStartEmpty}
            accessibilityRole="button"
            accessibilityLabel="Start workout"
          >
            <Text style={[styles.buttonText, { color: c.text.inverse }]}>Start Workout</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 5.4: Template picker */}
      {showPicker && hasTemplates && (
        <View style={[styles.picker, { backgroundColor: c.bg.surfaceRaised }]}>
          {userTemplates.length > 0 && (
            <>
              <Text style={[styles.subheader, { color: c.text.secondary }]}>My Templates</Text>
              {userTemplates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateRow, { borderBottomColor: c.border.subtle }]}
                  onPress={() => handleSelectTemplate(t.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${t.name}`}
                >
                  <Text style={[styles.templateName, { color: c.text.primary }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[styles.exerciseCount, { color: c.text.muted }]}>
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {staticTemplates.length > 0 && (
            <>
              <Text style={[styles.subheader, { color: c.text.secondary }]}>Pre-built</Text>
              {staticTemplates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateRow, { borderBottomColor: c.border.subtle }]}
                  onPress={() => handleSelectTemplate(t.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${t.name}`}
                >
                  <Text style={[styles.templateName, { color: c.text.primary }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[styles.exerciseCount, { color: c.text.muted }]}>
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}


// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  button: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonFull: {
    flex: 1,
  },
  buttonActive: {
    backgroundColor: colors.accent.primaryHover,
  },
  buttonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.inverse,
  },
  picker: {
    marginTop: spacing[3],
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  subheader: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing[2],
    marginTop: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: ls.wide,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  templateName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing[2],
  },
  exerciseCount: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
  },
});

export type { StartWorkoutCardProps };
