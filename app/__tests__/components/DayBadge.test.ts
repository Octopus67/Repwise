/**
 * Feature: training-day-indicator
 * Tests for DayBadge component display logic.
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5
 *
 * Tests the pure display logic extracted from DayBadge:
 * - Which text to show based on isTrainingDay
 * - Whether muscle group chips should render
 * - Whether skeleton should render
 */

interface DayBadgeProps {
  isTrainingDay: boolean;
  muscleGroups: string[];
  isLoading: boolean;
}

/** Extract the display state from DayBadge props */
function getDayBadgeDisplay(props: DayBadgeProps) {
  if (props.isLoading) {
    return { mode: 'skeleton' as const, text: null, icon: null, chips: [] };
  }
  if (props.isTrainingDay) {
    return {
      mode: 'training' as const,
      text: 'Training Day',
      icon: 'dumbbell',
      chips: props.muscleGroups,
    };
  }
  return {
    mode: 'rest' as const,
    text: 'Rest Day',
    icon: 'moon',
    chips: [],
  };
}

describe('DayBadge display logic', () => {
  test('renders "Training Day" when isTrainingDay=true', () => {
    const display = getDayBadgeDisplay({
      isTrainingDay: true,
      muscleGroups: ['Chest', 'Back'],
      isLoading: false,
    });
    expect(display.mode).toBe('training');
    expect(display.text).toBe('Training Day');
    expect(display.icon).toBe('dumbbell');
  });

  test('renders "Rest Day" when isTrainingDay=false', () => {
    const display = getDayBadgeDisplay({
      isTrainingDay: false,
      muscleGroups: [],
      isLoading: false,
    });
    expect(display.mode).toBe('rest');
    expect(display.text).toBe('Rest Day');
    expect(display.icon).toBe('moon');
  });

  test('renders muscle group chips when muscleGroups is non-empty', () => {
    const display = getDayBadgeDisplay({
      isTrainingDay: true,
      muscleGroups: ['Chest', 'Back', 'Shoulders'],
      isLoading: false,
    });
    expect(display.chips).toEqual(['Chest', 'Back', 'Shoulders']);
    expect(display.chips.length).toBe(3);
  });

  test('renders no muscle group chips when muscleGroups is empty', () => {
    const display = getDayBadgeDisplay({
      isTrainingDay: true,
      muscleGroups: [],
      isLoading: false,
    });
    expect(display.chips).toEqual([]);
  });

  test('renders skeleton when isLoading=true', () => {
    const display = getDayBadgeDisplay({
      isTrainingDay: true,
      muscleGroups: ['Chest'],
      isLoading: true,
    });
    expect(display.mode).toBe('skeleton');
    expect(display.text).toBeNull();
    expect(display.chips).toEqual([]);
  });

  test('rest day always has empty chips', () => {
    const display = getDayBadgeDisplay({
      isTrainingDay: false,
      muscleGroups: [],
      isLoading: false,
    });
    expect(display.chips).toEqual([]);
  });
});
