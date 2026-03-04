import { formatDuration } from '../../utils/durationFormat';
import type { PersonalRecordResponse } from '../../types/training';
import type { WorkoutSummaryResult } from '../../utils/workoutSummary';

// Test the WorkoutSummaryScreen logic without rendering
interface WorkoutSummaryScreenParams {
  summary: WorkoutSummaryResult;
  duration: number;
  personalRecords: PersonalRecordResponse[];
  exerciseBreakdown: Array<{
    exerciseName: string;
    setsCompleted: number;
    bestSet: { weight: string; reps: string } | null;
  }>;
}

function getWorkoutSummaryState(params: WorkoutSummaryScreenParams) {
  const { summary, duration, personalRecords, exerciseBreakdown } = params;

  const formatVolume = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${Math.round(kg)}kg`;
  };

  return {
    stats: {
      duration: formatDuration(duration),
      exercises: summary.exerciseCount.toString(),
      sets: summary.setCount.toString(),
      volume: formatVolume(summary.totalVolumeKg),
    },
    exerciseBreakdown,
    personalRecords,
    hasPRs: personalRecords.length > 0,
  };
}

// Mock data
const mockSummary: WorkoutSummaryResult = {
  exerciseCount: 3,
  setCount: 8,
  totalVolumeKg: 2500,
};

const mockExerciseBreakdown = [
  {
    exerciseName: 'Bench Press',
    setsCompleted: 3,
    bestSet: { weight: '100', reps: '8' },
  },
  {
    exerciseName: 'Squat',
    setsCompleted: 3,
    bestSet: { weight: '120', reps: '5' },
  },
  {
    exerciseName: 'Deadlift',
    setsCompleted: 2,
    bestSet: { weight: '140', reps: '3' },
  },
];

const mockPersonalRecords: PersonalRecordResponse[] = [
  {
    exercise_name: 'Bench Press',
    new_weight_kg: 105,
    previous_weight_kg: 100,
    reps: 8,
  },
  {
    exercise_name: 'Squat',
    new_weight_kg: 125,
    previous_weight_kg: null,
    reps: 5,
  },
];

describe('WorkoutSummaryScreen Logic', () => {
  describe('Summary stats formatting', () => {
    it('formats all stats correctly with typical data', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 3600, // 1 hour
        personalRecords: mockPersonalRecords,
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.duration).toBe('1:00:00');
      expect(state.stats.exercises).toBe('3');
      expect(state.stats.sets).toBe('8');
      expect(state.stats.volume).toBe('2.5t');
      expect(state.hasPRs).toBe(true);
    });

    it('formats duration correctly for short workouts', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 1800, // 30 minutes
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.duration).toBe('30:00');
    });

    it('formats volume in kg for values under 1000kg', () => {
      const state = getWorkoutSummaryState({
        summary: { ...mockSummary, totalVolumeKg: 850 },
        duration: 3600,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.volume).toBe('850kg');
    });

    it('formats volume in tonnes for values 1000kg and above', () => {
      const state = getWorkoutSummaryState({
        summary: { ...mockSummary, totalVolumeKg: 1250 },
        duration: 3600,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.volume).toBe('1.3t');
    });

    it('rounds volume correctly', () => {
      const state = getWorkoutSummaryState({
        summary: { ...mockSummary, totalVolumeKg: 1234.7 },
        duration: 3600,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.volume).toBe('1.2t');
    });
  });

  describe('Edge cases', () => {
    it('handles zero duration', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 0,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.duration).toBe('00:00');
    });

    it('handles single exercise', () => {
      const singleExercise = [mockExerciseBreakdown[0]];
      const state = getWorkoutSummaryState({
        summary: { exerciseCount: 1, setCount: 3, totalVolumeKg: 800 },
        duration: 1800,
        personalRecords: [],
        exerciseBreakdown: singleExercise,
      });

      expect(state.stats.exercises).toBe('1');
      expect(state.exerciseBreakdown).toHaveLength(1);
      expect(state.exerciseBreakdown[0].exerciseName).toBe('Bench Press');
    });

    it('handles no personal records', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 3600,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.hasPRs).toBe(false);
      expect(state.personalRecords).toHaveLength(0);
    });

    it('handles empty exercise breakdown', () => {
      const state = getWorkoutSummaryState({
        summary: { exerciseCount: 0, setCount: 0, totalVolumeKg: 0 },
        duration: 0,
        personalRecords: [],
        exerciseBreakdown: [],
      });

      expect(state.stats.exercises).toBe('0');
      expect(state.stats.sets).toBe('0');
      expect(state.stats.volume).toBe('0kg');
      expect(state.exerciseBreakdown).toHaveLength(0);
    });

    it('handles exercise without best set', () => {
      const exerciseWithoutBest = [
        {
          exerciseName: 'Warm-up Exercise',
          setsCompleted: 2,
          bestSet: null,
        },
      ];

      const state = getWorkoutSummaryState({
        summary: { exerciseCount: 1, setCount: 2, totalVolumeKg: 0 },
        duration: 600,
        personalRecords: [],
        exerciseBreakdown: exerciseWithoutBest,
      });

      expect(state.exerciseBreakdown[0].bestSet).toBe(null);
    });
  });

  describe('Personal records handling', () => {
    it('handles PR with previous weight', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 3600,
        personalRecords: [mockPersonalRecords[0]],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      const pr = state.personalRecords[0];
      expect(pr.exercise_name).toBe('Bench Press');
      expect(pr.new_weight_kg).toBe(105);
      expect(pr.previous_weight_kg).toBe(100);
    });

    it('handles first-time PR (no previous weight)', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 3600,
        personalRecords: [mockPersonalRecords[1]],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      const pr = state.personalRecords[0];
      expect(pr.exercise_name).toBe('Squat');
      expect(pr.new_weight_kg).toBe(125);
      expect(pr.previous_weight_kg).toBe(null);
    });

    it('handles multiple personal records', () => {
      const state = getWorkoutSummaryState({
        summary: mockSummary,
        duration: 3600,
        personalRecords: mockPersonalRecords,
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.personalRecords).toHaveLength(2);
      expect(state.hasPRs).toBe(true);
    });
  });

  describe('Volume calculation edge cases', () => {
    it('handles exactly 1000kg volume', () => {
      const state = getWorkoutSummaryState({
        summary: { ...mockSummary, totalVolumeKg: 1000 },
        duration: 3600,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.volume).toBe('1.0t');
    });

    it('handles very small volume', () => {
      const state = getWorkoutSummaryState({
        summary: { ...mockSummary, totalVolumeKg: 0.5 },
        duration: 3600,
        personalRecords: [],
        exerciseBreakdown: mockExerciseBreakdown,
      });

      expect(state.stats.volume).toBe('1kg'); // Math.round(0.5) = 1
    });
  });
});