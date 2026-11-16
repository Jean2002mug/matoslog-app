import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SEED_EQUIPMENT, SEED_EXERCISES } from '@/data/seed-data';
import { formatDuration, groupSetsByExercise, plural } from '@/domain/history';
import type { WorkoutSet } from '@/domain/workout';
import { createServices } from '@/services/create-services';
import type { WorkoutService } from '@/services/workout-service';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;
const deadlift = SEED_EXERCISES.find((x) => x.name === 'Deadlift')!;
const press = SEED_EXERCISES.find((x) => x.name === 'Dumbbell Bench Press')!;
const [dumbbells, barbell] = SEED_EQUIPMENT;

describe('formatDuration', () => {
  it.each([
    ['2026-11-12T18:00:00Z', '2026-11-12T18:00:30Z', 'Under 1 min'],
    ['2026-11-12T18:00:00Z', '2026-11-12T18:45:59Z', '45 min'],
    ['2026-11-12T18:00:00Z', '2026-11-12T19:00:00Z', '1 h'],
    ['2026-11-12T18:00:00Z', '2026-11-12T19:05:00Z', '1 h 5 min'],
    ['2026-11-12T23:30:00Z', '2026-11-13T00:10:00Z', '40 min'], // across midnight
  ])('%s -> %s is "%s"', (start, finish, expected) => {
    expect(formatDuration(start, finish)).toBe(expected);
  });
});

describe('plural', () => {
  it('handles one and many', () => {
    expect(plural(1, 'set')).toBe('1 set');
    expect(plural(0, 'set')).toBe('0 sets');
    expect(plural(3, 'exercise')).toBe('3 exercises');
  });
});

describe('groupSetsByExercise', () => {
  const set = (id: string, exerciseId: string, position: number): WorkoutSet => ({
    id,
    workoutId: 'w',
    exerciseId,
    weightCg: 1000,
    reps: 5,
    position,
    createdAt: '',
  });

  it('keeps first-logged exercise order and set order within each exercise', () => {
    const groups = groupSetsByExercise([
      { set: set('a', squat.id, 1), exercise: squat, equipment: barbell },
      { set: set('b', press.id, 2), exercise: press, equipment: dumbbells },
      { set: set('c', squat.id, 3), exercise: squat, equipment: barbell },
    ]);

    expect(groups.map((g) => [g.exercise.name, g.sets.map((s) => s.id)])).toEqual([
      ['Back Squat', ['a', 'c']],
      ['Dumbbell Bench Press', ['b']],
    ]);
  });
});

describe('history queries (real SQLite)', () => {
  let db: TestDb;
  let service: WorkoutService;
  let clock: Date;

  beforeEach(async () => {
    db = await createInitializedTestDb();
    let id = 0;
    clock = new Date('2026-11-10T18:00:00.000Z');
    service = createServices(db, { newId: () => `id-${++id}`, now: () => clock }).workout;
  });
  afterEach(() => db.close());

  async function logWorkout(day: string, sets: [string, string, string][]) {
    clock = new Date(`${day}T18:00:00.000Z`);
    for (const [exerciseId, weightText, repsText] of sets) {
      const result = await service.addSet({ exerciseId, weightText, repsText });
      if (!result.ok) throw new Error(result.error);
    }
    clock = new Date(`${day}T18:50:00.000Z`);
    const finished = await service.finishWorkout();
    if (!finished.ok) throw new Error(finished.error);
  }

  it('is empty before any workout is finished', async () => {
    expect(await service.listCompletedWorkouts()).toEqual({ ok: true, value: [] });
  });

  it('lists only finished workouts, newest first, with counts', async () => {
    await logWorkout('2026-11-10', [[squat.id, '100', '5']]);
    await logWorkout('2026-11-12', [
      [squat.id, '100', '5'],
      [squat.id, '105', '5'],
      [press.id, '22.5', '10'],
    ]);
    // An active workout must NOT show up in history.
    await service.addSet({ exerciseId: deadlift.id, weightText: '140', repsText: '3' });

    const result = await service.listCompletedWorkouts();
    expect(
      result.ok &&
        result.value.map((s) => [s.workout.startedAt.slice(0, 10), s.exerciseCount, s.setCount]),
    ).toEqual([
      ['2026-11-12', 2, 3],
      ['2026-11-10', 1, 1],
    ]);
  });

  it('shows one workout with its sets grouped by exercise, catalog data included', async () => {
    await logWorkout('2026-11-12', [
      [squat.id, '100', '5'],
      [press.id, '22.5', '10'],
      [squat.id, '105', '3'],
    ]);
    const list = await service.listCompletedWorkouts();
    if (!list.ok) throw new Error(list.error);

    const result = await service.getCompletedWorkout(list.value[0].workout.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.workout.finishedAt).toBe('2026-11-12T18:50:00.000Z');
    expect(
      result.value.groups.map((g) => [
        g.exercise.name,
        g.equipment.weightConvention,
        g.sets.map((s) => [s.weightCg, s.reps]),
      ]),
    ).toEqual([
      ['Back Squat', 'barbell_total', [[10000, 5], [10500, 3]]],
      ['Dumbbell Bench Press', 'per_dumbbell', [[2250, 10]]],
    ]);
  });

  it('does not show an active or unknown workout as history', async () => {
    await service.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    const active = await service.getActiveWorkout();
    const activeId = active.ok && active.value ? active.value.workout.id : '';

    expect(await service.getCompletedWorkout(activeId)).toEqual({
      ok: false,
      error: 'Workout not found.',
    });
    expect(await service.getCompletedWorkout('nope')).toEqual({
      ok: false,
      error: 'Workout not found.',
    });
  });
});
