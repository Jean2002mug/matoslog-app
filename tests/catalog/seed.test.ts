import { afterEach, describe, expect, it } from '@jest/globals';

import { migrate } from '@/data/migrations';
import { seedCatalog } from '@/data/seed';
import { SEED_EQUIPMENT, SEED_EXERCISES } from '@/data/seed-data';

import { createTestDb, type TestDb } from '../helpers/node-sqlite-db';

let db: TestDb;
afterEach(() => db.close());

const count = (testDb: TestDb, table: string) =>
  (testDb.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

async function freshDb() {
  db = createTestDb();
  db.raw.exec('PRAGMA foreign_keys = ON');
  await migrate(db);
  return db;
}

describe('seedCatalog', () => {
  it('inserts the 2 equipment and 4 exercises', async () => {
    await freshDb();
    await seedCatalog(db);

    expect(count(db, 'equipment')).toBe(SEED_EQUIPMENT.length);
    expect(count(db, 'exercise')).toBe(SEED_EXERCISES.length);
  });

  it('is repeatable: running it again creates no duplicates', async () => {
    await freshDb();
    await seedCatalog(db);
    await seedCatalog(db);
    await seedCatalog(db);

    expect(count(db, 'equipment')).toBe(2);
    expect(count(db, 'exercise')).toBe(4);
  });

  it('satisfies the foreign keys (every exercise points at real equipment)', async () => {
    await freshDb();
    await seedCatalog(db);

    expect(db.raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
