import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ServicesContext, type Services } from '@/features/services-provider';
import { ActiveWorkoutProvider } from '@/features/workout/active-workout-provider';

/**
 * Renders a screen the way the app does: with the services and the shared active-workout state.
 * (Screen tests must still mock expo-sqlite, expo-crypto and expo-router themselves, because
 * jest.mock calls only apply in the file that makes them.)
 */
export function renderApp(ui: ReactNode, services: Services) {
  return render(
    <ServicesContext value={services}>
      <ActiveWorkoutProvider>{ui}</ActiveWorkoutProvider>
    </ServicesContext>,
  );
}
