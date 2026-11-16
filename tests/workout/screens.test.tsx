import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SEED_EXERCISES, EQUIPMENT_IDS } from '@/data/seed-data';
import { EquipmentList } from '@/features/catalog/equipment-list';
import { ExerciseList } from '@/features/catalog/exercise-list';
import { SetLogger } from '@/features/workout/set-logger';
import { createServices, type Services } from '@/services/create-services';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';
import { renderApp } from '../helpers/render-app';

// Native modules and navigation aren't available in Jest; replace them with simple stand-ins.
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: { Screen: () => null },
    // Run the "screen came into view" effect once, like a screen opening.
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    Link: ({ children }: { children: ReactNode }) => children,
  };
});

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!;

let db: TestDb;
let services: Services;

beforeEach(async () => {
  db = await createInitializedTestDb();
  let id = 0;
  services = createServices(db, { newId: () => `id-${++id}`, now: () => new Date() });
});
afterEach(() => db.close());

const renderWithServices = (ui: ReactNode) => renderApp(ui, services);

const setCount = () =>
  (db.raw.prepare('SELECT COUNT(*) AS n FROM workout_set').get() as { n: number }).n;

/**
 * Guards the bug that made the top of each screen unreachable on iOS: the screen's
 * first native view must be a scroll view that adjusts its insets for the header and tab bar.
 */
async function expectScrollViewIsFirstChild() {
  const root = screen.root;
  expect(root?.type).toBe('RCTScrollView'); // the native view behind <ScrollView>
  expect(root?.props.contentInsetAdjustmentBehavior).toBe('automatic');
}

describe('Equipment screen', () => {
  it('shows BOTH pieces of equipment, first one included, inside a top-level scroll view', async () => {
    await renderWithServices(<EquipmentList />);

    expect(await screen.findByText('Dumbbells')).toBeTruthy();
    expect(screen.getByText('Barbell')).toBeTruthy();
    await expectScrollViewIsFirstChild();
  });
});

describe('Exercises screen', () => {
  it('lists the barbell exercises inside a top-level scroll view', async () => {
    await renderWithServices(<ExerciseList equipmentId={EQUIPMENT_IDS.barbell} />);

    expect(await screen.findByText('Back Squat')).toBeTruthy();
    expect(screen.getByText('Deadlift')).toBeTruthy();
    await expectScrollViewIsFirstChild();
  });
});

describe('Log sets screen', () => {
  it('adds a set when you type weight and reps and tap "Add set"', async () => {
    const user = userEvent.setup();
    await renderWithServices(<SetLogger exerciseId={squat.id} />);

    await user.type(await screen.findByLabelText('Weight in kg'), '100');
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.press(screen.getByText('Add set'));

    expect(await screen.findByText('Set 1 · 100 kg × 5')).toBeTruthy();
    expect(setCount()).toBe(1);
    await expectScrollViewIsFirstChild();
  });

  it('shows why a set was rejected, and saves nothing', async () => {
    const user = userEvent.setup();
    await renderWithServices(<SetLogger exerciseId={squat.id} />);

    await user.type(await screen.findByLabelText('Weight in kg'), '15');
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.press(screen.getByText('Add set'));

    expect(await screen.findByText('Total weight must be at least the 20 kg bar.')).toBeTruthy();
    expect(setCount()).toBe(0);
  });

  it('deletes a set', async () => {
    const user = userEvent.setup();
    await renderWithServices(<SetLogger exerciseId={squat.id} />);

    await user.type(await screen.findByLabelText('Weight in kg'), '100');
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.press(screen.getByText('Add set'));
    await screen.findByText('Set 1 · 100 kg × 5');

    await user.press(screen.getByLabelText('Delete set 1'));

    expect(await screen.findByText('No sets yet for this exercise.')).toBeTruthy();
    expect(setCount()).toBe(0);
  });
});

describe('Active workout banner', () => {
  it('finishes the workout after confirmation', async () => {
    const user = userEvent.setup();
    await services.workout.addSet({ exerciseId: squat.id, weightText: '100', repsText: '5' });
    await renderWithServices(<EquipmentList />);

    expect(await screen.findByText('Workout in progress')).toBeTruthy();
    expect(screen.getByText('1 set')).toBeTruthy();
    await user.press(screen.getByText('Finish'));
    await user.press(await screen.findByText('Finish workout'));

    await waitFor(() => expect(screen.queryByText(/Workout in progress/)).toBeNull());
    expect(db.raw.prepare('SELECT status FROM workout').get()).toEqual({ status: 'completed' });
  });
});
