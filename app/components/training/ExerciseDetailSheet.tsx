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

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  StyleSheet,
  PanResponder,
} from 'react-native';
import type { Exercise } from '../../types/exercise';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import {
  shouldShowInstructions,
  shouldShowTips,
  shouldShowImage,
  getDisplayImageUrl,
  getMusclesTargeted,
  getExerciseTags,
} from '../../utils/exerciseDetailLogic';
import { MuscleGroupIcon } from '../exercise-picker/MuscleGroupIcon';
import { getMuscleGroupConfig } from '../../config/muscleGroups';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

interface ExerciseDetailSheetProps {
  exercise: Exercise | null;
  visible: boolean;
  onDismiss: () => void;
}

export function ExerciseDetailSheet({ exercise, visible, onDismiss }: ExerciseDetailSheetProps) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [internalVisible, setInternalVisible] = useState(false);

  // Pan responder for swipe-down dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      slideAnim.setValue(SHEET_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    }
  }, [visible, slideAnim]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setInternalVisible(false);
      onDismiss();
    });
  };

  if (!exercise) return null;

  const imageUrl = getDisplayImageUrl(exercise);
  const hasImage = shouldShowImage(exercise);
  const muscles = getMusclesTargeted(exercise);
  const tags = getExerciseTags(exercise);
  const hasInstructions = shouldShowInstructions(exercise);
  const hasTips = shouldShowTips(exercise);
  const config = getMuscleGroupConfig(exercise.muscle_group);
  const mgColor = config?.color ?? '#2563EB';

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
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Image or placeholder */}
          {hasImage && imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={`${exercise.name} demonstration`}
            />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: `${mgColor}15` }]}>
              <MuscleGroupIcon muscleGroup={exercise.muscle_group} size={48} color={mgColor} />
              <Text style={styles.placeholderText}>No image available</Text>
            </View>
          )}

          {/* Exercise name */}
          <Text style={styles.exerciseName}>{exercise.name}</Text>

          {/* Tags */}
          <View style={styles.tagRow}>
            {tags.map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* Muscles Targeted */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Muscles Targeted</Text>
            <Text style={styles.muscleLabel}>
              Primary: <Text style={styles.muscleValue}>{muscles.primary.replace(/_/g, ' ')}</Text>
            </Text>
            {muscles.secondary.length > 0 && (
              <Text style={styles.muscleLabel}>
                Secondary:{' '}
                <Text style={styles.muscleValue}>
                  {muscles.secondary.map((m) => m.replace(/_/g, ' ')).join(', ')}
                </Text>
              </Text>
            )}
          </View>

          {/* Instructions */}
          {hasInstructions ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {exercise.instructions!.map((step, i) => (
                <View key={i} style={styles.instructionRow}>
                  <Text style={styles.instructionNum}>{i + 1}.</Text>
                  <Text style={styles.instructionText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <Text style={styles.noContent}>No instructions available</Text>
            </View>
          )}

          {/* Tips */}
          {hasTips && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tips</Text>
              {exercise.tips!.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Bottom padding for scroll */}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.bg.surface,
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
    backgroundColor: colors.text.muted,
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
    backgroundColor: colors.bg.surfaceRaised,
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
    color: colors.text.muted,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
  },
  exerciseName: {
    color: colors.text.primary,
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
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  tagText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  muscleLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[1],
  },
  muscleValue: {
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  instructionNum: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    width: 24,
  },
  instructionText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    flex: 1,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  noContent: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    fontStyle: 'italic',
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  tipBullet: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    width: 20,
  },
  tipText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    flex: 1,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
});
