/**
 * Workout clock and rest timer rules. Pure TypeScript — no React, no SQL.
 *
 * Every timer is computed from TIMESTAMPS ("started at", "ends at", "paused at") rather than by
 * counting ticks. Phones pause JavaScript timers while an app is in the background, so counting
 * ticks would drift; timestamps stay correct, and can be saved so timers survive an app restart.
 *
 * The functions that change timer state are pure: they take the current state and "now" and
 * return the new state. The repository saves the result inside a transaction.
 */

export const DEFAULT_REST_MS = 90_000; // 1:30, for exercises without a recommendation
export const REST_STEP_MS = 15_000; // the −15 s / +15 s buttons
export const MIN_REST_MS = 15_000;
export const MAX_REST_MS = 10 * 60_000; // 10:00
/** Quick choices offered when customizing an exercise's rest. */
export const REST_PRESETS_MS: readonly number[] = [60_000, 90_000, 120_000, 150_000, 180_000];

/**
 * A rest countdown belonging to the active workout. Exactly one of `endsAt` / `remainingMs` is set:
 * - running: `endsAt` is when it reaches zero (UTC ISO-8601)
 * - paused:  `remainingMs` is how much was left when it was paused
 */
export interface RestState {
  /** The full length, used by Reset. */
  durationMs: number;
  endsAt: string | null;
  remainingMs: number | null;
}

/** The timer-related part of a workout. */
export interface WorkoutTimers {
  /** When the current pause began (UTC ISO-8601), or null while the clock is running. */
  pausedAt: string | null;
  /** Total length of all earlier, finished pauses. */
  pausedMs: number;
  rest: RestState | null;
}

export const NO_TIMERS: WorkoutTimers = { pausedAt: null, pausedMs: 0, rest: null };

const toIso = (ms: number) => new Date(ms).toISOString();

export const clampRest = (ms: number) => Math.min(MAX_REST_MS, Math.max(MIN_REST_MS, ms));

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

// ---------------------------------------------------------------------------
// Workout clock
// ---------------------------------------------------------------------------

/** Time paused so far, including a pause that is still going on. */
export function pausedSoFar(timers: WorkoutTimers, nowMs: number): number {
  const current = timers.pausedAt ? Math.max(0, nowMs - Date.parse(timers.pausedAt)) : 0;
  return timers.pausedMs + current;
}

/**
 * The workout clock: time since the start, minus time spent paused. Frozen while paused.
 * Never negative.
 */
export function workoutActiveMs(startedAt: string, timers: WorkoutTimers, nowMs: number): number {
  return Math.max(0, nowMs - Date.parse(startedAt) - pausedSoFar(timers, nowMs));
}

/** Pauses the workout clock, and a running rest with it. Pausing twice changes nothing. */
export function pauseWorkout(timers: WorkoutTimers, nowMs: number): WorkoutTimers {
  if (timers.pausedAt) return timers;
  return { ...timers, pausedAt: toIso(nowMs), rest: pauseRest(timers.rest, nowMs) };
}

/** Resumes the workout clock, and a paused rest with it. Resuming a running clock changes nothing. */
export function resumeWorkout(timers: WorkoutTimers, nowMs: number): WorkoutTimers {
  if (!timers.pausedAt) return timers;
  return {
    pausedAt: null,
    pausedMs: pausedSoFar(timers, nowMs),
    rest: resumeRest(timers.rest, nowMs),
  };
}

/** The timers as they should be saved when the workout finishes: pause closed, rest cleared. */
export function finishTimers(timers: WorkoutTimers, nowMs: number): WorkoutTimers {
  return { pausedAt: null, pausedMs: pausedSoFar(timers, nowMs), rest: null };
}

// ---------------------------------------------------------------------------
// Rest timer
// ---------------------------------------------------------------------------

/**
 * Rest left, rounded UP to whole seconds so the display reaches "0:00" exactly when the rest
 * is over (not a second early). Never negative.
 */
export function restRemaining(rest: RestState, nowMs: number): number {
  const exact =
    rest.endsAt !== null ? Date.parse(rest.endsAt) - nowMs : (rest.remainingMs ?? 0);
  return Math.max(0, Math.ceil(exact / 1000) * 1000);
}

export const isRestPaused = (rest: RestState) => rest.endsAt === null;

/** Starts a fresh rest of `durationMs` (kept within the allowed range). */
export function startRest(durationMs: number, nowMs: number): RestState {
  const duration = clampRest(durationMs);
  return { durationMs: duration, endsAt: toIso(nowMs + duration), remainingMs: null };
}

export function pauseRest(rest: RestState | null, nowMs: number): RestState | null {
  if (!rest || isRestPaused(rest)) return rest;
  return { ...rest, endsAt: null, remainingMs: Math.max(0, Date.parse(rest.endsAt!) - nowMs) };
}

export function resumeRest(rest: RestState | null, nowMs: number): RestState | null {
  if (!rest || !isRestPaused(rest)) return rest;
  return { ...rest, endsAt: toIso(nowMs + (rest.remainingMs ?? 0)), remainingMs: null };
}

/** Starts the countdown again from its full length; stays paused if it was paused. */
export function resetRest(rest: RestState, nowMs: number): RestState {
  return isRestPaused(rest)
    ? { ...rest, remainingMs: rest.durationMs }
    : { ...rest, endsAt: toIso(nowMs + rest.durationMs), remainingMs: null };
}

/**
 * Adds or removes time (e.g. ±15 s), keeping what's left between MIN_REST_MS and MAX_REST_MS.
 * +15 s on a rest that already ran out starts a fresh short rest.
 */
export function adjustRest(rest: RestState, deltaMs: number, nowMs: number): RestState {
  if (isRestPaused(rest)) {
    return { ...rest, remainingMs: clampRest((rest.remainingMs ?? 0) + deltaMs) };
  }
  const left = Math.max(0, Date.parse(rest.endsAt!) - nowMs);
  return { ...rest, endsAt: toIso(nowMs + clampRest(left + deltaMs)) };
}

/** The rest to use for an exercise: the user's choice if they made one, else the recommendation. */
export function effectiveRestMs(recommendedRestMs: number, customRestMs: number | null): number {
  return clampRest(customRestMs ?? recommendedRestMs);
}
