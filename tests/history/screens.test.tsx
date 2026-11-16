import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SEED_EXERCISES } from '@/data/seed-data';
import { HistoryList } from '@/features/history/history-list';
import { WorkoutDetail } from '@/features/history/workout-detail';
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

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;
const press = SEED_EXERCISES.find((x) => x.name === 'Dumbbell Bench Press')!;

let db: TestDb;
let services: Services;
let clock: Date;

beforeEach(async () => {
  db = await createInitializedTestDb();
  let id = 0;
  clock = new Date('2026-11-12T18:00:00.000Z');
  services = createServices(db, { newId: () => `id-${++id}`, now: () => clock });
});
afterEach(() => db.close());

const renderWithServices = (ui: ReactNode) => renderApp(ui, services);

async function finishAWorkout() {
  await services.workout.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
  await services.workout.addSet({ exerciseId: press.id, weightText: '22.5', repsText: '10' });
  clock = new Date('2026-11-12T18:45:00.000Z');
  await services.workout.finishWorkout();
}

describe('History screen', () => {
  it('explains what to do when nothing is finished yet', async () => {
    await renderWithServices(<HistoryList />);
    expect(await screen.findByText(/No finished workouts yet/)).toBeTruthy();
    expect(screen.root?.type).toBe('RCTScrollView');
  });

  it('lists a finished workout with its counts and duration', async () => {
    await finishAWorkout();
    await renderWithServices(<HistoryList />);

    expect(await screen.findByText('2 exercises · 2 sets · 45 min')).toBeTruthy();
  });
});

describe('Workout detail screen', () => {
  it('shows the sets grouped by exercise, with each equipment’s weight rule', async () => {
    await finishAWorkout();
    await renderWithServices(<WorkoutDetail workoutId="id-1" />);

    expect(await screen.findByText('Back Squat')).toBeTruthy();
    expect(screen.getByText('Barbell · Total weight, including 20 kg bar')).toBeTruthy();
    expect(screen.getByText('Dumbbell Bench Press')).toBeTruthy();
    expect(screen.getByText('Dumbbells · Weight per dumbbell')).toBeTruthy();
    expect(screen.getByText('Set 1 · 100 kg × 5')).toBeTruthy();
    expect(screen.getByText('Set 1 · 22.5 kg × 10')).toBeTruthy();
    expect(screen.root?.type).toBe('RCTScrollView');
  });

  it('says so when the workout does not exist', async () => {
    await renderWithServices(<WorkoutDetail workoutId="missing" />);
    expect(await screen.findByText('Workout not found.')).toBeTruthy();
  });
});
