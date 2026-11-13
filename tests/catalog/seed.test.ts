import { describe, expect, it, jest } from '@jest/globals';

import { seedCatalog } from '@/data/seed';
import { SEED_EQUIPMENT, SEED_EXERCISES } from '@/data/seed-data';

/** A fake database that records every statement instead of running it. */
function createFakeDb() {
  const calls: { sql: string; params: unknown }[] = [];
  let transactions = 0;
  const db = {
    runAsync: jest.fn(async (sql: string, params: unknown) => {
      calls.push({ sql, params });
      return { changes: 1, lastInsertRowId: 0 };
    }),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
      transactions++;
      await task();
    }),
  };
  return { db, calls, transactionCount: () => transactions };
}

describe('seedCatalog', () => {
  it('inserts every seed row inside one transaction', async () => {
    const { db, calls, transactionCount } = createFakeDb();
    await seedCatalog(db as never);

    expect(transactionCount()).toBe(1);
    expect(calls).toHaveLength(SEED_EQUIPMENT.length + SEED_EXERCISES.length);
  });

  it('is repeatable: uses INSERT OR IGNORE with bound parameters only', async () => {
    const { db, calls } = createFakeDb();
    await seedCatalog(db as never);

    calls.forEach(({ sql, params }) => {
      expect(sql.trim()).toMatch(/^INSERT OR IGNORE INTO/);
      expect(Array.isArray(params)).toBe(true);
      // No seed values are glued into the SQL text itself.
      expect(sql).not.toContain('Dumbbells');
    });
  });

  it('inserts equipment before exercises (foreign key order)', async () => {
    const { db, calls } = createFakeDb();
    await seedCatalog(db as never);

    const firstExercise = calls.findIndex((c) => c.sql.includes('INTO exercise'));
    const lastEquipment = calls.map((c) => c.sql.includes('INTO equipment')).lastIndexOf(true);
    expect(lastEquipment).toBeLessThan(firstExercise);
  });
});
