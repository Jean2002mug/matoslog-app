import type { Db } from './db';

/**
 * Schema migrations. MIGRATIONS[0] takes the database from version 0 to 1,
 * MIGRATIONS[1] (when added) from 1 to 2, and so on.
 *
 * Rules: only ever APPEND new migrations; never edit or delete an old one,
 * and never drop tables or columns (migrations must not be destructive).
 */
const MIGRATIONS: readonly string[] = [
  // v1: catalog tables
  `
  CREATE TABLE equipment (
    id                TEXT    PRIMARY KEY NOT NULL,
    name              TEXT    NOT NULL UNIQUE,
    weight_convention TEXT    NOT NULL CHECK (weight_convention IN ('per_dumbbell', 'barbell_total')),
    bar_weight_cg     INTEGER CHECK (bar_weight_cg IS NULL OR bar_weight_cg > 0),
    sort_order        INTEGER NOT NULL
  );

  CREATE TABLE exercise (
    id           TEXT    PRIMARY KEY NOT NULL,
    equipment_id TEXT    NOT NULL REFERENCES equipment(id),
    name         TEXT    NOT NULL,
    sort_order   INTEGER NOT NULL,
    UNIQUE (equipment_id, name)
  );

  CREATE INDEX idx_exercise_equipment_id ON exercise(equipment_id);
  `,

  // v2: workouts and sets
  `
  CREATE TABLE workout (
    id          TEXT PRIMARY KEY NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('active', 'completed')),
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    CHECK (
      (status = 'active'    AND finished_at IS NULL) OR
      (status = 'completed' AND finished_at IS NOT NULL)
    )
  );

  -- At most one active workout: a unique index that only covers rows WHERE status = 'active'.
  CREATE UNIQUE INDEX idx_workout_one_active ON workout(status) WHERE status = 'active';

  CREATE TABLE workout_set (
    id          TEXT    PRIMARY KEY NOT NULL,
    workout_id  TEXT    NOT NULL REFERENCES workout(id),
    exercise_id TEXT    NOT NULL REFERENCES exercise(id),
    weight_cg   INTEGER NOT NULL CHECK (weight_cg >= 0),
    reps        INTEGER NOT NULL CHECK (reps > 0),
    position    INTEGER NOT NULL,
    created_at  TEXT    NOT NULL,
    UNIQUE (workout_id, position)
  );

  CREATE INDEX idx_workout_set_workout_id  ON workout_set(workout_id);
  CREATE INDEX idx_workout_set_exercise_id ON workout_set(exercise_id);

  -- Completed workouts are immutable. The service checks this too; these triggers
  -- are the last line of defence if a bug ever slips past it.
  CREATE TRIGGER trg_workout_completed_no_update
  BEFORE UPDATE ON workout WHEN OLD.status = 'completed'
  BEGIN SELECT RAISE(ABORT, 'completed workouts are immutable'); END;

  CREATE TRIGGER trg_workout_completed_no_delete
  BEFORE DELETE ON workout WHEN OLD.status = 'completed'
  BEGIN SELECT RAISE(ABORT, 'completed workouts are immutable'); END;

  CREATE TRIGGER trg_workout_set_completed_no_insert
  BEFORE INSERT ON workout_set
  WHEN (SELECT status FROM workout WHERE id = NEW.workout_id) = 'completed'
  BEGIN SELECT RAISE(ABORT, 'completed workouts are immutable'); END;

  CREATE TRIGGER trg_workout_set_completed_no_update
  BEFORE UPDATE ON workout_set
  WHEN (SELECT status FROM workout WHERE id = OLD.workout_id) = 'completed'
  BEGIN SELECT RAISE(ABORT, 'completed workouts are immutable'); END;

  CREATE TRIGGER trg_workout_set_completed_no_delete
  BEFORE DELETE ON workout_set
  WHEN (SELECT status FROM workout WHERE id = OLD.workout_id) = 'completed'
  BEGIN SELECT RAISE(ABORT, 'completed workouts are immutable'); END;
  `,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

type MigrationDb = Pick<Db, 'getFirstAsync' | 'execAsync' | 'withTransactionAsync'>;

/**
 * Brings the database schema up to LATEST_SCHEMA_VERSION.
 * The current version is stored in SQLite's built-in `PRAGMA user_version` (starts at 0).
 * Each step runs in its own transaction together with the version bump, so a failed
 * step rolls back completely and is retried on the next launch.
 */
export async function migrate(db: MigrationDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${currentVersion} is newer than this app supports (v${LATEST_SCHEMA_VERSION}).`,
    );
  }

  for (let version = currentVersion; version < LATEST_SCHEMA_VERSION; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      // PRAGMA statements can't take bound parameters; this is an integer we computed, not user input.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
