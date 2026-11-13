import type { Equipment, Exercise } from '@/domain/catalog';

/**
 * Built-in catalog rows. IDs are hard-coded so they are identical on every device
 * and every launch — that is what makes the seed safely repeatable.
 * Never change an existing ID; workouts will reference them.
 */

export const EQUIPMENT_IDS = {
  dumbbells: '6f1c2a4e-8b3d-4c7a-9e21-3d5f7a9b1c01',
  barbell: '6f1c2a4e-8b3d-4c7a-9e21-3d5f7a9b1c02',
} as const;

export const SEED_EQUIPMENT: readonly Equipment[] = [
  {
    id: EQUIPMENT_IDS.dumbbells,
    name: 'Dumbbells',
    weightConvention: 'per_dumbbell',
    barWeightCg: null,
    sortOrder: 1,
  },
  {
    id: EQUIPMENT_IDS.barbell,
    name: 'Barbell',
    weightConvention: 'barbell_total',
    barWeightCg: 2000, // 20 kg
    sortOrder: 2,
  },
];

export const SEED_EXERCISES: readonly Exercise[] = [
  {
    id: 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a01',
    equipmentId: EQUIPMENT_IDS.dumbbells,
    name: 'Dumbbell Bench Press',
    sortOrder: 1,
  },
  {
    id: 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a02',
    equipmentId: EQUIPMENT_IDS.dumbbells,
    name: 'Dumbbell Row',
    sortOrder: 2,
  },
  {
    id: 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a03',
    equipmentId: EQUIPMENT_IDS.barbell,
    name: 'Back Squat',
    sortOrder: 1,
  },
  {
    id: 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a04',
    equipmentId: EQUIPMENT_IDS.barbell,
    name: 'Deadlift',
    sortOrder: 2,
  },
];
