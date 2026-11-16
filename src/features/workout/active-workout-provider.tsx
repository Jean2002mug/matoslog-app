import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Vibration } from 'react-native';

import type { Result } from '@/domain/result';
import type { ActiveWorkout } from '@/domain/workout';
import { useServices } from '@/features/services-provider';

export type ActiveWorkoutState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; active: ActiveWorkout | null };

interface ActiveWorkoutValue {
  state: ActiveWorkoutState;
  /**
   * When `state` was last loaded (ms). Timers count from max(now, loadedAt), so a slightly
   * stale "now" can't show more time than was just set (e.g. 1:31 right after a 1:30 reset).
   */
  loadedAt: number;
  /** Reloads the active workout from the database. */
  refresh(): Promise<void>;
  /** Runs a service action, then reloads. Returns the action's result. */
  run<T>(action: () => Promise<Result<T>>): Promise<Result<T>>;
}

/** A vibration this late (e.g. the app was in the background) would only be confusing. */
const MAX_VIBRATION_DELAY_MS = 2_000;

const ActiveWorkoutContext = createContext<ActiveWorkoutValue | null>(null);

/**
 * Holds the active workout — sets, workout clock, rest timer — for the whole app, so every
 * screen shows the same thing and the rest-over vibration fires exactly once.
 * The state itself lives in SQLite; this is only the in-memory copy screens read from.
 */
export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { workout } = useServices();
  const [state, setState] = useState<ActiveWorkoutState>({ status: 'loading' });
  const [loadedAt, setLoadedAt] = useState(0);

  const apply = useCallback((result: Result<ActiveWorkout | null>) => {
    setLoadedAt(Date.now());
    setState(
      result.ok
        ? { status: 'ready', active: result.value }
        : { status: 'error', message: result.error },
    );
  }, []);

  const refresh = useCallback(async () => {
    apply(await workout.getActiveWorkout());
  }, [workout, apply]);

  // First load when the app opens: picks up a workout (and its timers) saved before.
  useEffect(() => {
    let cancelled = false;
    workout.getActiveWorkout().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [workout, apply]);

  // Vibrate once when a running rest reaches zero.
  const restEndsAt = state.status === 'ready' ? (state.active?.workout.rest?.endsAt ?? null) : null;
  useEffect(() => {
    if (restEndsAt === null) return;
    const endsAt = Date.parse(restEndsAt);
    const timeout = setTimeout(
      () => {
        if (Date.now() - endsAt <= MAX_VIBRATION_DELAY_MS) Vibration.vibrate();
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [restEndsAt]);

  const value = useMemo<ActiveWorkoutValue>(
    () => ({
      state,
      loadedAt,
      refresh,
      run: async (action) => {
        const result = await action();
        await refresh();
        return result;
      },
    }),
    [state, loadedAt, refresh],
  );

  return <ActiveWorkoutContext value={value}>{children}</ActiveWorkoutContext>;
}

/** The active workout and its timers. Must be used inside <ActiveWorkoutProvider>. */
export function useActiveWorkout(): ActiveWorkoutValue {
  const value = use(ActiveWorkoutContext);
  if (!value) throw new Error('useActiveWorkout must be used inside <ActiveWorkoutProvider>');
  return value;
}
