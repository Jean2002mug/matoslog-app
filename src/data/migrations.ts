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

  // v3: timer controls, rest settings, app settings. Only ADDs columns and tables.
  `
  -- Workout clock pause, saved with the workout so it survives an app restart.
  ALTER TABLE workout ADD COLUMN paused_at TEXT;
  ALTER TABLE workout ADD COLUMN paused_ms INTEGER NOT NULL DEFAULT 0 CHECK (paused_ms >= 0);

  -- The rest countdown belongs to the active workout: it's saved with it, cleared when the
  -- workout finishes, and deleted with it when the workout is cancelled.
  -- Running: rest_ends_at is set. Paused: rest_remaining_ms is set.
  ALTER TABLE workout ADD COLUMN rest_duration_ms  INTEGER CHECK (rest_duration_ms > 0);
  ALTER TABLE workout ADD COLUMN rest_ends_at      TEXT;
  ALTER TABLE workout ADD COLUMN rest_remaining_ms INTEGER CHECK (rest_remaining_ms >= 0);

  -- Recommended rest per exercise (catalog data). New exercises default to 1:30.
  ALTER TABLE exercise ADD COLUMN recommended_rest_ms INTEGER NOT NULL DEFAULT 90000
    CHECK (recommended_rest_ms > 0);
  -- Existing installs already have the seed rows (the seed only inserts missing rows),
  -- so set their recommendations here. IDs match src/data/seed-data.ts.
  UPDATE exercise SET recommended_rest_ms = 150000 WHERE id = 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a03';
  UPDATE exercise SET recommended_rest_ms = 180000 WHERE id = 'a3e9d7b5-2c41-4f6e-8d0a-7b9c1e3f5a04';

  -- The user's own rest length for an exercise, overriding the recommendation.
  CREATE TABLE exercise_rest_setting (
    exercise_id TEXT    PRIMARY KEY NOT NULL REFERENCES exercise(id),
    rest_ms     INTEGER NOT NULL CHECK (rest_ms BETWEEN 15000 AND 600000)
  );

  -- Simple key/value app preferences, e.g. "don't ask again" choices.
  CREATE TABLE app_setting (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

type MigrationDb = Pick<Db, 'getFirstAsync' | 'execAsync' | 'withTransactionAsync'>;

/**
 * Brings the database schema up to LATEST_SCHEMA_VERSION.
 * The current version is stored in SQLite's built-in `PRAGMA user_version` (starts at 0).
 * Each step runs in its own transaction together with the version bump, so a failed
 * step rolls back completely and is retried on the next launch.
 *
 * `targetVersion` is for tests: it stops early, to build a database exactly as an older
 * version of the app left it, and then check that upgrading it works.
 */
export async function migrate(
  db: MigrationDb,
  targetVersion: number = LATEST_SCHEMA_VERSION,
): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${currentVersion} is newer than this app supports (v${LATEST_SCHEMA_VERSION}).`,
    );
  }

  const target = Math.min(targetVersion, LATEST_SCHEMA_VERSION);
  for (let version = currentVersion; version < target; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      // PRAGMA statements can't take bound parameters; this is an integer we computed, not user input.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
