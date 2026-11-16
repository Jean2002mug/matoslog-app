import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SEED_EXERCISES } from '@/data/seed-data';
import { SqliteWorkoutRepository } from '@/data/sqlite-workout-repository';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;
const T0 = Date.parse('2026-11-16T10:00:00.000Z');

let db: TestDb;
let repo: SqliteWorkoutRepository;
let nowMs: number;
let nextId: number;

beforeEach(async () => {
  db = await createInitializedTestDb();
  nowMs = T0;
  nextId = 0;
  repo = new SqliteWorkoutRepository(db, {
    newId: () => `id-${++nextId}`,
    now: () => new Date(nowMs),
  });
});
afterEach(() => db.close());

const later = (seconds: number) => {
  nowMs += seconds * 1000;
};
const row = () => db.raw.prepare('SELECT * FROM workout').get() as Record<string, unknown>;
const addSet = () => repo.addSet({ exerciseId: squat.id, weightCg: 10000, reps: 5, restMs: 90_000 });
const expectCode = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toEqual(expect.objectContaining({ name: 'WorkoutError', code }));

describe('timer state is saved with the workout', () => {
  it('a set starts the rest; pause/resume of the workout is stored and pauses the rest', async () => {
    await addSet();
    expect(row()).toMatchObject({ rest_duration_ms: 90_000, rest_ends_at: '2026-11-16T10:01:30.000Z' });

    later(30);
    await repo.pauseWorkout();
    expect(row()).toMatchObject({
      paused_at: '2026-11-16T10:00:30.000Z',
      rest_ends_at: null,
      rest_remaining_ms: 60_000,
    });

    later(120);
    await repo.resumeWorkout();
    expect(row()).toMatchObject({
      paused_at: null,
      paused_ms: 120_000,
      rest_ends_at: '2026-11-16T10:03:30.000Z', // 60 s left, counted from the resume
      rest_remaining_ms: null,
    });
  });

  it('logging a set while paused resumes the clock, in the same transaction', async () => {
    await addSet();
    await repo.pauseWorkout();
    later(40);
    await addSet();
    expect(row()).toMatchObject({ paused_at: null, paused_ms: 40_000 });
  });

  it('rest pause / resume / reset / adjust / cancel', async () => {
    await addSet();
    later(30);
    await repo.pauseRest();
    expect(row()).toMatchObject({ rest_remaining_ms: 60_000, rest_ends_at: null });

    await repo.adjustRest(15_000);
    expect(row()).toMatchObject({ rest_remaining_ms: 75_000 });

    await repo.resetRest();
    expect(row()).toMatchObject({ rest_remaining_ms: 90_000 });

    await repo.resumeRest();
    expect(row()).toMatchObject({ rest_ends_at: '2026-11-16T10:02:00.000Z' });

    await repo.cancelRest();
    expect(row()).toMatchObject({ status: 'active', rest_duration_ms: null, rest_ends_at: null });
  });

  it('rest actions need a rest; timer actions need a workout', async () => {
    await expectCode(repo.pauseWorkout(), 'no_active_workout');
    await addSet();
    await repo.cancelRest();
    await expectCode(repo.resetRest(), 'no_rest');
  });
});

describe('finishing and cancelling', () => {
  it('finishing while paused counts the open pause and clears the rest', async () => {
    await addSet();
    later(60);
    await repo.pauseWorkout();
    later(300);
    await repo.finishActiveWorkout();

    expect(row()).toMatchObject({
      status: 'completed',
      paused_at: null,
      paused_ms: 300_000,
      rest_duration_ms: null,
      rest_ends_at: null,
      rest_remaining_ms: null,
    });
  });

  it('cancelling the workout deletes it with its sets and timers', async () => {
    await addSet();
    await repo.pauseWorkout();
    await repo.discardActiveWorkout();
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM workout').get()).toEqual({ n: 0 });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM workout_set').get()).toEqual({ n: 0 });
  });

  it('a completed workout’s timers can’t be changed, even with raw SQL', async () => {
    await addSet();
    await repo.finishActiveWorkout();
    await expectCode(repo.pauseWorkout(), 'no_active_workout');
    expect(() => db.raw.exec(`UPDATE workout SET paused_ms = 0`)).toThrow(
      /completed workouts are immutable/,
    );
  });
});

describe('last set (form pre-fill)', () => {
  it('returns the most recent set for the exercise across workouts', async () => {
    expect(await repo.getLastSet(squat.id)).toBeNull();
    await addSet();
    later(10);
    await repo.addSet({ exerciseId: squat.id, weightCg: 10250, reps: 3, restMs: 90_000 });
    await repo.finishActiveWorkout();
    expect(await repo.getLastSet(squat.id)).toEqual({ weightCg: 10250, reps: 3 });
  });
});
