/// <reference types="node" />
// ^ TypeScript 6 no longer loads @types packages automatically; this file needs Node's types for `node:sqlite`.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db } from '@/data/db';
import { initializeDatabase } from '@/data/database';

/**
 * A real, in-memory SQLite database for tests, using Node's built-in `node:sqlite`.
 * It mimics the few expo-sqlite methods the data layer uses (see src/data/db.ts),
 * so tests run the app's actual SQL — constraints, indexes and triggers included —
 * without a phone. Test-only: never import this from src/.
 */
export interface TestDb extends Db {
  /** Direct access for tests that need to poke the database behind the app's back. */
  raw: DatabaseSync;
  close(): void;
}

/** expo-sqlite accepts params as one array or as separate arguments; normalise both. */
function toParams(params: unknown[]): SQLInputValue[] {
  const list = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return list as SQLInputValue[];
}

export function createTestDb(): TestDb {
  const raw = new DatabaseSync(':memory:');

  const db = {
    raw,
    close: () => raw.close(),

    execAsync: async (sql: string) => {
      raw.exec(sql);
    },

    runAsync: async (sql: string, ...params: unknown[]) => {
      const result = raw.prepare(sql).run(...toParams(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },

    getAllAsync: async (sql: string, ...params: unknown[]) =>
      raw.prepare(sql).all(...toParams(params)),

    getFirstAsync: async (sql: string, ...params: unknown[]) =>
      raw.prepare(sql).get(...toParams(params)) ?? null,

    // Same behaviour as expo-sqlite: commit if the task succeeds, roll back if it throws.
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };

  // The real SQLiteDatabase methods have overloads a plain object can't spell out;
  // this single cast is confined to test code.
  return db as unknown as TestDb;
}

/** A test database that has gone through the same startup as the app (pragmas, migrations, seed). */
export async function createInitializedTestDb(): Promise<TestDb> {
  const db = createTestDb();
  await initializeDatabase(db);
  return db;
}
