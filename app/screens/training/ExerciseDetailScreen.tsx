import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SafeAreaView, ScrollView, View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { ExerciseMuscleDiagram } from '../../components/exercise/ExerciseMuscleDiagram';
import { BiomechanicsCard } from '../../components/exercise/BiomechanicsCard';
import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import api from '../../services/api';
import type { Exercise } from '../../types/exercise';
import { getDisplayImageUrl, resolveImageUrl } from '../../utils/exerciseDetailLogic';

type Props = NativeStackScreenProps<{ ExerciseDetail: { exerciseId: string } }, 'ExerciseDetail'>;

export function ExerciseDetailScreen({ route, navigation }: Props) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const { exerciseId } = route.params ?? {};
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const addedRef = useRef(false);

  const fetchExercise = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('training/exercises');
      const all: Exercise[] = res.data ?? [];
      setExercise(all.find((e) => e.id === exerciseId) ?? null);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [exerciseId]);

  useEffect(() => { fetchExercise(); }, [fetchExercise]);

  const handleAdd = useCallback(() => {
    if (addedRef.current || !exercise) return;
    addedRef.current = true;
    useActiveWorkoutStore.getState().addExercise(exercise.name);
    navigation.goBack();
  }, [exercise, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <ActivityIndicator size="large" color={c.accent.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <Text style={s.muted}>{error ? 'Failed to load exercise' : 'Exercise not found'}</Text>
          {error ? (
            <TouchableOpacity onPress={fetchExercise} style={s.backLink}>
              <Text style={s.accent}>Retry</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backLink}>
              <Text style={s.accent}>Go back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const markdownStyles = useMemo(() => ({
    body: { color: c.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
    strong: { fontWeight: typography.weight.bold, color: c.text.primary },
    paragraph: { marginBottom: spacing[2] },
  }), [c]);

  const hasBio = exercise.strength_curve || exercise.loading_position || exercise.stretch_hypertrophy_potential || exercise.stimulus_to_fatigue || exercise.fatigue_rating;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={s.name}>{exercise.name}</Text>
        <View style={s.tagRow}>
          <View style={[s.tag, { backgroundColor: c.accent.primaryMuted }]}>
            <Text style={s.tagText}>{exercise.equipment.replace('_', ' ')}</Text>
          </View>
          <View style={[s.tag, { backgroundColor: c.semantic.positiveSubtle }]}>
            <Text style={s.tagText}>{exercise.category}</Text>
          </View>
        </View>

        {/* Hero Image */}
        {(() => {
          const imgUrl = getDisplayImageUrl(exercise);
          return imgUrl && !heroError ? (
            <Image
              source={{ uri: resolveImageUrl(imgUrl) }}
              style={s.heroImage}
              resizeMode="contain"
              accessibilityLabel={`${exercise.name} demonstration`}
              onError={() => setHeroError(true)}
            />
          ) : null;
        })()}

        {/* Muscle Diagram */}
        <View style={s.section}>
          <ExerciseMuscleDiagram primaryMuscle={exercise.muscle_group} secondaryMuscles={exercise.secondary_muscles} />
        </View>

        {/* Biomechanics */}
        {hasBio && (
          <View style={s.section}>
            <BiomechanicsCard
              strength_curve={exercise.strength_curve}
              loading_position={exercise.loading_position}
              stretch_hypertrophy_potential={exercise.stretch_hypertrophy_potential}
              stimulus_to_fatigue={exercise.stimulus_to_fatigue}
              fatigue_rating={exercise.fatigue_rating}
            />
          </View>
        )}

        {/* Description */}
        {exercise.description && (() => {
          const parts = exercise.description.split('**Biomechanics:**');
          const mainDesc = parts[0].trim();
          const bioDesc = parts.length > 1 ? `**Biomechanics:**${parts[1]}` : null;
          return (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Description</Text>
              <Markdown style={markdownStyles}>{mainDesc}</Markdown>
              {bioDesc && (
                <>
                  <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)}>
                    <Text style={[s.body, { color: c.accent.primary }]}>
                      {bioExpanded ? 'Hide biomechanics ▲' : 'Show biomechanics ▼'}
                    </Text>
                  </TouchableOpacity>
                  {bioExpanded && <Markdown style={markdownStyles}>{bioDesc}</Markdown>}
                </>
              )}
            </View>
          );
        })()}

        {/* Coaching Cues */}
        {exercise.coaching_cues && exercise.coaching_cues.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Coaching Cues</Text>
            {exercise.coaching_cues.map((cue, i) => (
              <Text key={i} style={s.body}>• {cue}</Text>
            ))}
          </View>
        )}

        {/* Instructions */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Instructions</Text>
            {exercise.instructions.map((step, i) => (
              <Text key={i} style={s.body}>{i + 1}. {step}</Text>
            ))}
          </View>
        )}

        {/* Tips */}
        {exercise.tips && exercise.tips.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tips</Text>
            {exercise.tips.map((tip, i) => (
              <Text key={i} style={s.body}>• {tip}</Text>
            ))}
          </View>
        )}

        {/* Bottom spacer for fixed button */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.addBtn} onPress={handleAdd} activeOpacity={0.8}>
          <Text style={s.addBtnText}>Add to Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg.base },
  content: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: c.text.muted, fontSize: typography.size.md },
  accent: { color: c.accent.primary, fontSize: typography.size.md, marginTop: spacing[2] },
  backLink: { marginTop: spacing[2] },
  backBtn: { marginBottom: spacing[3] },
  backText: { color: c.text.primary, fontSize: typography.size.base },
  name: { color: c.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  tagRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  tag: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  tagText: { color: c.text.secondary, fontSize: typography.size.sm },
  heroImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, marginBottom: spacing[4], backgroundColor: c.bg.surfaceRaised },
  section: { marginBottom: spacing[4] },
  sectionTitle: { color: c.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold, marginBottom: spacing[2] },
  body: { color: c.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, marginBottom: 4 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing[4], backgroundColor: c.bg.base, borderTopWidth: 1, borderTopColor: c.border.subtle },
  addBtn: { backgroundColor: c.accent.primary, borderRadius: radius.sm, paddingVertical: spacing[3], alignItems: 'center' },
  addBtnText: { color: c.text.inverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
});
