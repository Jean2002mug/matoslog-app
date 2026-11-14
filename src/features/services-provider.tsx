import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { SqliteCatalogRepository } from '@/data/sqlite-catalog-repository';
import { SqliteWorkoutRepository } from '@/data/sqlite-workout-repository';
import { CatalogService } from '@/services/catalog-service';
import { WorkoutService } from '@/services/workout-service';

export interface Services {
  catalog: CatalogService;
  workout: WorkoutService;
}

/** Exported so screen tests can supply services backed by a test database. */
export const ServicesContext = createContext<Services | null>(null);

/**
 * Creates the services ONCE for the whole app and shares them with every screen.
 * This matters for WorkoutService: its "one operation at a time" queue only works
 * if every screen uses the same instance.
 */
export function ServicesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();

  const services = useMemo<Services>(() => {
    const catalogRepository = new SqliteCatalogRepository(db);
    const workoutRepository = new SqliteWorkoutRepository(db, {
      newId: randomUUID,
      now: () => new Date(),
    });
    return {
      catalog: new CatalogService(catalogRepository),
      workout: new WorkoutService(workoutRepository, catalogRepository),
    };
  }, [db]);

  return <ServicesContext value={services}>{children}</ServicesContext>;
}

/** Gives a screen access to the services. Must be used inside <ServicesProvider>. */
export function useServices(): Services {
  const services = use(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
