import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Schema migrations. MIGRATIONS[0] takes the database from version 0 to 1,
 * MIGRATIONS[1] (when added) from 1 to 2, and so on.
 *
 * Rules: only ever APPEND new migrations; never edit or delete an old one,
 * and never drop tables or columns (migrations must not be destructive).
 */
const MIGRATIONS: readonly string[] = [
  // v1: catalog tables
  `
  CREATE TABLE equipment (
    id                TEXT    PRIMARY KEY NOT NULL,
    name              TEXT    NOT NULL UNIQUE,
    weight_convention TEXT    NOT NULL CHECK (weight_convention IN ('per_dumbbell', 'barbell_total')),
    bar_weight_cg     INTEGER CHECK (bar_weight_cg IS NULL OR bar_weight_cg > 0),
    sort_order        INTEGER NOT NULL
  );

  CREATE TABLE exercise (
    id           TEXT    PRIMARY KEY NOT NULL,
    equipment_id TEXT    NOT NULL REFERENCES equipment(id),
    name         TEXT    NOT NULL,
    sort_order   INTEGER NOT NULL,
    UNIQUE (equipment_id, name)
  );

  CREATE INDEX idx_exercise_equipment_id ON exercise(equipment_id);
  `,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

type MigrationDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'execAsync' | 'withTransactionAsync'>;

/**
 * Brings the database schema up to LATEST_SCHEMA_VERSION.
 * The current version is stored in SQLite's built-in `PRAGMA user_version` (starts at 0).
 * Each step runs in its own transaction together with the version bump, so a failed
 * step rolls back completely and is retried on the next launch.
 */
export async function migrate(db: MigrationDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${currentVersion} is newer than this app supports (v${LATEST_SCHEMA_VERSION}).`,
    );
  }

  for (let version = currentVersion; version < LATEST_SCHEMA_VERSION; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      // PRAGMA statements can't take bound parameters; this is an integer we computed, not user input.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
