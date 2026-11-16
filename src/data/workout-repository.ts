import type { CompletedWorkoutDetail, CompletedWorkoutSummary } from '@/domain/history';
import type { ActiveWorkout, NewSet, WorkoutSet } from '@/domain/workout';

/** The most recent weight and reps logged for an exercise, used to pre-fill the form. */
export interface LastSet {
  weightCg: number;
  reps: number;
}

/**
 * What workout operations the app can perform — not how they're stored.
 * Every write runs in one transaction and re-checks the active workout inside it.
 * Expected failures throw a WorkoutError with a code (see src/domain/workout.ts):
 * timer actions throw `no_active_workout`, and rest actions also `no_rest`.
 */
export interface WorkoutRepository {
  /** The active workout (with its timer state) and its sets, or null if there isn't one. */
  getActiveWorkout(): Promise<ActiveWorkout | null>;

  /**
   * Adds a set, starting a new workout first if none is active. Also resumes a paused workout
   * clock and starts the set's rest countdown, all in the same transaction.
   */
  addSet(set: NewSet): Promise<WorkoutSet>;

  /** Deletes a set. Throws `set_not_found` unless it belongs to the active workout. */
  deleteSet(setId: string): Promise<void>;

  /** Pauses the workout clock (and a running rest). */
  pauseWorkout(): Promise<void>;
  /** Resumes the workout clock (and a paused rest). */
  resumeWorkout(): Promise<void>;

  pauseRest(): Promise<void>;
  resumeRest(): Promise<void>;
  /** Restarts the rest countdown from its full length. */
  resetRest(): Promise<void>;
  /** Adds or removes rest time, e.g. ±15 s. */
  adjustRest(deltaMs: number): Promise<void>;
  /** Stops the rest countdown. The workout carries on. */
  cancelRest(): Promise<void>;

  /** Marks the active workout completed. Throws `no_active_workout` or `empty_workout`. */
  finishActiveWorkout(): Promise<void>;

  /** Permanently deletes the active workout, its sets and its timers. Throws `no_active_workout`. */
  discardActiveWorkout(): Promise<void>;

  /** The last set ever logged for an exercise (any workout), or null. */
  getLastSet(exerciseId: string): Promise<LastSet | null>;

  /** Completed workouts, most recently finished first, with set and exercise counts. */
  listCompletedWorkouts(): Promise<CompletedWorkoutSummary[]>;

  /** One completed workout with its sets grouped by exercise, or null if not found or still active. */
  getCompletedWorkout(workoutId: string): Promise<CompletedWorkoutDetail | null>;
}
