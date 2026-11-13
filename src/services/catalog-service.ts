import type { CatalogRepository } from '@/data/catalog-repository';
import type { Equipment, EquipmentWithExercises, ExerciseWithEquipment } from '@/domain/catalog';
import { err, ok, type Result } from '@/domain/result';

/**
 * The layer screens talk to. It hides the repository and turns failures into
 * a typed Result instead of a thrown error.
 */
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async listEquipment(): Promise<Result<Equipment[]>> {
    try {
      return ok(await this.repository.listEquipment());
    } catch (error) {
      console.error('CatalogService.listEquipment failed', error);
      return err('Could not load equipment.');
    }
  }

  async getEquipmentWithExercises(equipmentId: string): Promise<Result<EquipmentWithExercises>> {
    try {
      const equipment = await this.repository.getEquipment(equipmentId);
      if (!equipment) return err('Equipment not found.');
      const exercises = await this.repository.listExercises(equipmentId);
      return ok({ equipment, exercises });
    } catch (error) {
      console.error('CatalogService.getEquipmentWithExercises failed', error);
      return err('Could not load exercises.');
    }
  }

  async getExerciseWithEquipment(exerciseId: string): Promise<Result<ExerciseWithEquipment>> {
    try {
      const found = await this.repository.getExerciseWithEquipment(exerciseId);
      return found ? ok(found) : err('Exercise not found.');
    } catch (error) {
      console.error('CatalogService.getExerciseWithEquipment failed', error);
      return err('Could not load exercise.');
    }
  }
}
