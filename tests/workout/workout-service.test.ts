import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { WorkoutRepository } from '@/data/workout-repository';
import { SEED_EXERCISES } from '@/data/seed-data';
import { SqliteCatalogRepository } from '@/data/sqlite-catalog-repository';
import { SqliteSettingsRepository } from '@/data/sqlite-settings-repository';
import { createServices } from '@/services/create-services';
import { WorkoutService } from '@/services/workout-service';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;
const press = SEED_EXERCISES.find((x) => x.name === 'Dumbbell Bench Press')!;

let db: TestDb;
let service: WorkoutService;
let ids: number;

beforeEach(async () => {
  db = await createInitializedTestDb();
  ids = 0;
  service = createServices(db, { newId: () => `id-${++ids}`, now: () => new Date() }).workout;
});
afterEach(() => db.close());

describe('addSet validation (before anything is saved)', () => {
  it.each([
    [{ weightText: 'abc', repsText: '5' }, 'Enter a weight in kg, like 22.5.'],
    [{ weightText: '100', repsText: '5.5' }, 'Enter reps as a whole number, like 8.'],
    [{ weightText: '15', repsText: '5' }, 'Total weight must be at least the 20 kg bar.'],
    [{ weightText: '100', repsText: '0' }, 'Reps must be a whole number from 1 to 100.'],
  ])('rejects %j for the barbell', async (input, message) => {
    const result = await service.addSet({ exerciseId: squat.id, ...input });

    expect(result).toEqual({ ok: false, error: message });
    // Nothing was saved, so no workout was started.
    expect(await service.getActiveWorkout()).toEqual({ ok: true, value: null });
  });

  it('applies the per-dumbbell rule to dumbbell exercises', async () => {
    expect(await service.addSet({ exerciseId: press.id, weightText: '0', repsText: '8' })).toEqual({
      ok: false,
      error: 'Enter the weight of one dumbbell (more than 0 kg).',
    });
    // 15 kg is fine for ONE dumbbell, even though it's lighter than a barbell's bar.
    const ok = await service.addSet({ exerciseId: press.id, weightText: '15', repsText: '8' });
    expect(ok.ok && ok.value.weightCg).toBe(1500);
  });

  it('rejects an unknown exercise', async () => {
    expect(await service.addSet({ exerciseId: 'nope', weightText: '20', repsText: '5' })).toEqual({
      ok: false,
      error: 'Exercise not found.',
    });
  });
});

describe('the full workout flow', () => {
  it('logs, deletes, then finishes', async () => {
    const first = await service.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    const second = await service.addSet({ exerciseId: squat.id, weightText: '102,5', repsText: '5' });
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) return;

    expect(await service.deleteSet(second.value.id)).toEqual({ ok: true, value: undefined });
    expect(await service.finishWorkout()).toEqual({ ok: true, value: undefined });
    expect(await service.getActiveWorkout()).toEqual({ ok: true, value: null });
  });

  it('turns expected failures into friendly messages', async () => {
    expect(await service.finishWorkout()).toEqual({
      ok: false,
      error: 'There is no workout in progress.',
    });
    expect(await service.discardWorkout()).toEqual({
      ok: false,
      error: 'There is no workout in progress.',
    });
    expect(await service.deleteSet('nope')).toEqual({
      ok: false,
      error: 'That set can no longer be changed.',
    });
  });

  it('discards the workout', async () => {
    await service.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    expect(await service.discardWorkout()).toEqual({ ok: true, value: undefined });
    expect(await service.getActiveWorkout()).toEqual({ ok: true, value: null });
  });
});

describe('running operations one at a time', () => {
  it('two sets added at the same moment both land, in order, in ONE workout', async () => {
    const [a, b] = await Promise.all([
      service.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' }),
      service.addSet({ exerciseId: squat.id, weightText: '110', repsText: '3' }),
    ]);
    expect(a.ok && b.ok).toBe(true);

    const active = await service.getActiveWorkout();
    expect(active.ok && active.value?.sets.map((s) => [s.weightCg, s.position])).toEqual([
      [10000, 1],
      [11000, 2],
    ]);
  });

  it('hides unexpected storage errors behind a generic message', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // A repository whose every method fails, however many methods the interface has.
    const broken = new Proxy(
      {},
      { get: () => () => Promise.reject(new Error('disk I/O error')) },
    ) as WorkoutRepository;
    const failing = new WorkoutService(
      broken,
      new SqliteCatalogRepository(db),
      new SqliteSettingsRepository(db),
    );

    expect(await failing.finishWorkout()).toEqual({
      ok: false,
      error: 'Something went wrong saving your workout. Please try again.',
    });
  });
});
