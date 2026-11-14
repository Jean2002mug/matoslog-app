/**
 * Workout clock and rest timer rules. Pure TypeScript — no React, no SQL.
 *
 * Both timers are computed from TIMESTAMPS ("started at", "ends at") rather than by
 * counting ticks. Phones pause JavaScript timers while an app is in the background,
 * so counting ticks would drift; timestamps stay correct when the app comes back.
 */

export const DEFAULT_REST_MS = 90_000; // 1:30
export const REST_STEP_MS = 15_000; // the −15 s / +15 s buttons
export const MIN_REST_MS = 15_000;
export const MAX_REST_MS = 10 * 60_000; // 10:00

/** Formats a duration as a clock: "0:05", "1:30", "12:34", "1:02:03". Negative counts as 0. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Time since the workout started (UTC ISO timestamp), never negative. */
export function elapsedSince(startedAtIso: string, nowMs: number): number {
  return Math.max(0, nowMs - Date.parse(startedAtIso));
}

/**
 * Rest left, rounded UP to whole seconds so the display reaches "0:00" exactly
 * when the rest is over (not a second early). Never negative.
 */
export function restRemaining(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000) * 1000);
}

/**
 * Moves a running rest timer's end time by `deltaMs` (e.g. ±15 s), keeping the
 * remaining rest between MIN_REST_MS and MAX_REST_MS.
 */
export function adjustRestEnd(endsAtMs: number, deltaMs: number, nowMs: number): number {
  const remaining = Math.max(0, endsAtMs - nowMs) + deltaMs;
  const clamped = Math.min(MAX_REST_MS, Math.max(MIN_REST_MS, remaining));
  return nowMs + clamped;
}
