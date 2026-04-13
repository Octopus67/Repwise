import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { convertWeight } from '../../utils/unitConversion';
import type { TrainingSessionResponse } from '../../types/training';
import type { UnitSystem } from '../../utils/unitConversion';

interface SessionComparisonProps {
  currentSession: TrainingSessionResponse;
  previousSession: TrainingSessionResponse;
  unitSystem: UnitSystem;
}

function calcVolume(sets: { weight_kg: number; reps: number }[]) {
  return sets.reduce((sum, s) => sum + (s.weight_kg === 0 ? s.reps : s.weight_kg * s.reps), 0);
}

export function SessionComparison({ currentSession, previousSession, unitSystem }: SessionComparisonProps) {
  const c = useThemeColors();
  const s = getStyles(c);
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const prevMap = new Map<string, TrainingSessionResponse['exercises'][number]>();
  previousSession.exercises.forEach((ex) => prevMap.set(ex.exercise_name, ex));

  const currNames = new Set(currentSession.exercises.map((ex) => ex.exercise_name));
  const removedExercises = previousSession.exercises.filter((ex) => !currNames.has(ex.exercise_name));

  return (
    <View>
      {currentSession.exercises.map((ex, i) => {
        const prev = prevMap.get(ex.exercise_name);
        const currVol = calcVolume(ex.sets);
        const prevVol = prev ? calcVolume(prev.sets) : 0;
        const delta = currVol - prevVol;
        const displayDelta = convertWeight(Math.abs(delta), unitSystem);

        return (
          <View key={i} style={[s.row, { borderBottomColor: c.border.subtle }]}>
            <View style={s.nameCol}>
              <Text style={[s.name, { color: c.text.primary }]}>{ex.exercise_name}</Text>
              {!prev && <View style={[s.badge, { backgroundColor: c.semantic.positive }]}><Text style={s.badgeText}>New</Text></View>}
            </View>
            <View style={s.deltaCol}>
              <Text style={[s.sets, { color: c.text.muted }]}>{ex.sets.length}s</Text>
              {prev && (
                <Text style={{ color: delta > 0 ? c.semantic.positive : delta < 0 ? c.semantic.negative : c.text.muted, fontSize: typography.size.sm, fontWeight: typography.weight.semibold }}>
                  {delta > 0 ? '+' : delta < 0 ? '-' : ''}{Math.round(displayDelta)} {unitLabel}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {removedExercises.map((ex, i) => (
        <View key={`removed-${i}`} style={[s.row, { borderBottomColor: c.border.subtle, opacity: 0.6 }]}>
          <View style={s.nameCol}>
            <Text style={[s.name, { color: c.text.secondary }]}>{ex.exercise_name}</Text>
            <View style={[s.badge, { backgroundColor: c.semantic.negative }]}><Text style={s.badgeText}>Removed</Text></View>
          </View>
          <View style={s.deltaCol} />
        </View>
      ))}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: 1 },
  nameCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  deltaCol: { alignItems: 'flex-end', gap: 2 },
  sets: { fontSize: typography.size.xs },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 1, borderRadius: radius.sm },
  badgeText: { color: c.text.onAccent, fontSize: 10, fontWeight: typography.weight.semibold },
});
