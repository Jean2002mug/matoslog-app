import type { CatalogRepository } from '@/data/catalog-repository';
import type { SettingsRepository } from '@/data/settings-repository';
import { err, ok, type Result } from '@/domain/result';
import type { FlagSetting, Flags } from '@/domain/settings';
import { clampRest, effectiveRestMs } from '@/domain/timer';

import { OperationQueue } from './operation-queue';

/** How long to rest after a set of one exercise, and where that number comes from. */
export interface RestSetting {
  recommendedMs: number;
  /** The user's own choice, or null when they follow the recommendation. */
  customMs: number | null;
  /** What will actually be used. */
  effectiveMs: number;
}

const GENERIC_ERROR = 'Could not save your settings. Please try again.';

/** Rest lengths per exercise, and yes/no preferences. Returns typed Results. */
export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly catalog: CatalogRepository,
    private readonly queue: OperationQueue = new OperationQueue(),
  ) {}

  private async attempt<T>(label: string, task: () => Promise<T>): Promise<Result<T>> {
    try {
      return ok(await this.queue.run(task));
    } catch (error) {
      console.error(`SettingsService.${label} failed`, error);
      return err(GENERIC_ERROR);
    }
  }

  async getRestSetting(exerciseId: string): Promise<Result<RestSetting>> {
    const found = await this.attempt('getRestSetting', async () => {
      const exercise = await this.catalog.getExerciseWithEquipment(exerciseId);
      if (!exercise) return null;
      const customMs = await this.settings.getCustomRest(exerciseId);
      const recommendedMs = exercise.exercise.recommendedRestMs;
      return { recommendedMs, customMs, effectiveMs: effectiveRestMs(recommendedMs, customMs) };
    });
    if (!found.ok) return found;
    return found.value ? ok(found.value) : err('Exercise not found.');
  }

  /**
   * Saves the user's rest for an exercise (kept within 0:15–10:00). Choosing the recommended
   * value, or passing null, removes the custom choice, so later changes to the recommendation apply.
   */
  async setCustomRest(exerciseId: string, restMs: number | null): Promise<Result<RestSetting>> {
    const current = await this.getRestSetting(exerciseId);
    if (!current.ok) return current;

    const value = restMs === null ? null : clampRest(restMs);
    const custom = value === current.value.recommendedMs ? null : value;
    const saved = await this.attempt('setCustomRest', () =>
      this.settings.setCustomRest(exerciseId, custom),
    );
    if (!saved.ok) return saved;
    return this.getRestSetting(exerciseId);
  }

  getFlags(): Promise<Result<Flags>> {
    return this.attempt('getFlags', () => this.settings.getFlags());
  }

  setFlag(key: FlagSetting, value: boolean): Promise<Result<void>> {
    return this.attempt('setFlag', () => this.settings.setFlag(key, value));
  }
}
