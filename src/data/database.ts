import type { Db } from './db';
import { migrate } from './migrations';
import { seedCatalog } from './seed';

export const DATABASE_NAME = 'matoslog.db';

/**
 * Runs once when the app opens the database (passed to <SQLiteProvider onInit>).
 * The screens don't render until this finishes.
 */
export async function initializeDatabase(db: Db): Promise<void> {
  // Foreign keys are OFF by default in SQLite and must be turned on for every connection.
  // It has no effect inside a transaction, so it runs first, on its own.
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
  await seedCatalog(db);
}
