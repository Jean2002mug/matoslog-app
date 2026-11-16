/**
 * History: finished workouts. Pure TypeScript — no React, no SQL.
 */
import type { Equipment, Exercise } from './catalog';
import type { Workout, WorkoutSet } from './workout';

/** One row in the history list. */
export interface CompletedWorkoutSummary {
  workout: Workout;
  setCount: number;
  exerciseCount: number;
}

/** A logged set together with what it was done on. */
export interface SetWithExercise {
  set: WorkoutSet;
  exercise: Exercise;
  equipment: Equipment;
}

/** All sets of one exercise within a workout, in the order they were logged. */
export interface ExerciseGroup {
  exercise: Exercise;
  equipment: Equipment;
  sets: WorkoutSet[];
}

export interface CompletedWorkoutDetail {
  workout: Workout;
  groups: ExerciseGroup[];
}

/**
 * Groups sets by exercise. Exercises appear in the order they were FIRST logged,
 * and sets keep their logging order inside each group.
 * Input must already be sorted by set position.
 */
export function groupSetsByExercise(items: SetWithExercise[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  for (const { set, exercise, equipment } of items) {
    let group = groups.get(exercise.id);
    if (!group) {
      group = { exercise, equipment, sets: [] };
      groups.set(exercise.id, group);
    }
    group.sets.push(set);
  }
  return [...groups.values()];
}

/** A length of time in words: "Under 1 min", "45 min", "1 h", "1 h 5 min". */
export function formatSpan(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'Under 1 min';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * How long a workout lasted, start to finish, from two UTC ISO timestamps. Pauses are
 * included — see `formatPaused` for showing how much of it was paused.
 */
export function formatDuration(startedAt: string, finishedAt: string): string {
  return formatSpan(Date.parse(finishedAt) - Date.parse(startedAt));
}

/** "5 min paused", or null when the workout was paused for less than a minute in total. */
export function formatPaused(pausedMs: number): string | null {
  return pausedMs >= 60_000 ? `${formatSpan(pausedMs)} paused` : null;
}

/** "1 set", "3 sets" — and the same for any other noun. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
