import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ActiveWorkout } from '@/domain/workout';
import { useServices } from '@/features/services-provider';

export type ActiveWorkoutState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; active: ActiveWorkout | null };

/**
 * Loads the active workout, and reloads it every time the screen comes back into view
 * (e.g. after pressing Back), so every screen shows up-to-date sets.
 * Call `refresh()` after changing the workout to reload straight away.
 */
export function useActiveWorkout() {
  const { workout } = useServices();
  const [state, setState] = useState<ActiveWorkoutState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    const result = await workout.getActiveWorkout();
    setState(
      result.ok
        ? { status: 'ready', active: result.value }
        : { status: 'error', message: result.error },
    );
  }, [workout]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { state, refresh };
}
