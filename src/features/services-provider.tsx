import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { createServices, type Services } from '@/services/create-services';

export type { Services };

/** Exported so screen tests can supply services backed by a test database. */
export const ServicesContext = createContext<Services | null>(null);

/**
 * Creates the services ONCE for the whole app and shares them with every screen.
 * This matters for the shared queue: it only works if every screen uses the same instance.
 */
export function ServicesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const services = useMemo(
    () => createServices(db, { newId: randomUUID, now: () => new Date() }),
    [db],
  );
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

/** Gives a screen access to the services. Must be used inside <ServicesProvider>. */
export function useServices(): Services {
  const services = use(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
