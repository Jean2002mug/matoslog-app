import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SEED_EXERCISES } from '@/data/seed-data';
import { SettingsScreen } from '@/features/settings/settings-screen';
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

let db: TestDb;
let services: Services;

beforeEach(async () => {
  db = await createInitializedTestDb();
  services = createServices(db, { newId: () => 'x', now: () => new Date() });
});
afterEach(() => db.close());

describe('Settings screen', () => {
  it('lists every exercise with its rest, marked recommended or custom', async () => {
    await services.settings.setCustomRest(squat.id, 60_000);
    await renderApp(<SettingsScreen />, services);

    expect(await screen.findByText('Barbell · 1:00 · Custom')).toBeTruthy();
    expect(screen.getByText('Barbell · 3:00 · Recommended')).toBeTruthy(); // Deadlift
    expect(screen.getAllByText('Dumbbells · 1:30 · Recommended')).toHaveLength(2);
    expect(screen.root?.type).toBe('RCTScrollView');
  });

  it('"Use recommended" removes a custom rest', async () => {
    const user = userEvent.setup();
    await services.settings.setCustomRest(squat.id, 60_000);
    await renderApp(<SettingsScreen />, services);

    await user.press(await screen.findByLabelText('Use recommended rest for Back Squat'));
    expect(await screen.findByText('Barbell · 2:30 · Recommended')).toBeTruthy();
  });

  it('turns a "Don’t ask again" choice back on', async () => {
    await services.settings.setFlag('confirmCancelWorkout', false);
    await renderApp(<SettingsScreen />, services);

    const toggle = await screen.findByLabelText('Ask before cancelling a workout');
    expect(toggle.props.value).toBe(false);

    // Switches respond to a value change, not a press.
    await fireEvent(toggle, 'valueChange', true);

    const flags = await services.settings.getFlags();
    expect(flags.ok && flags.value.confirmCancelWorkout).toBe(true);
  });
});
