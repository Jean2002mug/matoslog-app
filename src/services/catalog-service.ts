import type { CatalogRepository } from '@/data/catalog-repository';
import type { Equipment } from '@/domain/catalog';
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
}
