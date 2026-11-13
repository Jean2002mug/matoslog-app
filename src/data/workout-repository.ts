import type { ActiveWorkout, NewSet, WorkoutSet } from '@/domain/workout';

/**
 * What workout operations the app can perform — not how they're stored.
 * Every write runs in one transaction and re-checks the active workout inside it.
 * Expected failures throw a WorkoutError with a code (see src/domain/workout.ts).
 */
export interface WorkoutRepository {
  /** The active workout with its sets, or null if there isn't one. */
  getActiveWorkout(): Promise<ActiveWorkout | null>;

  /** Adds a set to the active workout, starting a new workout first if none is active. */
  addSet(set: NewSet): Promise<WorkoutSet>;

  /** Deletes a set. Throws `set_not_found` unless it belongs to the active workout. */
  deleteSet(setId: string): Promise<void>;

  /** Marks the active workout completed. Throws `no_active_workout` or `empty_workout`. */
  finishActiveWorkout(): Promise<void>;

  /** Permanently deletes the active workout and its sets. Throws `no_active_workout`. */
  discardActiveWorkout(): Promise<void>;
}
