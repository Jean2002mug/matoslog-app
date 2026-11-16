import type { CatalogRepository } from '@/data/catalog-repository';
import type { SettingsRepository } from '@/data/settings-repository';
import type { LastSet, WorkoutRepository } from '@/data/workout-repository';
import type { ExerciseWithEquipment } from '@/domain/catalog';
import type { CompletedWorkoutDetail, CompletedWorkoutSummary } from '@/domain/history';
import { err, ok, type Result } from '@/domain/result';
import { effectiveRestMs } from '@/domain/timer';
import { parseKg, parseReps, validateSet } from '@/domain/weight';
import { WorkoutError, type ActiveWorkout, type WorkoutErrorCode, type WorkoutSet } from '@/domain/workout';

import { OperationQueue } from './operation-queue';

/** What the set logger form sends: the raw text the user typed. */
export interface AddSetInput {
  exerciseId: string;
  weightText: string;
  repsText: string;
}

const ERROR_MESSAGES: Record<WorkoutErrorCode, string> = {
  no_active_workout: 'There is no workout in progress.',
  empty_workout: 'Log at least one set before finishing, or cancel the workout.',
  set_not_found: 'That set can no longer be changed.',
  no_rest: 'There is no rest timer running.',
};

const GENERIC_ERROR = 'Something went wrong saving your workout. Please try again.';

/**
 * The layer screens talk to for workouts and their timers.
 * - Validates input against the equipment's weight rules before touching the database.
 * - Runs every operation one at a time through the shared OperationQueue.
 * - Returns a typed Result instead of throwing.
 */
export class WorkoutService {
  constructor(
    private readonly workouts: WorkoutRepository,
    private readonly catalog: CatalogRepository,
    private readonly settings: SettingsRepository,
    private readonly queue: OperationQueue = new OperationQueue(),
  ) {}

  private async attempt<T>(label: string, task: () => Promise<T>): Promise<Result<T>> {
    try {
      return ok(await this.queue.run(task));
    } catch (error) {
      if (error instanceof WorkoutError) return err(ERROR_MESSAGES[error.code]);
      console.error(`WorkoutService.${label} failed`, error);
      return err(GENERIC_ERROR);
    }
  }

  // Public methods are arrow-function properties so they keep `this` even when passed around
  // on their own (e.g. `run(workout.finishWorkout)`); a regular method would lose it.

  getActiveWorkout = (): Promise<Result<ActiveWorkout | null>> =>
    this.attempt('getActiveWorkout', () => this.workouts.getActiveWorkout());

  /**
   * Saves a set and starts its rest countdown — the user's own rest for this exercise,
   * or the exercise's recommendation.
   */
  addSet = async (input: AddSetInput): Promise<Result<WorkoutSet>> => {
    const weightCg = parseKg(input.weightText);
    if (weightCg === null) return err('Enter a weight in kg, like 22.5.');
    const reps = parseReps(input.repsText);
    if (reps === null) return err('Enter reps as a whole number, like 8.');

    let found: ExerciseWithEquipment | null;
    try {
      found = await this.catalog.getExerciseWithEquipment(input.exerciseId);
    } catch (error) {
      console.error('WorkoutService.addSet: catalog lookup failed', error);
      return err(GENERIC_ERROR);
    }
    if (!found) return err('Exercise not found.');

    const problem = validateSet(found.equipment, weightCg, reps);
    if (problem) return err(problem);

    const { exercise } = found;
    return this.attempt('addSet', async () => {
      const restMs = effectiveRestMs(
        exercise.recommendedRestMs,
        await this.settings.getCustomRest(exercise.id),
      );
      return this.workouts.addSet({ exerciseId: exercise.id, weightCg, reps, restMs });
    });
  };

  deleteSet = (setId: string): Promise<Result<void>> =>
    this.attempt('deleteSet', () => this.workouts.deleteSet(setId));

  pauseWorkout = () => this.attempt('pauseWorkout', () => this.workouts.pauseWorkout());
  resumeWorkout = () => this.attempt('resumeWorkout', () => this.workouts.resumeWorkout());
  pauseRest = () => this.attempt('pauseRest', () => this.workouts.pauseRest());
  resumeRest = () => this.attempt('resumeRest', () => this.workouts.resumeRest());
  resetRest = () => this.attempt('resetRest', () => this.workouts.resetRest());
  adjustRest = (deltaMs: number) =>
    this.attempt('adjustRest', () => this.workouts.adjustRest(deltaMs));
  cancelRest = () => this.attempt('cancelRest', () => this.workouts.cancelRest());

  finishWorkout = (): Promise<Result<void>> =>
    this.attempt('finishWorkout', () => this.workouts.finishActiveWorkout());

  /** Cancelling the workout timer: deletes the workout, its sets and its timers. */
  discardWorkout = (): Promise<Result<void>> =>
    this.attempt('discardWorkout', () => this.workouts.discardActiveWorkout());

  getLastSet = (exerciseId: string): Promise<Result<LastSet | null>> =>
    this.attempt('getLastSet', () => this.workouts.getLastSet(exerciseId));

  listCompletedWorkouts = (): Promise<Result<CompletedWorkoutSummary[]>> =>
    this.attempt('listCompletedWorkouts', () => this.workouts.listCompletedWorkouts());

  getCompletedWorkout = async (workoutId: string): Promise<Result<CompletedWorkoutDetail>> => {
    const result = await this.attempt('getCompletedWorkout', () =>
      this.workouts.getCompletedWorkout(workoutId),
    );
    if (!result.ok) return result;
    return result.value ? ok(result.value) : err('Workout not found.');
  };
}
