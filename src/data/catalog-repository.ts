import type { Equipment, Exercise, ExerciseWithEquipment } from '@/domain/catalog';

/**
 * What catalog data the app can ask for — not how it's stored.
 * The SQLite version lives in sqlite-catalog-repository.ts; tests use a fake or Node's SQLite.
 */
export interface CatalogRepository {
  /** All equipment, in display order. */
  listEquipment(): Promise<Equipment[]>;

  /** One piece of equipment, or null if the ID doesn't exist. */
  getEquipment(equipmentId: string): Promise<Equipment | null>;

  /** The exercises done with one piece of equipment, in display order. */
  listExercises(equipmentId: string): Promise<Exercise[]>;

  /** One exercise plus the equipment it uses, or null if the ID doesn't exist. */
  getExerciseWithEquipment(exerciseId: string): Promise<ExerciseWithEquipment | null>;
}
