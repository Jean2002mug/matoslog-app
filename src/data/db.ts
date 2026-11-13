import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The subset of expo-sqlite that the data layer uses. Depending on this smaller
 * type (instead of the whole SQLiteDatabase) lets tests plug in Node's built-in
 * SQLite and run the real SQL — see tests/helpers/node-sqlite-db.ts.
 */
export type Db = Pick<
  SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withTransactionAsync'
>;
