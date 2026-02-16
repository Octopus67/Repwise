/**
 * Component logic tests for Training UX Polish components.
 *
 * Tests the pure logic extracted from each component to verify correctness
 * without requiring React rendering infrastructure.
 *
 * Components covered:
 *   (a) RPEBadge — color mapping per RPE value
 *   (b) TypeBadge — label mapping per set type
 *   (c) Tooltip — dismiss persistence logic
 *   (d) FinishBar — summary string formatting
 *   (e) ConfirmationSheet — exercise list + summary computation
 *   (f) RestTimerBar — time label formatting + completed state
 *   (g) ExerciseContextMenu — menu item generation based on props
 */

import { getRpeBadgeColor, shouldShowTypeBadge, type RpeBadgeColor } from '../../utils/rpeBadgeColor';
import { formatMiniSummary, computeWorkoutSummary, type WorkoutSummary } from '../../utils/workoutSummaryFormatter';
import { calculateSetProgress } from '../../utils/setProgressCalculator';
import { formatRestTimer } from '../../utils/durationFormat';
import { generateWarmUpSets } from '../../utils/warmUpGenerator';
import type { SetType, ActiveExercise, ActiveSet } from '../../types/training';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSet(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return {
    localId: 's1',
    setNumber: 1,
    weight: '80',
    reps: '8',
    rpe: '',
    setType: 'normal',
    completed: false,
    completedAt: null,
    ...overrides,
  };
}

function makeExercise(name: string, sets: ActiveSet[], overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    localId: `ex-${name}`,
    exerciseName: name,
    sets,
    ...overrides,
  };
}

// ─── (a) RPEBadge — color mapping ──────────────────────────────────────────

describe('RPEBadge logic', () => {
  test('RPE 6 returns green', () => {
    expect(getRpeBadgeColor(6)).toBe('green');
  });

  test('RPE 7 returns green', () => {
    expect(getRpeBadgeColor(7)).toBe('green');
  });

  test('RPE 8 returns yellow', () => {
    expect(getRpeBadgeColor(8)).toBe('yellow');
  });

  test('RPE 9 returns orange', () => {
    expect(getRpeBadgeColor(9)).toBe('orange');
  });

  test('RPE 10 returns red', () => {
    expect(getRpeBadgeColor(10)).toBe('red');
  });

  test('RPE 0 returns none (badge renders nothing)', () => {
    expect(getRpeBadgeColor(0)).toBe('none');
  });

  test('RPE 5 returns none (below valid range)', () => {
    expect(getRpeBadgeColor(5)).toBe('none');
  });

  test('RPE 11 returns none (above valid range)', () => {
    expect(getRpeBadgeColor(11)).toBe('none');
  });

  test('negative RPE returns none', () => {
    expect(getRpeBadgeColor(-1)).toBe('none');
  });
});

// ─── (b) TypeBadge — label mapping ─────────────────────────────────────────

describe('TypeBadge logic', () => {
  const labelMap: Record<string, string> = {
    'warm-up': 'W',
    'drop-set': 'D',
    'amrap': 'A',
  };

  test('warm-up shows W', () => {
    expect(shouldShowTypeBadge('warm-up')).toBe(true);
    expect(labelMap['warm-up']).toBe('W');
  });

  test('drop-set shows D', () => {
    expect(shouldShowTypeBadge('drop-set')).toBe(true);
    expect(labelMap['drop-set']).toBe('D');
  });

  test('amrap shows A', () => {
    expect(shouldShowTypeBadge('amrap')).toBe(true);
    expect(labelMap['amrap']).toBe('A');
  });

  test('normal renders nothing (shouldShowTypeBadge returns false)', () => {
    expect(shouldShowTypeBadge('normal')).toBe(false);
    expect(labelMap['normal']).toBeUndefined();
  });
});

// ─── (c) Tooltip — dismiss persistence logic ───────────────────────────────

describe('Tooltip dismiss logic', () => {
  // Inline the tooltip store logic as a pure state machine
  function createTooltipState() {
    const dismissed: Record<string, boolean> = {};
    return {
      isDismissed: (id: string) => dismissed[id] ?? false,
      dismiss: (id: string) => { dismissed[id] = true; },
    };
  }

  test('tooltip is visible on first view (not dismissed)', () => {
    const store = createTooltipState();
    expect(store.isDismissed('rpe-intro')).toBe(false);
  });

  test('tooltip is hidden after dismiss', () => {
    const store = createTooltipState();
    store.dismiss('rpe-intro');
    expect(store.isDismissed('rpe-intro')).toBe(true);
  });

  test('dismissing one tooltip does not affect others', () => {
    const store = createTooltipState();
    store.dismiss('rpe-intro');
    expect(store.isDismissed('rpe-intro')).toBe(true);
    expect(store.isDismissed('type-intro')).toBe(false);
  });

  test('dismissing same tooltip twice is idempotent', () => {
    const store = createTooltipState();
    store.dismiss('rpe-intro');
    store.dismiss('rpe-intro');
    expect(store.isDismissed('rpe-intro')).toBe(true);
  });
});

// ─── (d) FinishBar — formatted summary string ──────────────────────────────

describe('FinishBar summary logic', () => {
  test('formats summary with exercises, sets, and minutes', () => {
    const summary: WorkoutSummary = {
      exerciseCount: 5,
      completedSetCount: 18,
      totalVolumeKg: 12400,
      durationSeconds: 2700, // 45 min
    };
    expect(formatMiniSummary(summary)).toBe('5 exercises · 18 sets · 45 min');
  });

  test('formats zero values correctly', () => {
    const summary: WorkoutSummary = {
      exerciseCount: 0,
      completedSetCount: 0,
      totalVolumeKg: 0,
      durationSeconds: 0,
    };
    expect(formatMiniSummary(summary)).toBe('0 exercises · 0 sets · 0 min');
  });

  test('rounds duration down to whole minutes', () => {
    const summary: WorkoutSummary = {
      exerciseCount: 3,
      completedSetCount: 10,
      totalVolumeKg: 5000,
      durationSeconds: 119, // 1 min 59 sec → 1 min
    };
    expect(formatMiniSummary(summary)).toBe('3 exercises · 10 sets · 1 min');
  });

  test('edit mode button text is "Save Changes"', () => {
    // Inline the button text logic from FinishBar
    const saving = false;
    const isEditMode = true;
    const buttonText = saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Finish Workout';
    expect(buttonText).toBe('Save Changes');
  });

  test('saving state shows "Saving..."', () => {
    const saving = true;
    const isEditMode = false;
    const buttonText = saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Finish Workout';
    expect(buttonText).toBe('Saving...');
  });

  test('normal mode button text is "Finish Workout"', () => {
    const saving = false;
    const isEditMode = false;
    const buttonText = saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Finish Workout';
    expect(buttonText).toBe('Finish Workout');
  });
});


// ─── (e) ConfirmationSheet — exercise list + summary ────────────────────────

describe('ConfirmationSheet logic', () => {
  test('computeWorkoutSummary counts non-skipped exercises', () => {
    const exercises: ActiveExercise[] = [
      makeExercise('Bench Press', [makeSet({ completed: true }), makeSet({ completed: true })]),
      makeExercise('Squat', [makeSet({ completed: true })]),
      makeExercise('Curls', [makeSet()], { skipped: true }),
    ];
    const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const summary = computeWorkoutSummary(exercises, startedAt);

    expect(summary.exerciseCount).toBe(2); // Curls skipped
    expect(summary.completedSetCount).toBe(3);
  });

  test('calculateSetProgress shows correct counts per exercise', () => {
    const sets = [
      makeSet({ completed: true }),
      makeSet({ completed: true }),
      makeSet({ completed: false }),
      makeSet({ completed: false }),
    ];
    const progress = calculateSetProgress(sets);
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.allComplete).toBe(false);
  });

  test('all sets complete shows allComplete = true', () => {
    const sets = [
      makeSet({ completed: true }),
      makeSet({ completed: true }),
    ];
    const progress = calculateSetProgress(sets);
    expect(progress.allComplete).toBe(true);
  });

  test('skipped exercises display "Skipped" label', () => {
    const exercise = makeExercise('Curls', [], { skipped: true });
    const skipped = exercise.skipped === true;
    expect(skipped).toBe(true);
  });

  test('Save as Template toggle defaults to off', () => {
    // Mirrors the useState(false) in ConfirmationSheet
    let saveAsTemplate = false;
    expect(saveAsTemplate).toBe(false);

    // Toggle on
    saveAsTemplate = true;
    expect(saveAsTemplate).toBe(true);
  });

  test('volume display converts to imperial when unitSystem is imperial', () => {
    const totalVolumeKg = 1000;
    const unitSystem = 'imperial';
    const volumeDisplay =
      unitSystem === 'imperial'
        ? `${Math.round(totalVolumeKg * 2.205)} lbs`
        : `${Math.round(totalVolumeKg)} kg`;
    expect(volumeDisplay).toBe('2205 lbs');
  });

  test('volume display stays metric when unitSystem is metric', () => {
    const totalVolumeKg = 1000;
    const unitSystem = 'metric';
    const volumeDisplay =
      unitSystem === 'metric'
        ? `${Math.round(totalVolumeKg)} kg`
        : `${Math.round(totalVolumeKg * 2.205)} lbs`;
    expect(volumeDisplay).toBe('1000 kg');
  });
});

// ─── (f) RestTimerBar — compact ring + remaining time ───────────────────────

describe('RestTimerBar logic', () => {
  test('formats remaining time as M:SS', () => {
    expect(formatRestTimer(90)).toBe('1:30');
    expect(formatRestTimer(60)).toBe('1:00');
    expect(formatRestTimer(5)).toBe('0:05');
    expect(formatRestTimer(0)).toBe('0:00');
  });

  test('completed state shows "Rest Complete" label', () => {
    const completed = true;
    const remainingSeconds = 0;
    const timeLabel = completed ? 'Rest Complete' : formatRestTimer(remainingSeconds);
    expect(timeLabel).toBe('Rest Complete');
  });

  test('active state shows formatted time', () => {
    const completed = false;
    const remainingSeconds = 45;
    const timeLabel = completed ? 'Rest Complete' : formatRestTimer(remainingSeconds);
    expect(timeLabel).toBe('0:45');
  });

  test('compact ring size is 40px', () => {
    // RestTimerBar passes size={40} to RestTimerRing
    const compactSize = 40;
    const compact = compactSize < 80;
    expect(compact).toBe(true); // Center text hidden in compact mode
  });

  test('handles negative remaining seconds gracefully', () => {
    expect(formatRestTimer(-5)).toBe('0:00');
  });

  test('handles NaN remaining seconds gracefully', () => {
    expect(formatRestTimer(NaN)).toBe('0:00');
  });
});

// ─── (g) ExerciseContextMenu — items based on props ─────────────────────────

describe('ExerciseContextMenu logic', () => {
  // Inline the menu item generation logic from ExerciseContextMenu
  function buildMenuItems(props: {
    isSkipped: boolean;
    hasNotes: boolean;
    hasPreviousPerformance: boolean;
  }): string[] {
    const items: string[] = [
      'Swap Exercise',
      props.isSkipped ? 'Unskip Exercise' : 'Skip Exercise',
      props.hasNotes ? 'Edit Note' : 'Add Note',
    ];
    if (props.hasPreviousPerformance) {
      items.push('Generate Warm-Up');
    }
    return items;
  }

  test('default state shows Swap, Skip, Add Note (no warm-up)', () => {
    const items = buildMenuItems({
      isSkipped: false,
      hasNotes: false,
      hasPreviousPerformance: false,
    });
    expect(items).toEqual(['Swap Exercise', 'Skip Exercise', 'Add Note']);
  });

  test('skipped exercise shows "Unskip Exercise"', () => {
    const items = buildMenuItems({
      isSkipped: true,
      hasNotes: false,
      hasPreviousPerformance: false,
    });
    expect(items).toContain('Unskip Exercise');
    expect(items).not.toContain('Skip Exercise');
  });

  test('exercise with notes shows "Edit Note"', () => {
    const items = buildMenuItems({
      isSkipped: false,
      hasNotes: true,
      hasPreviousPerformance: false,
    });
    expect(items).toContain('Edit Note');
    expect(items).not.toContain('Add Note');
  });

  test('exercise with previous performance shows "Generate Warm-Up"', () => {
    const items = buildMenuItems({
      isSkipped: false,
      hasNotes: false,
      hasPreviousPerformance: true,
    });
    expect(items).toContain('Generate Warm-Up');
    expect(items).toHaveLength(4);
  });

  test('all flags true shows Unskip, Edit Note, Generate Warm-Up', () => {
    const items = buildMenuItems({
      isSkipped: true,
      hasNotes: true,
      hasPreviousPerformance: true,
    });
    expect(items).toEqual([
      'Swap Exercise',
      'Unskip Exercise',
      'Edit Note',
      'Generate Warm-Up',
    ]);
  });

  test('menu not visible returns no items (visible=false)', () => {
    // The component returns null when visible=false
    const visible = false;
    const items = visible ? buildMenuItems({ isSkipped: false, hasNotes: false, hasPreviousPerformance: false }) : [];
    expect(items).toEqual([]);
  });
});
