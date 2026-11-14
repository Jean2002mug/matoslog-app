import { act, render, screen, userEvent } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { Vibration } from 'react-native';

import { SEED_EXERCISES } from '@/data/seed-data';
import { SqliteCatalogRepository } from '@/data/sqlite-catalog-repository';
import { SqliteWorkoutRepository } from '@/data/sqlite-workout-repository';
import { EquipmentList } from '@/features/catalog/equipment-list';
import { ServicesContext, type Services } from '@/features/services-provider';
import { RestTimerProvider } from '@/features/workout/rest-timer-provider';
import { SetLogger } from '@/features/workout/set-logger';
import { CatalogService } from '@/services/catalog-service';
import { WorkoutService } from '@/services/workout-service';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

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

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;

let db: TestDb;
let services: Services;
let vibrate: ReturnType<typeof jest.spyOn>;

beforeEach(async () => {
  // Fake timers control both setInterval/setTimeout AND Date.now(), so time can be fast-forwarded.
  jest.useFakeTimers({ now: new Date('2026-11-14T10:00:00.000Z') });
  vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});

  db = await createInitializedTestDb();
  let id = 0;
  const catalogRepository = new SqliteCatalogRepository(db);
  services = {
    catalog: new CatalogService(catalogRepository),
    workout: new WorkoutService(
      new SqliteWorkoutRepository(db, { newId: () => `id-${++id}`, now: () => new Date() }),
      catalogRepository,
    ),
  };
});

afterEach(() => {
  db.close();
  vibrate.mockRestore();
  jest.useRealTimers();
});

const renderApp = (ui: ReactNode) =>
  render(
    <ServicesContext value={services}>
      <RestTimerProvider>{ui}</RestTimerProvider>
    </ServicesContext>,
  );

/** Moves the clock forward and lets React redraw. */
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

async function addSquatSet() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderApp(<SetLogger exerciseId={squat.id} />);
  await user.type(await screen.findByLabelText('Weight in kg'), '100');
  await user.type(screen.getByLabelText('Reps'), '5');
  await user.press(screen.getByText('Add set'));
  await screen.findByText('Set 1 · 100 kg × 5');
  return user;
}

describe('rest timer', () => {
  it('starts at 1:30 after adding a set and counts down', async () => {
    await addSquatSet();

    expect(await screen.findByLabelText('Rest time left 1:30')).toBeTruthy();
    await wait(30_000);
    expect(screen.getByLabelText('Rest time left 1:00')).toBeTruthy();
  });

  it('can be lengthened, shortened and skipped', async () => {
    const user = await addSquatSet();
    await screen.findByLabelText('Rest time left 1:30');

    await user.press(screen.getByLabelText('Add 15 seconds'));
    expect(await screen.findByLabelText('Rest time left 1:45')).toBeTruthy();

    await user.press(screen.getByLabelText('Remove 15 seconds'));
    await user.press(screen.getByLabelText('Remove 15 seconds'));
    expect(await screen.findByLabelText('Rest time left 1:15')).toBeTruthy();

    await user.press(screen.getByText('Skip'));
    expect(screen.queryByText('Rest')).toBeNull();
  });

  it('says "Next set!" and vibrates once when the rest is over', async () => {
    const user = await addSquatSet();
    await screen.findByLabelText('Rest time left 1:30');

    await wait(90_000);
    expect(screen.getByText('Next set!')).toBeTruthy();
    expect(vibrate).toHaveBeenCalledTimes(1);

    await user.press(screen.getByText('Dismiss'));
    expect(screen.queryByText('Next set!')).toBeNull();
  });

  it('does not vibrate late if the rest ended long ago (app was in the background)', async () => {
    await addSquatSet();
    await screen.findByLabelText('Rest time left 1:30');

    // Jump the clock past the end WITHOUT running timers, like a phone pausing the app.
    jest.setSystemTime(Date.now() + 10 * 60_000);
    await wait(1_000);

    expect(screen.getByText('Next set!')).toBeTruthy();
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('workout clock', () => {
  it('shows how long the workout has been running on the set logger', async () => {
    await addSquatSet();
    expect(await screen.findByLabelText('Workout time 0:00')).toBeTruthy();

    await wait(65_000);
    expect(screen.getByLabelText('Workout time 1:05')).toBeTruthy();
  });

  it('keeps ticking on the Equipment banner, together with the rest timer', async () => {
    await services.workout.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    await act(() => jest.advanceTimersByTime(12 * 60_000 + 34_000));
    await renderApp(<EquipmentList />);

    expect(await screen.findByLabelText('Workout time 12:34')).toBeTruthy();
    await wait(1_000);
    expect(screen.getByLabelText('Workout time 12:35')).toBeTruthy();
  });

  it('stops the rest timer when the workout is finished', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await services.workout.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    await renderApp(
      <>
        <SetLogger exerciseId={squat.id} />
        <EquipmentList />
      </>,
    );

    // Log a second set to start a rest, then finish from the banner.
    await user.type(await screen.findByLabelText('Weight in kg'), '100');
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.press(screen.getByText('Add set'));
    expect((await screen.findAllByLabelText('Rest time left 1:30')).length).toBeGreaterThan(0);

    await user.press(await screen.findByText('Finish'));
    await user.press(screen.getByText('Yes, finish'));

    await wait(1_000);
    expect(screen.queryAllByLabelText(/Rest time left/)).toHaveLength(0);
  });
});
