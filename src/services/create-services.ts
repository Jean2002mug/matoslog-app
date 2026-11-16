import type { Db } from '@/data/db';
import { SqliteCatalogRepository } from '@/data/sqlite-catalog-repository';
import { SqliteSettingsRepository } from '@/data/sqlite-settings-repository';
import {
  SqliteWorkoutRepository,
  type WorkoutRepositoryDeps,
} from '@/data/sqlite-workout-repository';

import { CatalogService } from './catalog-service';
import { OperationQueue } from './operation-queue';
import { SettingsService } from './settings-service';
import { WorkoutService } from './workout-service';

export interface Services {
  catalog: CatalogService;
  workout: WorkoutService;
  settings: SettingsService;
}

/**
 * Builds every service on top of one database and ONE shared OperationQueue, so no two
 * writes — workout or settings — can ever interleave inside each other's transactions.
 * The app calls this once (ServicesProvider); tests call it with a test database and
 * predictable IDs and times. No Expo imports here, so plain Node tests can use it.
 */
export function createServices(db: Db, deps: WorkoutRepositoryDeps): Services {
  const queue = new OperationQueue();
  const catalogRepository = new SqliteCatalogRepository(db);
  const settingsRepository = new SqliteSettingsRepository(db);
  const workoutRepository = new SqliteWorkoutRepository(db, deps);
  return {
    catalog: new CatalogService(catalogRepository),
    workout: new WorkoutService(workoutRepository, catalogRepository, settingsRepository, queue),
    settings: new SettingsService(settingsRepository, catalogRepository, queue),
  };
}
