import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SEED_EXERCISES } from '@/data/seed-data';
import { SqliteWorkoutRepository } from '@/data/sqlite-workout-repository';
import { WorkoutError } from '@/domain/workout';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;
const row = SEED_EXERCISES.find((x) => x.name === 'Dumbbell Row')!;

let db: TestDb;
let repo: SqliteWorkoutRepository;
let nextId: number;

beforeEach(async () => {
  db = await createInitializedTestDb();
  nextId = 0;
  repo = new SqliteWorkoutRepository(db, {
    newId: () => `id-${++nextId}`,
    now: () => new Date('2026-11-12T18:30:00.000Z'),
  });
});
afterEach(() => db.close());

const count = (table: string) =>
  (db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

const expectWorkoutError = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toEqual(expect.objectContaining({ name: 'WorkoutError', code }));

describe('starting and logging', () => {
  it('has no active workout at first', async () => {
    expect(await repo.getActiveWorkout()).toBeNull();
  });

  it('the first set starts a workout; later sets join it in order', async () => {
    await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.addSet({ exerciseId: row.id, weightCg: 2250, reps: 10 });

    const active = await repo.getActiveWorkout();
    expect(active?.workout).toEqual({
      id: 'id-1',
      status: 'active',
      startedAt: '2026-11-12T18:30:00.000Z',
      finishedAt: null,
    });
    expect(active?.sets.map((s) => [s.exerciseId, s.weightCg, s.reps, s.position])).toEqual([
      [squat.id, 10000, 5, 1],
      [row.id, 2250, 10, 2],
    ]);
    expect(count('workout')).toBe(1);
  });

  it('rolls back completely on failure: a bad exercise leaves no workout behind', async () => {
    await expect(
      repo.addSet({ exerciseId: 'no-such-exercise', weightCg: 1000, reps: 5 }),
    ).rejects.toThrow(/FOREIGN KEY/);

    expect(count('workout')).toBe(0);
    expect(count('workout_set')).toBe(0);
  });
});

describe('one active workout at most', () => {
  it('the database itself rejects a second active workout', async () => {
    await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });

    expect(() =>
      db.raw.exec(`INSERT INTO workout VALUES ('rogue', 'active', '2026-11-12T19:00:00Z', NULL)`),
    ).toThrow(/UNIQUE constraint failed/);
  });
});

describe('deleting sets', () => {
  it('deletes a set from the active workout', async () => {
    const set = await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.deleteSet(set.id);

    expect((await repo.getActiveWorkout())?.sets).toEqual([]);
  });

  it('reports an unknown set', async () => {
    await expectWorkoutError(repo.deleteSet('nope'), 'set_not_found');
  });
});

describe('finishing', () => {
  it('completes the workout and records the finish time', async () => {
    await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.finishActiveWorkout();

    expect(await repo.getActiveWorkout()).toBeNull();
    expect(db.raw.prepare('SELECT status, finished_at FROM workout').get()).toEqual({
      status: 'completed',
      finished_at: '2026-11-12T18:30:00.000Z',
    });
  });

  it('the next set after finishing starts a brand-new workout', async () => {
    await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.finishActiveWorkout();
    await repo.addSet({ exerciseId: squat.id, weightCg: 10500, reps: 5 });

    expect(count('workout')).toBe(2);
    expect((await repo.getActiveWorkout())?.sets).toHaveLength(1);
  });

  it('refuses to finish an empty workout', async () => {
    const set = await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.deleteSet(set.id);

    await expectWorkoutError(repo.finishActiveWorkout(), 'empty_workout');
  });

  it('refuses to finish when nothing is active', async () => {
    await expectWorkoutError(repo.finishActiveWorkout(), 'no_active_workout');
  });
});

describe('completed workouts are immutable', () => {
  let setId: string;

  beforeEach(async () => {
    setId = (await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 })).id;
    await repo.finishActiveWorkout();
  });

  it('the app cannot delete a set from a completed workout', async () => {
    await expectWorkoutError(repo.deleteSet(setId), 'set_not_found');
  });

  it.each([
    ['add a set', `INSERT INTO workout_set VALUES ('x', 'id-1', '${squat.id}', 100, 1, 99, 'now')`],
    ['change a set', `UPDATE workout_set SET reps = 99`],
    ['delete a set', `DELETE FROM workout_set`],
    ['reopen the workout', `UPDATE workout SET status = 'active', finished_at = NULL`],
    ['delete the workout', `DELETE FROM workout`],
  ])('the database blocks raw SQL that tries to %s', (_label, sql) => {
    expect(() => db.raw.exec(sql)).toThrow(/completed workouts are immutable/);
  });
});

describe('discarding', () => {
  it('deletes the active workout and all its sets', async () => {
    await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.addSet({ exerciseId: row.id, weightCg: 2250, reps: 10 });
    await repo.discardActiveWorkout();

    expect(await repo.getActiveWorkout()).toBeNull();
    expect(count('workout')).toBe(0);
    expect(count('workout_set')).toBe(0);
  });

  it('never touches completed workouts', async () => {
    await repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5 });
    await repo.finishActiveWorkout();

    await expectWorkoutError(repo.discardActiveWorkout(), 'no_active_workout');
    expect(count('workout')).toBe(1);
  });
});

it('WorkoutError carries a code', () => {
  expect(new WorkoutError('empty_workout').code).toBe('empty_workout');
});
