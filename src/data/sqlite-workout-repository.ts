import {
  groupSetsByExercise,
  type CompletedWorkoutDetail,
  type CompletedWorkoutSummary,
} from '@/domain/history';
import {
  adjustRest,
  finishTimers,
  pauseRest,
  pauseWorkout,
  resetRest,
  resumeRest,
  resumeWorkout,
  startRest,
  type RestState,
  type WorkoutTimers,
} from '@/domain/timer';
import {
  WorkoutError,
  type ActiveWorkout,
  type NewSet,
  type Workout,
  type WorkoutSet,
  type WorkoutStatus,
} from '@/domain/workout';

import type { Db } from './db';
import { toEquipment, toExercise } from './sqlite-catalog-repository';
import type { LastSet, WorkoutRepository } from './workout-repository';

/** Rows exactly as SQLite returns them (snake_case column names). */
interface WorkoutRow {
  id: string;
  status: WorkoutStatus;
  started_at: string;
  finished_at: string | null;
  paused_at: string | null;
  paused_ms: number;
  rest_duration_ms: number | null;
  rest_ends_at: string | null;
  rest_remaining_ms: number | null;
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

interface SummaryRow extends WorkoutRow {
  set_count: number;
  exercise_count: number;
}

/** A set joined with its exercise and equipment; columns are prefixed to avoid name clashes. */
interface SetDetailRow extends WorkoutSetRow {
  ex_name: string;
  ex_sort_order: number;
  ex_recommended_rest_ms: number;
  eq_id: string;
  eq_name: string;
  eq_weight_convention: string;
  eq_bar_weight_cg: number | null;
  eq_sort_order: number;
}

const WORKOUT_COLUMNS = `id, status, started_at, finished_at, paused_at, paused_ms,
  rest_duration_ms, rest_ends_at, rest_remaining_ms`;
const WORKOUT_COLUMNS_W = WORKOUT_COLUMNS.replace(/(\w+)/g, 'w.$1');
const SET_COLUMNS = 'id, workout_id, exercise_id, weight_cg, reps, position, created_at';

function toRest(row: WorkoutRow): RestState | null {
  if (row.rest_duration_ms === null) return null;
  return {
    durationMs: row.rest_duration_ms,
    endsAt: row.rest_ends_at,
    remainingMs: row.rest_remaining_ms,
  };
}

const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  status: row.status,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  pausedAt: row.paused_at,
  pausedMs: row.paused_ms,
  rest: toRest(row),
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

/** Throws `no_rest` if there is no rest countdown to act on. */
function requireRest(timers: WorkoutTimers): RestState {
  if (!timers.rest) throw new WorkoutError('no_rest');
  return timers.rest;
}

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

  private findActiveWorkoutRow(): Promise<WorkoutRow | null> {
    return this.db.getFirstAsync<WorkoutRow>(
      `SELECT ${WORKOUT_COLUMNS} FROM workout WHERE status = 'active'`,
    );
  }

  private async requireActiveWorkoutRow(): Promise<WorkoutRow> {
    const row = await this.findActiveWorkoutRow();
    if (!row) throw new WorkoutError('no_active_workout');
    return row;
  }

  /** Saves the timer state of the active workout (pause + rest). Call inside a transaction. */
  private async writeTimers(workoutId: string, t: WorkoutTimers): Promise<void> {
    await this.db.runAsync(
      `UPDATE workout
       SET paused_at = ?, paused_ms = ?,
           rest_duration_ms = ?, rest_ends_at = ?, rest_remaining_ms = ?
       WHERE id = ? AND status = 'active'`,
      [
        t.pausedAt,
        t.pausedMs,
        t.rest?.durationMs ?? null,
        t.rest?.endsAt ?? null,
        t.rest?.remainingMs ?? null,
        workoutId,
      ],
    );
  }

  /**
   * The shared shape of every timer action: in ONE transaction, re-read the active workout,
   * compute its new timer state with a pure function from src/domain/timer.ts, and save it.
   */
  private async changeTimers(change: (t: WorkoutTimers, nowMs: number) => WorkoutTimers) {
    await this.db.withTransactionAsync(async () => {
      const workout = toWorkout(await this.requireActiveWorkoutRow());
      await this.writeTimers(workout.id, change(workout, this.deps.now().getTime()));
    });
  }

  async getActiveWorkout(): Promise<ActiveWorkout | null> {
    const row = await this.findActiveWorkoutRow();
    if (!row) return null;
    const setRows = await this.db.getAllAsync<WorkoutSetRow>(
      `SELECT ${SET_COLUMNS} FROM workout_set WHERE workout_id = ? ORDER BY position`,
      [row.id],
    );
    return { workout: toWorkout(row), sets: setRows.map(toWorkoutSet) };
  }

  async addSet(input: NewSet): Promise<WorkoutSet> {
    let created: WorkoutSet | null = null;

    await this.db.withTransactionAsync(async () => {
      const nowMs = this.deps.now().getTime();
      const now = new Date(nowMs).toISOString();

      // Re-check inside the transaction: start a workout only if none is active.
      let row = await this.findActiveWorkoutRow();
      if (!row) {
        const id = this.deps.newId();
        await this.db.runAsync(
          `INSERT INTO workout (id, status, started_at, finished_at) VALUES (?, 'active', ?, NULL)`,
          [id, now],
        );
        row = await this.requireActiveWorkoutRow();
      }

      const next = await this.db.getFirstAsync<{ position: number }>(
        `SELECT COALESCE(MAX(position), 0) + 1 AS position FROM workout_set WHERE workout_id = ?`,
        [row.id],
      );

      const set: WorkoutSet = {
        id: this.deps.newId(),
        workoutId: row.id,
        exerciseId: input.exerciseId,
        weightCg: input.weightCg,
        reps: input.reps,
        position: next?.position ?? 1,
        createdAt: now,
      };
      await this.db.runAsync(
        `INSERT INTO workout_set (${SET_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [set.id, set.workoutId, set.exerciseId, set.weightCg, set.reps, set.position, set.createdAt],
      );

      // Logging a set means you're training: resume a paused clock, then start the rest.
      const resumed = resumeWorkout(toWorkout(row), nowMs);
      await this.writeTimers(row.id, { ...resumed, rest: startRest(input.restMs, nowMs) });
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

  pauseWorkout(): Promise<void> {
    return this.changeTimers((t, now) => pauseWorkout(t, now));
  }

  resumeWorkout(): Promise<void> {
    return this.changeTimers((t, now) => resumeWorkout(t, now));
  }

  pauseRest(): Promise<void> {
    return this.changeTimers((t, now) => ({ ...t, rest: pauseRest(requireRest(t), now) }));
  }

  resumeRest(): Promise<void> {
    return this.changeTimers((t, now) => ({ ...t, rest: resumeRest(requireRest(t), now) }));
  }

  resetRest(): Promise<void> {
    return this.changeTimers((t, now) => ({ ...t, rest: resetRest(requireRest(t), now) }));
  }

  adjustRest(deltaMs: number): Promise<void> {
    return this.changeTimers((t, now) => ({ ...t, rest: adjustRest(requireRest(t), deltaMs, now) }));
  }

  cancelRest(): Promise<void> {
    return this.changeTimers((t) => ({ ...t, rest: null }));
  }

  async finishActiveWorkout(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const workout = toWorkout(await this.requireActiveWorkoutRow());
      const count = await this.db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ?`,
        [workout.id],
      );
      if (!count || count.n === 0) throw new WorkoutError('empty_workout');

      const nowMs = this.deps.now().getTime();
      // Close any pause (so its time is counted) and clear the rest, in the same update
      // that completes the workout — after this, the triggers lock the row.
      const timers = finishTimers(workout, nowMs);
      await this.db.runAsync(
        `UPDATE workout
         SET status = 'completed', finished_at = ?, paused_at = NULL, paused_ms = ?,
             rest_duration_ms = NULL, rest_ends_at = NULL, rest_remaining_ms = NULL
         WHERE id = ? AND status = 'active'`,
        [new Date(nowMs).toISOString(), timers.pausedMs, workout.id],
      );
    });
  }

  async discardActiveWorkout(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const workout = await this.requireActiveWorkoutRow();
      // Sets first, because they reference the workout (foreign key). The timers are columns
      // of the workout row, so they disappear with it.
      await this.db.runAsync(`DELETE FROM workout_set WHERE workout_id = ?`, [workout.id]);
      await this.db.runAsync(`DELETE FROM workout WHERE id = ? AND status = 'active'`, [workout.id]);
    });
  }

  async getLastSet(exerciseId: string): Promise<LastSet | null> {
    const row = await this.db.getFirstAsync<{ weight_cg: number; reps: number }>(
      `SELECT weight_cg, reps FROM workout_set
       WHERE exercise_id = ?
       ORDER BY created_at DESC, position DESC
       LIMIT 1`,
      [exerciseId],
    );
    return row ? { weightCg: row.weight_cg, reps: row.reps } : null;
  }

  async listCompletedWorkouts(): Promise<CompletedWorkoutSummary[]> {
    // LEFT JOIN so a workout still appears even if it somehow has no sets.
    const rows = await this.db.getAllAsync<SummaryRow>(
      `SELECT ${WORKOUT_COLUMNS_W},
              COUNT(s.id) AS set_count,
              COUNT(DISTINCT s.exercise_id) AS exercise_count
       FROM workout w
       LEFT JOIN workout_set s ON s.workout_id = w.id
       WHERE w.status = 'completed'
       GROUP BY w.id
       ORDER BY w.finished_at DESC, w.id`,
    );
    return rows.map((row) => ({
      workout: toWorkout(row),
      setCount: row.set_count,
      exerciseCount: row.exercise_count,
    }));
  }

  async getCompletedWorkout(workoutId: string): Promise<CompletedWorkoutDetail | null> {
    const workoutRow = await this.db.getFirstAsync<WorkoutRow>(
      `SELECT ${WORKOUT_COLUMNS} FROM workout WHERE id = ? AND status = 'completed'`,
      [workoutId],
    );
    if (!workoutRow) return null;

    const rows = await this.db.getAllAsync<SetDetailRow>(
      `SELECT s.id, s.workout_id, s.exercise_id, s.weight_cg, s.reps, s.position, s.created_at,
              e.name AS ex_name, e.sort_order AS ex_sort_order,
              e.recommended_rest_ms AS ex_recommended_rest_ms,
              q.id AS eq_id, q.name AS eq_name, q.weight_convention AS eq_weight_convention,
              q.bar_weight_cg AS eq_bar_weight_cg, q.sort_order AS eq_sort_order
       FROM workout_set s
       JOIN exercise e  ON e.id = s.exercise_id
       JOIN equipment q ON q.id = e.equipment_id
       WHERE s.workout_id = ?
       ORDER BY s.position`,
      [workoutId],
    );

    const items = rows.map((row) => ({
      set: toWorkoutSet(row),
      exercise: toExercise({
        id: row.exercise_id,
        equipment_id: row.eq_id,
        name: row.ex_name,
        sort_order: row.ex_sort_order,
        recommended_rest_ms: row.ex_recommended_rest_ms,
      }),
      equipment: toEquipment({
        id: row.eq_id,
        name: row.eq_name,
        weight_convention: row.eq_weight_convention,
        bar_weight_cg: row.eq_bar_weight_cg,
        sort_order: row.eq_sort_order,
      }),
    }));

    return { workout: toWorkout(workoutRow), groups: groupSetsByExercise(items) };
  }
}
