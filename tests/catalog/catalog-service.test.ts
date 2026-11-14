import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type { CatalogRepository } from '@/data/catalog-repository';
import { EQUIPMENT_IDS, SEED_EQUIPMENT, SEED_EXERCISES } from '@/data/seed-data';
import { SqliteCatalogRepository } from '@/data/sqlite-catalog-repository';
import { describeWeightConvention, type Equipment } from '@/domain/catalog';
import { CatalogService } from '@/services/catalog-service';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

let db: TestDb | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

async function serviceWithRealDb() {
  db = await createInitializedTestDb();
  return new CatalogService(new SqliteCatalogRepository(db));
}

/** A repository whose every method fails, to test error handling. */
const brokenRepository: CatalogRepository = {
  listEquipment: () => Promise.reject(new Error('disk full')),
  getEquipment: () => Promise.reject(new Error('disk full')),
  listExercises: () => Promise.reject(new Error('disk full')),
  getExerciseWithEquipment: () => Promise.reject(new Error('disk full')),
};

describe('CatalogService (real SQLite)', () => {
  it('lists the seeded equipment in display order', async () => {
    const service = await serviceWithRealDb();
    expect(await service.listEquipment()).toEqual({ ok: true, value: SEED_EQUIPMENT });
  });

  it('gets one piece of equipment with its exercises', async () => {
    const service = await serviceWithRealDb();
    const result = await service.getEquipmentWithExercises(EQUIPMENT_IDS.barbell);

    expect(result.ok && result.value.equipment.name).toBe('Barbell');
    expect(result.ok && result.value.exercises.map((x) => x.name)).toEqual(['Back Squat', 'Deadlift']);
  });

  it('gets one exercise together with its equipment', async () => {
    const service = await serviceWithRealDb();
    const deadlift = SEED_EXERCISES.find((x) => x.name === 'Deadlift')!;
    const result = await service.getExerciseWithEquipment(deadlift.id);

    expect(result).toEqual({
      ok: true,
      value: { exercise: deadlift, equipment: SEED_EQUIPMENT[1] },
    });
  });

  it('reports unknown IDs as "not found"', async () => {
    const service = await serviceWithRealDb();
    expect(await service.getEquipmentWithExercises('nope')).toEqual({
      ok: false,
      error: 'Equipment not found.',
    });
    expect(await service.getExerciseWithEquipment('nope')).toEqual({
      ok: false,
      error: 'Exercise not found.',
    });
  });

  it('AT-11: a new equipment row with an existing convention just works', async () => {
    const service = await serviceWithRealDb();
    db!.raw.exec(
      `INSERT INTO equipment VALUES ('ez', 'EZ Bar', 'barbell_total', 1025, 3);
       INSERT INTO exercise VALUES ('curl', 'ez', 'EZ Bar Curl', 1);`,
    );

    const list = await service.listEquipment();
    expect(list.ok && list.value.map((e) => e.name)).toEqual(['Dumbbells', 'Barbell', 'EZ Bar']);

    const curl = await service.getExerciseWithEquipment('curl');
    expect(curl.ok && describeWeightConvention(curl.value.equipment)).toBe(
      'Total weight, including 10.25 kg bar',
    );
  });
});

describe('CatalogService errors', () => {
  it('returns error results instead of throwing when the repository fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = new CatalogService(brokenRepository);

    expect(await service.listEquipment()).toEqual({ ok: false, error: 'Could not load equipment.' });
    expect(await service.getEquipmentWithExercises('x')).toEqual({
      ok: false,
      error: 'Could not load exercises.',
    });
    expect(await service.getExerciseWithEquipment('x')).toEqual({
      ok: false,
      error: 'Could not load exercise.',
    });
  });
});

describe('describeWeightConvention', () => {
  it('describes the seeded equipment', () => {
    const [dumbbells, barbell] = SEED_EQUIPMENT;
    expect(describeWeightConvention(dumbbells)).toBe('Weight per dumbbell');
    expect(describeWeightConvention(barbell)).toBe('Total weight, including 20 kg bar');
  });

  it('AT-11: describes new equipment with an existing convention', () => {
    const ezBar: Equipment = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'EZ Bar',
      weightConvention: 'barbell_total',
      barWeightCg: 1025,
      sortOrder: 3,
    };
    expect(describeWeightConvention(ezBar)).toBe('Total weight, including 10.25 kg bar');
  });
});
