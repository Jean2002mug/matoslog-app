import type { CatalogRepository } from '@/data/catalog-repository';
import type { WorkoutRepository } from '@/data/workout-repository';
import type { ExerciseWithEquipment } from '@/domain/catalog';
import type { CompletedWorkoutDetail, CompletedWorkoutSummary } from '@/domain/history';
import { err, ok, type Result } from '@/domain/result';
import { parseKg, parseReps, validateSet } from '@/domain/weight';
import { WorkoutError, type ActiveWorkout, type WorkoutErrorCode, type WorkoutSet } from '@/domain/workout';

/** What the set logger form sends: the raw text the user typed. */
export interface AddSetInput {
  exerciseId: string;
  weightText: string;
  repsText: string;
}

const ERROR_MESSAGES: Record<WorkoutErrorCode, string> = {
  no_active_workout: 'There is no workout in progress.',
  empty_workout: 'Log at least one set before finishing, or discard the workout.',
  set_not_found: 'That set can no longer be changed.',
};

/**
 * The layer screens talk to for workouts.
 * - Validates input against the equipment's weight rules before touching the database.
 * - Runs every operation one at a time (see `serialize`).
 * - Returns a typed Result instead of throwing.
 */
export class WorkoutService {
  /** The tail of the queue: each new operation waits for the previous one to settle. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly workouts: WorkoutRepository,
    private readonly catalog: CatalogRepository,
  ) {}

  /**
   * Runs operations strictly one after another, even if two screens call at once.
   * expo-sqlite's withTransactionAsync is not exclusive: any query that runs while a
   * transaction is open becomes part of it. Queuing here means two operations can
   * never interleave inside each other's transactions.
   */
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined); // a failure must not block later operations
    return run;
  }

  private async attempt<T>(label: string, task: () => Promise<T>): Promise<Result<T>> {
    try {
      return ok(await this.serialize(task));
    } catch (error) {
      if (error instanceof WorkoutError) return err(ERROR_MESSAGES[error.code]);
      console.error(`WorkoutService.${label} failed`, error);
      return err('Something went wrong saving your workout. Please try again.');
    }
  }

  getActiveWorkout(): Promise<Result<ActiveWorkout | null>> {
    return this.attempt('getActiveWorkout', () => this.workouts.getActiveWorkout());
  }

  async addSet(input: AddSetInput): Promise<Result<WorkoutSet>> {
    const weightCg = parseKg(input.weightText);
    if (weightCg === null) return err('Enter a weight in kg, like 22.5.');
    const reps = parseReps(input.repsText);
    if (reps === null) return err('Enter reps as a whole number, like 8.');

    let found: ExerciseWithEquipment | null;
    try {
      found = await this.catalog.getExerciseWithEquipment(input.exerciseId);
    } catch (error) {
      console.error('WorkoutService.addSet: catalog lookup failed', error);
      return err('Something went wrong saving your workout. Please try again.');
    }
    if (!found) return err('Exercise not found.');

    const problem = validateSet(found.equipment, weightCg, reps);
    if (problem) return err(problem);

    return this.attempt('addSet', () =>
      this.workouts.addSet({ exerciseId: input.exerciseId, weightCg, reps }),
    );
  }

  deleteSet(setId: string): Promise<Result<void>> {
    return this.attempt('deleteSet', () => this.workouts.deleteSet(setId));
  }

  finishWorkout(): Promise<Result<void>> {
    return this.attempt('finishWorkout', () => this.workouts.finishActiveWorkout());
  }

  discardWorkout(): Promise<Result<void>> {
    return this.attempt('discardWorkout', () => this.workouts.discardActiveWorkout());
  }

  listCompletedWorkouts(): Promise<Result<CompletedWorkoutSummary[]>> {
    return this.attempt('listCompletedWorkouts', () => this.workouts.listCompletedWorkouts());
  }

  async getCompletedWorkout(workoutId: string): Promise<Result<CompletedWorkoutDetail>> {
    const result = await this.attempt('getCompletedWorkout', () =>
      this.workouts.getCompletedWorkout(workoutId),
    );
    if (!result.ok) return result;
    return result.value ? ok(result.value) : err('Workout not found.');
  }
}
