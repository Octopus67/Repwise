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
import { GlassCard } from '../common/GlassCard';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import { MacroTargets } from '../../types/nutrition';
export type { MacroTargets };

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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [isEditing, setIsEditing] = useState(false);
  const [editTargets, setEditTargets] = useState<MacroTargets>({
    calories: checkin.new_targets?.calories ?? 2000,
    protein_g: checkin.new_targets?.protein_g ?? 150,
    carbs_g: checkin.new_targets?.carbs_g ?? 200,
    fat_g: checkin.new_targets?.fat_g ?? 60,
  });

  // Sync edit targets when checkin prop changes (e.g. new suggestion arrives)
  React.useEffect(() => {
    setEditTargets({
      calories: checkin.new_targets?.calories ?? 2000,
      protein_g: checkin.new_targets?.protein_g ?? 150,
      carbs_g: checkin.new_targets?.carbs_g ?? 200,
      fat_g: checkin.new_targets?.fat_g ?? 60,
    });
    setIsEditing(false);
  }, [checkin.new_targets]);

  // Manual mode: not shown
  if (checkin.coaching_mode === 'manual') return null;

  // Recomp mode: show recomp-specific check-in
  if (checkin.coaching_mode === 'recomp' && checkin.recomp_recommendation) {
    const scoreColor = (checkin.recomp_score ?? 0) > 10
      ? c.semantic.positive
      : (checkin.recomp_score ?? 0) < -10
        ? c.semantic.negative
        : c.text.secondary;

    return (
      <GlassCard style={getStyles().card}>
        <View style={getStyles().header}>
          <Ionicons name="body-outline" size={20} color={c.accent.primary} />
          <Text style={[getStyles().title, { color: c.text.primary }]}>Recomp Check-in</Text>
        </View>
        <Text style={[getStyles().explanation, { color: c.text.secondary }]}>{checkin.recomp_recommendation}</Text>
        {checkin.recomp_score != null && (
          <Text style={[getStyles().trendText, { color: scoreColor }]}>
            Recomp Score: {checkin.recomp_score > 0 ? '+' : ''}{checkin.recomp_score.toFixed(0)}
          </Text>
        )}
        <TouchableOpacity
          style={[getStyles().primaryButton, { backgroundColor: c.accent.primary }]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss recomp check-in"
        >
          <Text style={[getStyles().primaryButtonText, { color: c.text.inverse }]}>Got it</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  // Insufficient data
  if (!checkin.has_sufficient_data) {
    const remaining = checkin.days_remaining ?? 7;
    const logged = 7 - remaining;
    const progress = logged / 7;

    return (
      <GlassCard style={getStyles().card}>
        <View style={getStyles().header}>
          <Ionicons name="analytics-outline" size={20} color={c.accent.primary} />
          <Text style={[getStyles().title, { color: c.text.primary }]}>Weekly Check-in</Text>
        </View>
        <Text style={[getStyles().explanation, { color: c.text.secondary }]}>
          Log {remaining} more day{remaining !== 1 ? 's' : ''} for personalized recommendations
        </Text>
        <View style={[getStyles().progressBarBg, { backgroundColor: c.bg.surfaceRaised }]}>
          <View style={[getStyles().progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[getStyles().progressText, { color: c.text.muted }]}>{logged}/7 days logged</Text>
      </GlassCard>
    );
  }

  // Coached mode: informational card
  if (checkin.coaching_mode === 'coached') {
    return (
      <GlassCard style={getStyles().card}>
        <View style={getStyles().header}>
          <Ionicons name="checkmark-circle" size={20} color={c.semantic.positive} />
          <Text style={[getStyles().title, { color: c.text.primary }]}>Weekly Check-in</Text>
        </View>
        {checkin.weight_trend != null && (
          <Text style={[getStyles().trendText, { color: c.text.primary }]}>
            Trend: {checkin.weight_trend.toFixed(1)}kg
            {checkin.weekly_weight_change != null && (
              <Text style={[getStyles().changeText, { color: c.text.secondary }]}>
                {' '}({checkin.weekly_weight_change > 0 ? '+' : ''}{checkin.weekly_weight_change.toFixed(1)}kg)
              </Text>
            )}
          </Text>
        )}
        {checkin.new_targets && <TargetRow targets={checkin.new_targets} />}
        <Text style={[getStyles().explanation, { color: c.text.secondary }]}>{checkin.explanation}</Text>
        <TouchableOpacity
          style={[getStyles().primaryButton, { backgroundColor: c.accent.primary }]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss check-in"
        >
          <Text style={[getStyles().primaryButtonText, { color: c.text.inverse }]}>Got it</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  // Collaborative mode: accept/modify/dismiss
  if (checkin.coaching_mode === 'collaborative' && checkin.suggestion_id) {
    return (
      <GlassCard style={getStyles().card}>
        <View style={getStyles().header}>
          <Ionicons name="bulb-outline" size={20} color={c.accent.primary} />
          <Text style={[getStyles().title, { color: c.text.primary }]}>Suggested Update</Text>
        </View>
        {checkin.weight_trend != null && (
          <Text style={[getStyles().trendText, { color: c.text.primary }]}>
            Trend: {checkin.weight_trend.toFixed(1)}kg
            {checkin.weekly_weight_change != null && (
              <Text style={[getStyles().changeText, { color: c.text.secondary }]}>
                {' '}({checkin.weekly_weight_change > 0 ? '+' : ''}{checkin.weekly_weight_change.toFixed(1)}kg)
              </Text>
            )}
          </Text>
        )}
        <Text style={[getStyles().explanation, { color: c.text.secondary }]}>{checkin.explanation}</Text>

        {isEditing ? (
          <View style={getStyles().editContainer}>
            <MacroInput label="Calories" value={editTargets.calories} min={1200}
              onChange={(v) => setEditTargets({ ...editTargets, calories: v })} />
            <MacroInput label="Protein (g)" value={editTargets.protein_g} min={0}
              onChange={(v) => setEditTargets({ ...editTargets, protein_g: v })} />
            <MacroInput label="Carbs (g)" value={editTargets.carbs_g} min={0}
              onChange={(v) => setEditTargets({ ...editTargets, carbs_g: v })} />
            <MacroInput label="Fat (g)" value={editTargets.fat_g} min={0}
              onChange={(v) => setEditTargets({ ...editTargets, fat_g: v })} />
            <TouchableOpacity
              style={[getStyles().primaryButton, { backgroundColor: c.accent.primary }]}
              onPress={() => {
                onModify?.(checkin.suggestion_id!, editTargets);
                setIsEditing(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Save modified targets"
            >
              <Text style={[getStyles().primaryButtonText, { color: c.text.inverse }]}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {checkin.new_targets && checkin.previous_targets && (
              <ComparisonTargetRow 
                previousTargets={checkin.previous_targets} 
                newTargets={checkin.new_targets} 
              />
            )}
            {checkin.new_targets && !checkin.previous_targets && (
              <TargetRow targets={checkin.new_targets} />
            )}
            <View style={getStyles().buttonRow}>
              <TouchableOpacity
                style={[getStyles().primaryButton, { backgroundColor: c.accent.primary }]}
                onPress={() => onAccept?.(checkin.suggestion_id!)}
                accessibilityRole="button"
                accessibilityLabel="Accept suggestion"
              >
                <Text style={[getStyles().primaryButtonText, { color: c.text.inverse }]}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[getStyles().secondaryButton, { borderColor: c.border.default }]}
                onPress={() => setIsEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Modify suggestion"
              >
                <Text style={[getStyles().secondaryButtonText, { color: c.text.secondary }]}>Modify</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[getStyles().secondaryButton, { borderColor: c.border.default }]}
                onPress={() => onDismissSuggestion?.(checkin.suggestion_id!)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss suggestion"
              >
                <Text style={[getStyles().secondaryButtonText, { color: c.text.secondary }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </GlassCard>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TargetRow({ targets }: { targets: MacroTargets }) {
  const c = useThemeColors();
  return (
    <View style={getStyles().targetRow}>
      <TargetPill label="Cal" value={Math.round(targets.calories)} color={c.macro.calories} />
      <TargetPill label="P" value={Math.round(targets.protein_g)} color={c.macro.protein} />
      <TargetPill label="C" value={Math.round(targets.carbs_g)} color={c.macro.carbs} />
      <TargetPill label="F" value={Math.round(targets.fat_g)} color={c.macro.fat} />
    </View>
  );
}

function ComparisonTargetRow({ previousTargets, newTargets }: { 
  previousTargets: MacroTargets; 
  newTargets: MacroTargets; 
}) {
  const c = useThemeColors();
  return (
    <View style={getStyles().comparisonContainer}>
      <View style={getStyles().comparisonRow}>
        <Text style={[getStyles().comparisonLabel, { color: c.text.secondary }]}>Current</Text>
        <View style={getStyles().comparisonTargets}>
          <ComparisonPill label="Cal" value={Math.round(previousTargets.calories)} color={c.macro.calories} />
          <ComparisonPill label="P" value={Math.round(previousTargets.protein_g)} color={c.macro.protein} />
          <ComparisonPill label="C" value={Math.round(previousTargets.carbs_g)} color={c.macro.carbs} />
          <ComparisonPill label="F" value={Math.round(previousTargets.fat_g)} color={c.macro.fat} />
        </View>
      </View>
      <View style={getStyles().comparisonRow}>
        <Text style={[getStyles().comparisonLabel, { color: c.text.secondary }]}>Suggested</Text>
        <View style={getStyles().comparisonTargets}>
          <ComparisonPill label="Cal" value={Math.round(newTargets.calories)} color={c.macro.calories} />
          <ComparisonPill label="P" value={Math.round(newTargets.protein_g)} color={c.macro.protein} />
          <ComparisonPill label="C" value={Math.round(newTargets.carbs_g)} color={c.macro.carbs} />
          <ComparisonPill label="F" value={Math.round(newTargets.fat_g)} color={c.macro.fat} />
        </View>
      </View>
    </View>
  );
}

function TargetPill({ label, value, color }: { label: string; value: number; color: string }) {
  const c = useThemeColors();
  return (
    <View style={[getStyles().pill, { borderColor: color }]}>
      <Text style={[getStyles().pillLabel, { color }]}>{label}</Text>
      <Text style={[getStyles().pillValue, { color: c.text.primary }]}>{value}</Text>
    </View>
  );
}

function ComparisonPill({ label, value, color }: { label: string; value: number; color: string }) {
  const c = useThemeColors();
  return (
    <View style={[getStyles().comparisonPill, { borderColor: color }]}>
      <Text style={[getStyles().comparisonPillLabel, { color }]}>{label}</Text>
      <Text style={[getStyles().comparisonPillValue, { color: c.text.primary }]}>{value}</Text>
    </View>
  );
}

function MacroInput({
  label, value, min, onChange,
}: {
  label: string; value: number; min: number; onChange: (v: number) => void;
}) {
  return (
    <View style={getStyles().inputRow}>
      <Text style={[getStyles().inputLabel, { color: getThemeColors().text.secondary }]}>{label}</Text>
      <TextInput
        style={[getStyles().input, { color: getThemeColors().text.primary, backgroundColor: getThemeColors().bg.surfaceRaised }]}
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

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: { marginBottom: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  title: { color: c.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold, lineHeight: typography.size.md * typography.lineHeight.tight },
  trendText: { color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.normal, marginBottom: spacing[1] },
  changeText: { color: c.text.secondary },
  explanation: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal, marginBottom: spacing[3] },
  progressBarBg: {
    height: 6, backgroundColor: c.bg.surfaceRaised, borderRadius: radius.full, marginBottom: spacing[1],
  },
  progressBarFill: {
    height: 6, backgroundColor: c.accent.primary, borderRadius: radius.full,
  },
  progressText: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },
  targetRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  pill: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[1],
    borderWidth: 1, borderRadius: radius.sm,
  },
  pillLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, lineHeight: typography.size.xs * typography.lineHeight.normal },
  pillValue: { color: c.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.bold, lineHeight: typography.size.md * typography.lineHeight.tight },
  buttonRow: { flexDirection: 'row', gap: spacing[2] },
  primaryButton: {
    flex: 1, backgroundColor: c.accent.primary, paddingVertical: spacing[2],
    borderRadius: radius.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' as const,
  },
  primaryButtonText: { color: c.text.inverse, fontWeight: typography.weight.semibold, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.normal },
  secondaryButton: {
    flex: 1, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[2],
    borderRadius: radius.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' as const,
  },
  secondaryButtonText: { color: c.text.secondary, fontWeight: typography.weight.medium, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.normal },
  editContainer: { gap: spacing[2] },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputLabel: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  input: {
    color: c.text.primary, backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    fontSize: typography.size.base, width: 80, textAlign: 'right',
  },
  comparisonContainer: { marginBottom: spacing[3] },
  comparisonRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: spacing[1] 
  },
  comparisonLabel: { 
    color: c.text.secondary, 
    fontSize: typography.size.sm, 
    fontWeight: typography.weight.medium,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    width: 70
  },
  comparisonTargets: { 
    flexDirection: 'row', 
    gap: spacing[1], 
    flex: 1 
  },
  comparisonPill: {
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: spacing[1],
    borderWidth: 1, 
    borderRadius: radius.sm,
  },
  comparisonPillLabel: { 
    fontSize: typography.size.xs, 
    fontWeight: typography.weight.medium, 
    lineHeight: typography.size.xs * typography.lineHeight.normal 
  },
  comparisonPillValue: { 
    color: c.text.primary, 
    fontSize: typography.size.sm, 
    fontWeight: typography.weight.semibold, 
    lineHeight: typography.size.sm * typography.lineHeight.tight 
  },
});
