import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Vibration } from 'react-native';

import { adjustRestEnd, DEFAULT_REST_MS } from '@/domain/timer';

interface RestTimerState {
  /** When the rest ends (ms since epoch), or null when no rest is running. */
  endsAt: number | null;
  /**
   * When the timer was last started or adjusted. Screens use it so a slightly stale
   * "now" can't show more rest than was just set (e.g. 1:31 right after starting 1:30).
   */
  updatedAt: number | null;
}

export interface RestTimer extends RestTimerState {
  /** Starts (or restarts) a rest of `durationMs`, 1:30 by default. */
  start(durationMs?: number): void;
  /** Adds or removes time from a running rest (e.g. ±15 s), within the allowed range. */
  adjust(deltaMs: number): void;
  /** Stops the rest timer and hides it. */
  skip(): void;
}

/** A vibration this late (e.g. the app was in the background) would only be confusing. */
const MAX_VIBRATION_DELAY_MS = 2_000;

const RestTimerContext = createContext<RestTimer | null>(null);

/**
 * Holds the rest timer for the whole app, so it keeps running while you move between screens.
 * It lives in memory only: rest is short-lived, so it isn't worth saving to the database.
 * Foreground only: no notification if the app is in the background when rest ends.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>({ endsAt: null, updatedAt: null });

  // Vibrate once when the rest runs out.
  useEffect(() => {
    if (state.endsAt === null) return;
    const endsAt = state.endsAt;
    const timeout = setTimeout(
      () => {
        if (Date.now() - endsAt <= MAX_VIBRATION_DELAY_MS) Vibration.vibrate();
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [state.endsAt]);

  const value = useMemo<RestTimer>(
    () => ({
      ...state,
      start: (durationMs = DEFAULT_REST_MS) => {
        const now = Date.now();
        setState({ endsAt: now + durationMs, updatedAt: now });
      },
      adjust: (deltaMs) => {
        const now = Date.now();
        setState((current) =>
          current.endsAt === null
            ? current
            : { endsAt: adjustRestEnd(current.endsAt, deltaMs, now), updatedAt: now },
        );
      },
      skip: () => setState({ endsAt: null, updatedAt: null }),
    }),
    [state],
  );

  return <RestTimerContext value={value}>{children}</RestTimerContext>;
}

/** Access the rest timer. Must be used inside <RestTimerProvider>. */
export function useRestTimer(): RestTimer {
  const timer = use(RestTimerContext);
  if (!timer) throw new Error('useRestTimer must be used inside <RestTimerProvider>');
  return timer;
}
