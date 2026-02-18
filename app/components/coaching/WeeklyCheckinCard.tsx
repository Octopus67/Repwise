import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { colors, spacing, typography, radius } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface WeeklyCheckinData {
  has_sufficient_data: boolean;
  days_remaining?: number | null;
  new_targets?: MacroTargets | null;
  previous_targets?: MacroTargets | null;
  weight_trend?: number | null;
  weekly_weight_change?: number | null;
  explanation: string;
  suggestion_id?: string | null;
  coaching_mode: string;
  // Recomp-specific fields
  recomp_recommendation?: string | null;
  recomp_score?: number | null;
}

interface WeeklyCheckinCardProps {
  checkin: WeeklyCheckinData;
  onDismiss: () => void;
  onAccept?: (suggestionId: string) => void;
  onModify?: (suggestionId: string, targets: MacroTargets) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeeklyCheckinCard({
  checkin,
  onDismiss,
  onAccept,
  onModify,
  onDismissSuggestion,
}: WeeklyCheckinCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTargets, setEditTargets] = useState<MacroTargets>({
    calories: checkin.new_targets?.calories ?? 2000,
    protein_g: checkin.new_targets?.protein_g ?? 150,
    carbs_g: checkin.new_targets?.carbs_g ?? 200,
    fat_g: checkin.new_targets?.fat_g ?? 60,
  });

  // Manual mode: not shown
  if (checkin.coaching_mode === 'manual') return null;

  // Recomp mode: show recomp-specific check-in
  if (checkin.coaching_mode === 'recomp' && checkin.recomp_recommendation) {
    const scoreColor = (checkin.recomp_score ?? 0) > 10
      ? colors.semantic.positive
      : (checkin.recomp_score ?? 0) < -10
        ? colors.semantic.negative
        : colors.text.secondary;

    return (
      <Card variant="flat" style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="body-outline" size={20} color={colors.accent.primary} />
          <Text style={styles.title}>Recomp Check-in</Text>
        </View>
        <Text style={styles.explanation}>{checkin.recomp_recommendation}</Text>
        {checkin.recomp_score != null && (
          <Text style={[styles.trendText, { color: scoreColor }]}>
            Recomp Score: {checkin.recomp_score > 0 ? '+' : ''}{checkin.recomp_score.toFixed(0)}
          </Text>
        )}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss recomp check-in"
        >
          <Text style={styles.primaryButtonText}>Got it</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  // Insufficient data
  if (!checkin.has_sufficient_data) {
    const remaining = checkin.days_remaining ?? 7;
    const logged = 7 - remaining;
    const progress = logged / 7;

    return (
      <Card variant="flat" style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="analytics-outline" size={20} color={colors.accent.primary} />
          <Text style={styles.title}>Weekly Check-in</Text>
        </View>
        <Text style={styles.explanation}>
          Log {remaining} more day{remaining !== 1 ? 's' : ''} for personalized recommendations
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{logged}/7 days logged</Text>
      </Card>
    );
  }

  // Coached mode: informational card
  if (checkin.coaching_mode === 'coached') {
    return (
      <Card variant="flat" style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={20} color={colors.semantic.positive} />
          <Text style={styles.title}>Weekly Check-in</Text>
        </View>
        {checkin.weight_trend != null && (
          <Text style={styles.trendText}>
            Trend: {checkin.weight_trend.toFixed(1)}kg
            {checkin.weekly_weight_change != null && (
              <Text style={styles.changeText}>
                {' '}({checkin.weekly_weight_change > 0 ? '+' : ''}{checkin.weekly_weight_change.toFixed(1)}kg)
              </Text>
            )}
          </Text>
        )}
        {checkin.new_targets && <TargetRow targets={checkin.new_targets} />}
        <Text style={styles.explanation}>{checkin.explanation}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss check-in"
        >
          <Text style={styles.primaryButtonText}>Got it</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  // Collaborative mode: accept/modify/dismiss
  if (checkin.coaching_mode === 'collaborative' && checkin.suggestion_id) {
    return (
      <Card variant="flat" style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="bulb-outline" size={20} color={colors.accent.primary} />
          <Text style={styles.title}>Suggested Update</Text>
        </View>
        {checkin.weight_trend != null && (
          <Text style={styles.trendText}>
            Trend: {checkin.weight_trend.toFixed(1)}kg
            {checkin.weekly_weight_change != null && (
              <Text style={styles.changeText}>
                {' '}({checkin.weekly_weight_change > 0 ? '+' : ''}{checkin.weekly_weight_change.toFixed(1)}kg)
              </Text>
            )}
          </Text>
        )}
        <Text style={styles.explanation}>{checkin.explanation}</Text>

        {isEditing ? (
          <View style={styles.editContainer}>
            <MacroInput label="Calories" value={editTargets.calories} min={1200}
              onChange={(v) => setEditTargets({ ...editTargets, calories: v })} />
            <MacroInput label="Protein (g)" value={editTargets.protein_g} min={0}
              onChange={(v) => setEditTargets({ ...editTargets, protein_g: v })} />
            <MacroInput label="Carbs (g)" value={editTargets.carbs_g} min={0}
              onChange={(v) => setEditTargets({ ...editTargets, carbs_g: v })} />
            <MacroInput label="Fat (g)" value={editTargets.fat_g} min={0}
              onChange={(v) => setEditTargets({ ...editTargets, fat_g: v })} />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                onModify?.(checkin.suggestion_id!, editTargets);
                setIsEditing(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Save modified targets"
            >
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {checkin.new_targets && <TargetRow targets={checkin.new_targets} />}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => onAccept?.(checkin.suggestion_id!)}
                accessibilityRole="button"
                accessibilityLabel="Accept suggestion"
              >
                <Text style={styles.primaryButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setIsEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Modify suggestion"
              >
                <Text style={styles.secondaryButtonText}>Modify</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => onDismissSuggestion?.(checkin.suggestion_id!)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss suggestion"
              >
                <Text style={styles.secondaryButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Card>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TargetRow({ targets }: { targets: MacroTargets }) {
  return (
    <View style={styles.targetRow}>
      <TargetPill label="Cal" value={Math.round(targets.calories)} color={colors.macro.calories} />
      <TargetPill label="P" value={Math.round(targets.protein_g)} color={colors.macro.protein} />
      <TargetPill label="C" value={Math.round(targets.carbs_g)} color={colors.macro.carbs} />
      <TargetPill label="F" value={Math.round(targets.fat_g)} color={colors.macro.fat} />
    </View>
  );
}

function TargetPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

function MacroInput({
  label, value, min, onChange,
}: {
  label: string; value: number; min: number; onChange: (v: number) => void;
}) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(Math.round(value))}
        onChangeText={(text) => {
          const num = parseFloat(text) || min;
          onChange(Math.max(min, num));
        }}
        accessibilityLabel={`${label} input`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: { marginBottom: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  title: { color: colors.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold, lineHeight: typography.size.md * typography.lineHeight.tight },
  trendText: { color: colors.text.primary, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.normal, marginBottom: spacing[1] },
  changeText: { color: colors.text.secondary },
  explanation: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal, marginBottom: spacing[3] },
  progressBarBg: {
    height: 6, backgroundColor: colors.bg.surfaceRaised, borderRadius: radius.full, marginBottom: spacing[1],
  },
  progressBarFill: {
    height: 6, backgroundColor: colors.accent.primary, borderRadius: radius.full,
  },
  progressText: { color: colors.text.muted, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },
  targetRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  pill: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[1],
    borderWidth: 1, borderRadius: radius.sm,
  },
  pillLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, lineHeight: typography.size.xs * typography.lineHeight.normal },
  pillValue: { color: colors.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.bold, lineHeight: typography.size.md * typography.lineHeight.tight },
  buttonRow: { flexDirection: 'row', gap: spacing[2] },
  primaryButton: {
    flex: 1, backgroundColor: colors.accent.primary, paddingVertical: spacing[2],
    borderRadius: radius.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' as const,
  },
  primaryButtonText: { color: colors.text.inverse, fontWeight: typography.weight.semibold, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.normal },
  secondaryButton: {
    flex: 1, borderWidth: 1, borderColor: colors.border.default, paddingVertical: spacing[2],
    borderRadius: radius.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' as const,
  },
  secondaryButtonText: { color: colors.text.secondary, fontWeight: typography.weight.medium, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.normal },
  editContainer: { gap: spacing[2] },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputLabel: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  input: {
    color: colors.text.primary, backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    fontSize: typography.size.base, width: 80, textAlign: 'right',
  },
});
