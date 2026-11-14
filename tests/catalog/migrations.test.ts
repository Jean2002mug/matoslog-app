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

    expect(tableNames(db)).toEqual(['equipment', 'exercise', 'workout', 'workout_set']);
    expect(userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('is safe to run again: an up-to-date database is left alone', async () => {
    db = createTestDb();
    await migrate(db);
    await expect(migrate(db)).resolves.toBeUndefined();
    expect(userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('upgrades a v1 (catalog-only) database without losing data', async () => {
    // Simulate an older install: migrate fully, then remove v2's tables and roll the
    // version back to 1, so the database looks exactly like one made by the catalog-only app.
    db = createTestDb();
    await migrate(db);
    db.raw.exec('DROP TABLE workout_set; DROP TABLE workout; PRAGMA user_version = 1');
    db.raw.exec(`INSERT INTO equipment VALUES ('e1', 'Kettlebell', 'per_dumbbell', NULL, 9)`);

    await migrate(db);

    expect(tableNames(db)).toContain('workout');
    expect(db.raw.prepare(`SELECT name FROM equipment WHERE id = 'e1'`).get()).toEqual({
      name: 'Kettlebell',
    });
  });

  it('refuses a database created by a newer app version', async () => {
    db = createTestDb();
    db.raw.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer than this app supports/);
  });
});
