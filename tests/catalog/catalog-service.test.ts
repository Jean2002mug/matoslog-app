import { describe, expect, it, jest } from '@jest/globals';

import type { CatalogRepository } from '@/data/catalog-repository';
import { SEED_EQUIPMENT } from '@/data/seed-data';
import { describeWeightConvention, type Equipment } from '@/domain/catalog';
import { CatalogService } from '@/services/catalog-service';

/** An in-memory stand-in for the SQLite repository. */
class FakeCatalogRepository implements CatalogRepository {
  constructor(
    private readonly equipment: Equipment[],
    private readonly failWith?: Error,
  ) {}

  async listEquipment(): Promise<Equipment[]> {
    if (this.failWith) throw this.failWith;
    return this.equipment;
  }
}

describe('CatalogService.listEquipment', () => {
  it('returns the equipment from the repository', async () => {
    const service = new CatalogService(new FakeCatalogRepository([...SEED_EQUIPMENT]));
    const result = await service.listEquipment();

    expect(result).toEqual({ ok: true, value: SEED_EQUIPMENT });
  });

  it('returns an error result instead of throwing when the repository fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = new CatalogService(new FakeCatalogRepository([], new Error('disk full')));
    const result = await service.listEquipment();

    expect(result).toEqual({ ok: false, error: 'Could not load equipment.' });
  });
});

describe('describeWeightConvention', () => {
  it('describes the seeded equipment', () => {
    const [dumbbells, barbell] = SEED_EQUIPMENT;
    expect(describeWeightConvention(dumbbells)).toBe('Weight per dumbbell');
    expect(describeWeightConvention(barbell)).toBe('Total weight, including 20 kg bar');
  });

  it('AT-11: new equipment with an existing convention needs no code changes', () => {
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
