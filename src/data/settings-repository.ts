import type { FlagSetting, Flags } from '@/domain/settings';

/**
 * Saved preferences — not how they're stored.
 * The SQLite version lives in sqlite-settings-repository.ts.
 */
export interface SettingsRepository {
  /** The user's own rest for an exercise, or null if they use the recommendation. */
  getCustomRest(exerciseId: string): Promise<number | null>;

  /** Saves the user's rest for an exercise; null goes back to the recommendation. */
  setCustomRest(exerciseId: string, restMs: number | null): Promise<void>;

  /** All yes/no preferences, with defaults filled in for any never set. */
  getFlags(): Promise<Flags>;

  setFlag(key: FlagSetting, value: boolean): Promise<void>;
}
