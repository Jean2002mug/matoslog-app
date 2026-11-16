import { act, screen, userEvent } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { Vibration } from 'react-native';

import { SEED_EXERCISES } from '@/data/seed-data';
import { EquipmentList } from '@/features/catalog/equipment-list';
import { SetLogger } from '@/features/workout/set-logger';
import { createServices, type Services } from '@/services/create-services';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';
import { renderApp } from '../helpers/render-app';

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: { Screen: () => null },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    Link: ({ children }: { children: ReactNode }) => children,
  };
});

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!; // recommended rest 2:30
const press = SEED_EXERCISES.find((x) => x.name === 'Dumbbell Bench Press')!; // recommended 1:30

let db: TestDb;
let services: Services;
let vibrate: ReturnType<typeof jest.spyOn>;

beforeEach(async () => {
  // Fake timers control setInterval/setTimeout AND Date.now(), so time can be fast-forwarded.
  jest.useFakeTimers({ now: new Date('2026-11-16T10:00:00.000Z') });
  vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  db = await createInitializedTestDb();
  let id = 0;
  services = createServices(db, { newId: () => `id-${++id}`, now: () => new Date() });
});

afterEach(() => {
  db.close();
  vibrate.mockRestore();
  jest.useRealTimers();
});

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/** Moves the clock forward and lets React redraw. */
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const workoutRow = () =>
  db.raw.prepare('SELECT * FROM workout').get() as Record<string, unknown> | undefined;
const count = (table: string) =>
  (db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

async function openLoggerAndAddSet(exerciseId = squat.id) {
  const user = setupUser();
  await renderApp(<SetLogger exerciseId={exerciseId} />, services);
  await user.type(await screen.findByLabelText('Weight in kg'), '100');
  await user.type(screen.getByLabelText('Reps'), '5');
  await user.press(screen.getByText('Add set'));
  await screen.findByText('Set 1 · 100 kg × 5');
  return user;
}

describe('rest timer: recommended length', () => {
  it('starts at the exercise’s recommended rest (2:30 for Back Squat) and counts down', async () => {
    await openLoggerAndAddSet();
    expect(await screen.findByLabelText('Rest time left 2:30')).toBeTruthy();
    await wait(30_000);
    expect(screen.getByLabelText('Rest time left 2:00')).toBeTruthy();
  });

  it('shows the recommendation, and a custom choice is used from the next set', async () => {
    const user = setupUser();
    await renderApp(<SetLogger exerciseId={press.id} />, services);

    expect(await screen.findByLabelText('Rest after each set 1:30, recommended')).toBeTruthy();
    await user.press(screen.getByLabelText('Change rest'));
    await user.press(screen.getByLabelText('Rest 2:00'));
    expect(await screen.findByLabelText('Rest after each set 2:00')).toBeTruthy();

    await user.type(screen.getByLabelText('Weight in kg'), '22.5');
    await user.type(screen.getByLabelText('Reps'), '10');
    await user.press(screen.getByText('Add set'));
    expect(await screen.findByLabelText('Rest time left 2:00')).toBeTruthy();

    // "Use recommended" removes the custom choice.
    await user.press(screen.getByText('Use recommended (1:30)'));
    expect(await screen.findByLabelText('Rest after each set 1:30, recommended')).toBeTruthy();
    expect(count('exercise_rest_setting')).toBe(0);
  });
});

describe('rest timer: controls', () => {
  it('pauses, resumes, resets, and adjusts by 15 s', async () => {
    const user = await openLoggerAndAddSet();
    await screen.findByLabelText('Rest time left 2:30');

    await wait(30_000);
    await user.press(screen.getByLabelText('Pause rest'));
    expect(await screen.findByText('Rest paused')).toBeTruthy();
    await wait(60_000);
    expect(screen.getByLabelText('Rest time left 2:00')).toBeTruthy(); // didn't move while paused

    await user.press(screen.getByLabelText('Resume rest'));
    await user.press(screen.getByLabelText('Add 15 seconds'));
    expect(await screen.findByLabelText('Rest time left 2:15')).toBeTruthy();

    await user.press(screen.getByLabelText('Reset rest'));
    expect(await screen.findByLabelText('Rest time left 2:30')).toBeTruthy();
  });

  it('Cancel asks first; "Keep going" leaves the rest running', async () => {
    const user = await openLoggerAndAddSet();
    await screen.findByLabelText('Rest time left 2:30');

    await user.press(screen.getByLabelText('Cancel rest'));
    expect(await screen.findByText('Cancel this rest?')).toBeTruthy();
    await user.press(screen.getByText('Keep going'));

    expect(screen.getByLabelText('Rest time left 2:30')).toBeTruthy();
    expect(workoutRow()?.rest_ends_at).not.toBeNull();
  });

  it('cancelling the rest stops only the rest; the workout carries on', async () => {
    const user = await openLoggerAndAddSet();
    await screen.findByLabelText('Rest time left 2:30');

    await user.press(screen.getByLabelText('Cancel rest'));
    await user.press(await screen.findByText('Cancel rest'));

    await wait(0);
    expect(screen.queryByLabelText(/Rest time left/)).toBeNull();
    expect(workoutRow()).toMatchObject({ status: 'active', rest_duration_ms: null });
    expect(count('workout_set')).toBe(1);
  });

  it('"Don’t ask again" is remembered: the next cancel happens straight away', async () => {
    const user = await openLoggerAndAddSet();
    await screen.findByLabelText('Rest time left 2:30');

    await user.press(screen.getByLabelText('Cancel rest'));
    await user.press(await screen.findByRole('checkbox'));
    await user.press(screen.getByText('Cancel rest'));
    await wait(0);

    expect(db.raw.prepare(`SELECT value FROM app_setting WHERE key = 'confirmCancelRest'`).get()).toEqual({
      value: 'false',
    });

    // Next set → new rest → Cancel with no question.
    await user.press(screen.getByText('Add set'));
    await screen.findByLabelText('Rest time left 2:30');
    await user.press(screen.getByLabelText('Cancel rest'));
    await wait(0);
    expect(screen.queryByText('Cancel this rest?')).toBeNull();
    expect(screen.queryByLabelText(/Rest time left/)).toBeNull();
  });

  it('says "Next set!" and vibrates once at zero; never vibrates late after a background pause', async () => {
    const user = await openLoggerAndAddSet(press.id);
    await screen.findByLabelText('Rest time left 1:30');

    await wait(90_000);
    expect(screen.getByText('Next set!')).toBeTruthy();
    expect(vibrate).toHaveBeenCalledTimes(1);
    await user.press(screen.getByText('Dismiss'));
    expect(await screen.findByText('Set 1 · 100 kg × 5')).toBeTruthy();

    // Second rest: jump past its end WITHOUT running timers, like a phone pausing the app.
    await user.press(screen.getByText('Add set'));
    await screen.findByLabelText('Rest time left 1:30');
    jest.setSystemTime(Date.now() + 10 * 60_000);
    await wait(1_000);
    expect(screen.getByText('Next set!')).toBeTruthy();
    expect(vibrate).toHaveBeenCalledTimes(1); // no late second buzz
  });
});

describe('workout timer: controls', () => {
  it('pauses (clock freezes, rest pauses with it) and resumes', async () => {
    const user = await openLoggerAndAddSet();
    await wait(65_000);
    expect(screen.getByLabelText('Workout time 1:05')).toBeTruthy();

    await user.press(screen.getByLabelText('Pause workout'));
    expect(await screen.findByLabelText('Workout time 1:05, paused')).toBeTruthy();
    expect(screen.getByText(/Paused with the workout/)).toBeTruthy();
    await wait(120_000);
    expect(screen.getByLabelText('Workout time 1:05, paused')).toBeTruthy();

    await user.press(screen.getByLabelText('Resume workout'));
    await wait(5_000);
    expect(screen.getByLabelText('Workout time 1:10')).toBeTruthy();
  });

  it('adding a set while paused resumes the workout', async () => {
    const user = await openLoggerAndAddSet();
    await user.press(screen.getByLabelText('Pause workout'));
    await screen.findByLabelText(/paused/);

    await user.press(screen.getByText('Add set'));
    await screen.findByText('Set 2 · 100 kg × 5');
    expect(workoutRow()?.paused_at).toBeNull();
  });

  it('Cancel on the workout timer asks, then deletes the workout, its sets and its timers', async () => {
    await services.workout.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    const user = setupUser();
    await renderApp(<EquipmentList />, services);
    await screen.findByText('Workout in progress');

    await user.press(screen.getByLabelText('Cancel workout'));
    expect(await screen.findByText('Cancel this workout?')).toBeTruthy();
    await user.press(screen.getByText('Cancel workout'));
    await wait(0);

    expect(screen.queryByText('Workout in progress')).toBeNull();
    expect(count('workout')).toBe(0);
    expect(count('workout_set')).toBe(0);
  });

  it('the workout clock and rest keep counting on the Equipment tab', async () => {
    await services.workout.addSet({ exerciseId: press.id, weightText: '22.5', repsText: '10' });
    await act(() => jest.advanceTimersByTime(12 * 60_000 + 34_000));
    await renderApp(<EquipmentList />, services);

    expect(await screen.findByLabelText('Workout time 12:34')).toBeTruthy();
    await wait(1_000);
    expect(screen.getByLabelText('Workout time 12:35')).toBeTruthy();
  });
});

describe('offline persistence', () => {
  it('a paused workout and a paused rest survive "closing the app"', async () => {
    const user = await openLoggerAndAddSet();
    await wait(20_000);
    await user.press(screen.getByLabelText('Pause workout'));
    await screen.findByLabelText('Workout time 0:20, paused');
    await screen.unmount();

    // Ten minutes later, the app is opened again: a fresh screen reading the same database.
    await act(() => jest.advanceTimersByTime(10 * 60_000));
    await renderApp(<SetLogger exerciseId={squat.id} />, services);
    expect(await screen.findByLabelText('Workout time 0:20, paused')).toBeTruthy();
    expect(screen.getByLabelText('Rest time left 2:10')).toBeTruthy();
  });

  it('pre-fills weight and reps from the last time this exercise was done', async () => {
    await services.workout.addSet({ exerciseId: squat.id, weightText: '102.5', repsText: '3' });
    await services.workout.finishWorkout();

    await renderApp(<SetLogger exerciseId={squat.id} />, services);
    expect(await screen.findByDisplayValue('102.5')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });
});
