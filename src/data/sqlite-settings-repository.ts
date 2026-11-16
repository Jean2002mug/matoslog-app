import { FLAG_DEFAULTS, type FlagSetting, type Flags } from '@/domain/settings';

import type { Db } from './db';
import type { SettingsRepository } from './settings-repository';

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Db) {}

  async getCustomRest(exerciseId: string): Promise<number | null> {
    const row = await this.db.getFirstAsync<{ rest_ms: number }>(
      `SELECT rest_ms FROM exercise_rest_setting WHERE exercise_id = ?`,
      [exerciseId],
    );
    return row?.rest_ms ?? null;
  }

  async setCustomRest(exerciseId: string, restMs: number | null): Promise<void> {
    if (restMs === null) {
      await this.db.runAsync(`DELETE FROM exercise_rest_setting WHERE exercise_id = ?`, [
        exerciseId,
      ]);
      return;
    }
    // "Upsert": insert, or update the existing row for this exercise.
    await this.db.runAsync(
      `INSERT INTO exercise_rest_setting (exercise_id, rest_ms) VALUES (?, ?)
       ON CONFLICT (exercise_id) DO UPDATE SET rest_ms = excluded.rest_ms`,
      [exerciseId, restMs],
    );
  }

  async getFlags(): Promise<Flags> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM app_setting`,
    );
    const flags: Flags = { ...FLAG_DEFAULTS };
    for (const { key, value } of rows) {
      if (key in flags) flags[key as FlagSetting] = value === 'true';
    }
    return flags;
  }

  async setFlag(key: FlagSetting, value: boolean): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_setting (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, String(value)],
    );
  }
}
