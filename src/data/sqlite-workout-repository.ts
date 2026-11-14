import {
  WorkoutError,
  type ActiveWorkout,
  type NewSet,
  type Workout,
  type WorkoutSet,
  type WorkoutStatus,
} from '@/domain/workout';

import type { Db } from './db';
import type { WorkoutRepository } from './workout-repository';

/** Rows exactly as SQLite returns them (snake_case column names). */
interface WorkoutRow {
  id: string;
  status: WorkoutStatus;
  started_at: string;
  finished_at: string | null;
}

interface WorkoutSetRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  weight_cg: number;
  reps: number;
  position: number;
  created_at: string;
}

const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  status: row.status,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
});

const toWorkoutSet = (row: WorkoutSetRow): WorkoutSet => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  weightCg: row.weight_cg,
  reps: row.reps,
  position: row.position,
  createdAt: row.created_at,
});

/**
 * Where new IDs and timestamps come from. Passed in (instead of calling
 * expo-crypto and Date directly) so tests can use predictable values.
 */
export interface WorkoutRepositoryDeps {
  newId: () => string;
  now: () => Date;
}

export class SqliteWorkoutRepository implements WorkoutRepository {
  constructor(
    private readonly db: Db,
    private readonly deps: WorkoutRepositoryDeps,
  ) {}

  /** Timestamps are stored as UTC ISO-8601 text. */
  private timestamp(): string {
    return this.deps.now().toISOString();
  }

  private findActiveWorkoutRow(): Promise<WorkoutRow | null> {
    return this.db.getFirstAsync<WorkoutRow>(
      `SELECT id, status, started_at, finished_at FROM workout WHERE status = 'active'`,
    );
  }

  private async requireActiveWorkoutRow(): Promise<WorkoutRow> {
    const row = await this.findActiveWorkoutRow();
    if (!row) throw new WorkoutError('no_active_workout');
    return row;
  }

  async getActiveWorkout(): Promise<ActiveWorkout | null> {
    const row = await this.findActiveWorkoutRow();
    if (!row) return null;
    const setRows = await this.db.getAllAsync<WorkoutSetRow>(
      `SELECT id, workout_id, exercise_id, weight_cg, reps, position, created_at
       FROM workout_set WHERE workout_id = ? ORDER BY position`,
      [row.id],
    );
    return { workout: toWorkout(row), sets: setRows.map(toWorkoutSet) };
  }

  async addSet(input: NewSet): Promise<WorkoutSet> {
    let created: WorkoutSet | null = null;

    await this.db.withTransactionAsync(async () => {
      const now = this.timestamp();

      // Re-check inside the transaction: start a workout only if none is active.
      let workoutId = (await this.findActiveWorkoutRow())?.id;
      if (!workoutId) {
        workoutId = this.deps.newId();
        await this.db.runAsync(
          `INSERT INTO workout (id, status, started_at, finished_at) VALUES (?, 'active', ?, NULL)`,
          [workoutId, now],
        );
      }

      const next = await this.db.getFirstAsync<{ position: number }>(
        `SELECT COALESCE(MAX(position), 0) + 1 AS position FROM workout_set WHERE workout_id = ?`,
        [workoutId],
      );

      const set: WorkoutSet = {
        id: this.deps.newId(),
        workoutId,
        exerciseId: input.exerciseId,
        weightCg: input.weightCg,
        reps: input.reps,
        position: next?.position ?? 1,
        createdAt: now,
      };
      await this.db.runAsync(
        `INSERT INTO workout_set (id, workout_id, exercise_id, weight_cg, reps, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [set.id, set.workoutId, set.exerciseId, set.weightCg, set.reps, set.position, set.createdAt],
      );
      created = set;
    });

    if (!created) throw new Error('addSet finished without creating a set');
    return created;
  }

  async deleteSet(setId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      // Only sets in the ACTIVE workout may be deleted; completed workouts are immutable.
      const row = await this.db.getFirstAsync<{ id: string }>(
        `SELECT s.id FROM workout_set s
         JOIN workout w ON w.id = s.workout_id
         WHERE s.id = ? AND w.status = 'active'`,
        [setId],
      );
      if (!row) throw new WorkoutError('set_not_found');
      await this.db.runAsync(`DELETE FROM workout_set WHERE id = ?`, [setId]);
    });
  }

  async finishActiveWorkout(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const workout = await this.requireActiveWorkoutRow();
      const count = await this.db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ?`,
        [workout.id],
      );
      if (!count || count.n === 0) throw new WorkoutError('empty_workout');

      await this.db.runAsync(
        `UPDATE workout SET status = 'completed', finished_at = ? WHERE id = ? AND status = 'active'`,
        [this.timestamp(), workout.id],
      );
    });
  }

  async discardActiveWorkout(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const workout = await this.requireActiveWorkoutRow();
      // Sets first, because they reference the workout (foreign key).
      await this.db.runAsync(`DELETE FROM workout_set WHERE workout_id = ?`, [workout.id]);
      await this.db.runAsync(`DELETE FROM workout WHERE id = ? AND status = 'active'`, [workout.id]);
    });
  }
}
