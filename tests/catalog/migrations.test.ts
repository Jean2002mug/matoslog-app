import { afterEach, describe, expect, it } from '@jest/globals';

import { LATEST_SCHEMA_VERSION, migrate } from '@/data/migrations';

import { createTestDb, type TestDb } from '../helpers/node-sqlite-db';

let db: TestDb;
afterEach(() => db.close());

const tableNames = (testDb: TestDb) =>
  (
    testDb.raw
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as { name: string }[]
  ).map((row) => row.name);

const userVersion = (testDb: TestDb) =>
  (testDb.raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

describe('migrate', () => {
  it('creates every table on a fresh database and records the latest version', async () => {
    db = createTestDb();
    await migrate(db);

    expect(tableNames(db)).toEqual([
      'app_setting',
      'equipment',
      'exercise',
      'exercise_rest_setting',
      'workout',
      'workout_set',
    ]);
    expect(userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('is safe to run again: an up-to-date database is left alone', async () => {
    db = createTestDb();
    await migrate(db);
    await expect(migrate(db)).resolves.toBeUndefined();
    expect(userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('upgrades a v1 (catalog-only) database without losing data', async () => {
    // Build the database exactly as the catalog-only app left it, then upgrade.
    db = createTestDb();
    await migrate(db, 1);
    db.raw.exec(`INSERT INTO equipment VALUES ('e1', 'Kettlebell', 'per_dumbbell', NULL, 9)`);

    await migrate(db);

    expect(tableNames(db)).toContain('workout');
    expect(db.raw.prepare(`SELECT name FROM equipment WHERE id = 'e1'`).get()).toEqual({
      name: 'Kettlebell',
    });
  });

  it('upgrades a v2 database mid-workout: the workout and sets survive, timers start empty', async () => {
    db = createTestDb();
    db.raw.exec('PRAGMA foreign_keys = ON');
    await migrate(db, 2);
    db.raw.exec(`
      INSERT INTO equipment VALUES ('eq', 'Barbell', 'barbell_total', 2000, 1);
      INSERT INTO exercise VALUES ('a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a03', 'eq', 'Back Squat', 1);
      INSERT INTO workout VALUES ('w1', 'active', '2026-11-16T10:00:00.000Z', NULL);
      INSERT INTO workout_set VALUES ('s1', 'w1', 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a03', 10000, 5, 1, 'now');
    `);

    await migrate(db);

    expect(db.raw.prepare('SELECT status, paused_at, paused_ms, rest_ends_at FROM workout').get()).toEqual({
      status: 'active',
      paused_at: null,
      paused_ms: 0,
      rest_ends_at: null,
    });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM workout_set').get()).toEqual({ n: 1 });
    // The existing Back Squat row got its recommended rest from the migration.
    expect(db.raw.prepare('SELECT recommended_rest_ms FROM exercise').get()).toEqual({
      recommended_rest_ms: 150000,
    });
  });

  it('refuses a database created by a newer app version', async () => {
    db = createTestDb();
    db.raw.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer than this app supports/);
  });
});
