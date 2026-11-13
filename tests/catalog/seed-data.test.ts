import { describe, expect, it } from '@jest/globals';

import { isWeightConvention } from '@/domain/catalog';
import { EQUIPMENT_IDS, SEED_EQUIPMENT, SEED_EXERCISES } from '@/data/seed-data';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('catalog seed data', () => {
  it('has dumbbells and barbell, with two exercises each', () => {
    expect(SEED_EQUIPMENT.map((e) => e.name)).toEqual(['Dumbbells', 'Barbell']);

    const namesFor = (equipmentId: string) =>
      SEED_EXERCISES.filter((x) => x.equipmentId === equipmentId).map((x) => x.name);
    expect(namesFor(EQUIPMENT_IDS.dumbbells)).toEqual(['Dumbbell Bench Press', 'Dumbbell Row']);
    expect(namesFor(EQUIPMENT_IDS.barbell)).toEqual(['Back Squat', 'Deadlift']);
  });

  it('uses unique, well-formed UUIDs for every row', () => {
    const ids = [...SEED_EQUIPMENT, ...SEED_EXERCISES].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(UUID));
  });

  it('links every exercise to equipment that exists', () => {
    const equipmentIds = new Set(SEED_EQUIPMENT.map((e) => e.id));
    SEED_EXERCISES.forEach((x) => expect(equipmentIds).toContain(x.equipmentId));
  });

  it('stores weights as integer centi-kg with valid conventions', () => {
    SEED_EQUIPMENT.forEach((e) => {
      expect(isWeightConvention(e.weightConvention)).toBe(true);
      if (e.barWeightCg !== null) expect(Number.isInteger(e.barWeightCg)).toBe(true);
    });
    const barbell = SEED_EQUIPMENT.find((e) => e.id === EQUIPMENT_IDS.barbell);
    expect(barbell?.weightConvention).toBe('barbell_total');
    expect(barbell?.barWeightCg).toBe(2000);
  });
});
