import { describe, expect, it, jest } from '@jest/globals';

import { LATEST_SCHEMA_VERSION, migrate } from '@/data/migrations';

function createFakeDb(startVersion: number) {
  const executed: string[] = [];
  const db = {
    getFirstAsync: jest.fn(async () => ({ user_version: startVersion })),
    execAsync: jest.fn(async (sql: string) => {
      executed.push(sql);
    }),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
  return { db, executed };
}

describe('migrate', () => {
  it('creates the catalog tables on a fresh database and records the version', async () => {
    const { db, executed } = createFakeDb(0);
    await migrate(db as never);

    const allSql = executed.join('\n');
    expect(allSql).toContain('CREATE TABLE equipment');
    expect(allSql).toContain('CREATE TABLE exercise');
    expect(executed.at(-1)).toBe(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(LATEST_SCHEMA_VERSION);
  });

  it('does nothing when the database is already up to date', async () => {
    const { db, executed } = createFakeDb(LATEST_SCHEMA_VERSION);
    await migrate(db as never);

    expect(executed).toHaveLength(0);
  });

  it('refuses a database created by a newer app version', async () => {
    const { db } = createFakeDb(LATEST_SCHEMA_VERSION + 1);
    await expect(migrate(db as never)).rejects.toThrow(/newer than this app supports/);
  });
});
