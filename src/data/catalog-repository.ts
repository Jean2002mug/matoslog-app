import type { Equipment } from '@/domain/catalog';

/**
 * What catalog data the app can ask for — not how it's stored.
 * The SQLite version lives in sqlite-catalog-repository.ts; tests use a fake.
 */
export interface CatalogRepository {
  /** All equipment, in display order. */
  listEquipment(): Promise<Equipment[]>;
}
