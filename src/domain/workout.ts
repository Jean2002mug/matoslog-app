/**
 * Workout types. Pure TypeScript — no React, no SQL.
 */

export type WorkoutStatus = 'active' | 'completed';

export interface Workout {
  id: string;
  status: WorkoutStatus;
  /** UTC ISO-8601, e.g. "2026-11-12T18:30:00.000Z" */
  startedAt: string;
  /** UTC ISO-8601; null while the workout is active. */
  finishedAt: string | null;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  /** Weight in centi-kg (2250 = 22.5 kg), entered according to the equipment's weight convention. */
  weightCg: number;
  reps: number;
  /** Order within the workout (1, 2, 3...). Gaps are allowed after a set is deleted. */
  position: number;
  /** UTC ISO-8601 */
  createdAt: string;
}

/** The single active workout together with its sets, in logging order. */
export interface ActiveWorkout {
  workout: Workout;
  sets: WorkoutSet[];
}

/** A set that has passed validation and is ready to be stored. */
export interface NewSet {
  exerciseId: string;
  weightCg: number;
  reps: number;
}

/** Expected, named failures. Anything else is an unexpected storage error. */
export type WorkoutErrorCode = 'no_active_workout' | 'empty_workout' | 'set_not_found';

export class WorkoutError extends Error {
  constructor(public readonly code: WorkoutErrorCode) {
    super(code);
    this.name = 'WorkoutError';
  }
}
