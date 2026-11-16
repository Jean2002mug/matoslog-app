import type { Db } from './db';
import { SEED_EQUIPMENT, SEED_EXERCISES } from './seed-data';

type SeedDb = Pick<Db, 'runAsync' | 'withTransactionAsync'>;

/**
 * Inserts the built-in catalog. `INSERT OR IGNORE` skips any row whose ID already
 * exists, so running this on every launch never creates duplicates.
 * Equipment goes in first because exercises reference it (foreign key).
 */
export async function seedCatalog(db: SeedDb): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const e of SEED_EQUIPMENT) {
      await db.runAsync(
        `INSERT OR IGNORE INTO equipment (id, name, weight_convention, bar_weight_cg, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [e.id, e.name, e.weightConvention, e.barWeightCg, e.sortOrder],
      );
    }

    for (const x of SEED_EXERCISES) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise (id, equipment_id, name, sort_order, recommended_rest_ms)
         VALUES (?, ?, ?, ?, ?)`,
        [x.id, x.equipmentId, x.name, x.sortOrder, x.recommendedRestMs],
      );
    }
  });
}
