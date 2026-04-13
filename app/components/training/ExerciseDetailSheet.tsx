/**
 * ExerciseDetailSheet — Modal-based bottom sheet showing exercise details
 *
 * Displays animated GIF or static image, exercise name, tags,
 * muscles targeted, instructions, and tips. Dismissible by
 * tapping the backdrop or swiping down.
 *
 * Uses a Modal + Animated.View slide-up instead of @gorhom/bottom-sheet
 * to avoid peer dependency conflicts.
 *
 * Phase 5, Task 5.2
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import type { Exercise } from '../../types/exercise';
import api from '../../services/api';
import { spacing, typography, radius, springs, motion } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import {
  shouldShowInstructions,
  shouldShowTips,
  shouldShowImage,
  getDisplayImageUrl,
  getMusclesTargeted,
  getExerciseTags,
  resolveImageUrl,
} from '../../utils/exerciseDetailLogic';
import { MuscleGroupIcon } from '../exercise-picker/MuscleGroupIcon';
import { findMuscleGroupConfig } from '../../config/muscleGroups';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

interface ExerciseDetailSheetProps {
  exercise: Exercise | null;
  visible: boolean;
  onDismiss: () => void;
}

export function ExerciseDetailSheet({ exercise, visible, onDismiss }: ExerciseDetailSheetProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const slideAnim = useSharedValue(SHEET_HEIGHT);
  const [internalVisible, setInternalVisible] = useState(false);
  const [alternatives, setAlternatives] = useState<Exercise[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const reduceMotion = useReduceMotion();

  const fetchAlternatives = async () => {
    if (!exercise) return;
    try {
      const { data } = await api.get(`training/exercises/${exercise.id}/substitutes`);
      setAlternatives(data);
    } catch { /* silently fail */ }
  };

  const setInternalVisibleFalse = () => setInternalVisible(false);

  // Pan gesture for swipe-down dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        slideAnim.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        slideAnim.value = withTiming(SHEET_HEIGHT, { duration: motion.duration.default }, () => {
          runOnJS(setInternalVisibleFalse)();
          runOnJS(onDismiss)();
        });
      } else {
        slideAnim.value = reduceMotion ? 0 : withSpring(0, springs.gentle);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      setAlternatives([]);
      setShowAlternatives(false);
      if (reduceMotion) {
        slideAnim.value = 0;
      } else {
        slideAnim.value = SHEET_HEIGHT;
        slideAnim.value = withSpring(0, springs.gentle);
      }
    } else if (internalVisible) {
      // Animate out and sync internal state when parent sets visible=false
      if (reduceMotion) {
        setInternalVisible(false);
      } else {
        slideAnim.value = withTiming(SHEET_HEIGHT, { duration: 200 }, () => {
          runOnJS(setInternalVisibleFalse)();
        });
      }
    }
  }, [visible, reduceMotion]);

  const dismiss = () => {
    if (reduceMotion) {
      setInternalVisible(false);
      onDismiss();
    } else {
      slideAnim.value = withTiming(SHEET_HEIGHT, { duration: motion.duration.default }, () => {
        runOnJS(setInternalVisibleFalse)();
        runOnJS(onDismiss)();
      });
    }
  };

  const restOverride = useWorkoutPreferencesStore((s) => exercise ? s.exerciseRestOverrides[exercise.name] : undefined);
  const setRestDefault = useWorkoutPreferencesStore((s) => s.setExerciseRestDefault);
  const clearRestDefault = useWorkoutPreferencesStore((s) => s.clearExerciseRestDefault);

  if (!exercise) return null;

  const imageUrl = getDisplayImageUrl(exercise);
  const hasImage = shouldShowImage(exercise);
  const muscles = getMusclesTargeted(exercise);
  const tags = getExerciseTags(exercise);
  const hasInstructions = shouldShowInstructions(exercise);
  const hasTips = shouldShowTips(exercise);
  const config = findMuscleGroupConfig(exercise.muscle_group);
  const mgColor = config?.color ?? '#2563EB';

  const restValue = restOverride ?? null;

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;


  // Compact description: first 2 paragraphs, no biomechanics
  const compactDescription = useMemo(() => {
    if (!exercise?.description) return null;
    const withoutBio = exercise.description.split('**Biomechanics:**')[0].trim();
    const paragraphs = withoutBio.split(/\n\n+/).filter(Boolean);
    return paragraphs.slice(0, 2).join('\n\n');
  }, [exercise?.description]);

  const mdStyles = useMemo(() => ({
    body: { color: c.text.secondary, fontSize: typography.size.base },
    strong: { fontWeight: typography.weight.bold, color: c.text.primary },
    paragraph: { marginBottom: spacing[2] },
  }), [c]);

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableWithoutFeedback onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close exercise details">
        <View style={[styles.backdrop, { backgroundColor: c.bg.overlay }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.sheet, animatedSheetStyle]}
        >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: c.text.muted }]} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Image or placeholder */}
          {hasImage && imageUrl ? (
            <Image
              source={{ uri: resolveImageUrl(imageUrl) }}
              style={[styles.image, { backgroundColor: c.bg.surfaceRaised }]}
              resizeMode="contain"
              accessibilityLabel={`${exercise.name} demonstration`}
            />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: `${mgColor}15` }]}>
              <MuscleGroupIcon muscleGroup={exercise.muscle_group} size={48} color={mgColor} />
              <Text style={[styles.placeholderText, { color: c.text.muted }]}>No image available</Text>
            </View>
          )}

          {/* Exercise name */}
          <Text style={[styles.exerciseName, { color: c.text.primary }]}>{exercise.name}</Text>

          {/* Tags */}
          <View style={styles.tagRow}>
            {tags.map((tag, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: c.bg.surfaceRaised }]}>
                <Text style={[styles.tagText, { color: c.text.secondary }]}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* Muscles Targeted */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Muscles Targeted</Text>
            <Text style={[styles.muscleLabel, { color: c.text.secondary }]}>
              Primary: <Text style={[styles.muscleValue, { color: c.text.primary }]}>{muscles.primary.replace(/_/g, ' ')}</Text>
            </Text>
            {muscles.secondary.length > 0 && (
              <Text style={[styles.muscleLabel, { color: c.text.secondary }]}>
                Secondary:{' '}
                <Text style={[styles.muscleValue, { color: c.text.primary }]}>
                  {muscles.secondary.map((m) => m.replace(/_/g, ' ')).join(', ')}
                </Text>
              </Text>
            )}
          </View>

          {/* Rest Timer Default */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Rest Timer Default</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <TouchableOpacity
                onPress={() => setRestDefault(exercise.name, Math.max(30, (restValue ?? 90) - 30))}
                style={[styles.tag, { backgroundColor: c.bg.surfaceRaised, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }]}
                accessibilityLabel="Decrease rest time by 30 seconds"
                accessibilityRole="button"
              >
                <Text style={{ color: c.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold }}>−</Text>
              </TouchableOpacity>
              <Text style={{ color: c.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium }}>
                {restValue ? formatTime(restValue) : 'Global default'}
              </Text>
              <TouchableOpacity
                onPress={() => setRestDefault(exercise.name, Math.min(600, (restValue ?? 90) + 30))}
                style={[styles.tag, { backgroundColor: c.bg.surfaceRaised, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }]}
                accessibilityLabel="Increase rest time by 30 seconds"
                accessibilityRole="button"
              >
                <Text style={{ color: c.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold }}>+</Text>
              </TouchableOpacity>
              {restValue != null && (
                <TouchableOpacity onPress={() => clearRestDefault(exercise.name)} accessibilityLabel="Reset to global default" accessibilityRole="button">
                  <Text style={{ color: c.accent.primary, fontSize: typography.size.sm }}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Description (compact preview) */}
          {compactDescription && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Description</Text>
              <Markdown style={mdStyles}>{compactDescription}</Markdown>
            </View>
          )}

          {/* Instructions */}
          {hasInstructions ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Instructions</Text>
              {exercise.instructions?.map((step, i) => (
                <View key={i} style={styles.instructionRow}>
                  <Text style={[styles.instructionNum, { color: c.accent.primary }]}>{i + 1}.</Text>
                  <Text style={[styles.instructionText, { color: c.text.secondary }]}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Instructions</Text>
              <Text style={[styles.noContent, { color: c.text.muted }]}>No instructions available</Text>
            </View>
          )}

          {/* Tips */}
          {hasTips && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Tips</Text>
              {exercise.tips?.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={[styles.tipBullet, { color: c.accent.primary }]}>•</Text>
                  <Text style={[styles.tipText, { color: c.text.secondary }]}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Find Alternatives */}
          <View style={styles.section}>
            <TouchableOpacity onPress={() => { setShowAlternatives(!showAlternatives); if (!showAlternatives && alternatives.length === 0) fetchAlternatives(); }}>
              <Text style={[styles.sectionTitle, { color: c.accent.primary }]}>Find Alternatives {showAlternatives ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showAlternatives && alternatives.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {alternatives.map(alt => (
                  <View key={alt.id} style={[styles.altCard, { backgroundColor: c.bg.surfaceRaised }]}>
                    <Text style={[styles.altName, { color: c.text.primary }]}>{alt.name}</Text>
                    <Text style={[styles.altEquipment, { color: c.text.muted }]}>{alt.equipment}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Bottom padding for scroll */}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </Animated.View>
      </GestureDetector>
    </Modal>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: c.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.text.muted,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing[3],
    backgroundColor: c.bg.surfaceRaised,
  },
  placeholder: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
  },
  exerciseName: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginBottom: spacing[4],
  },
  tag: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  tagText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  muscleLabel: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[1],
  },
  muscleValue: {
    color: c.text.primary,
    textTransform: 'capitalize',
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  instructionNum: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    width: 24,
  },
  instructionText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    flex: 1,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  noContent: {
    color: c.text.muted,
    fontSize: typography.size.base,
    fontStyle: 'italic',
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  tipBullet: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    width: 20,
  },
  tipText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    flex: 1,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  altCard: {
    padding: spacing[3],
    borderRadius: radius.md,
    marginRight: spacing[2],
    minWidth: 120,
  },
  altName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
  },
  altEquipment: {
    fontSize: typography.size.xs,
    textTransform: 'capitalize',
  },
});
