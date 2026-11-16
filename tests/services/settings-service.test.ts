import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SEED_EXERCISES } from '@/data/seed-data';
import { createServices } from '@/services/create-services';
import type { SettingsService } from '@/services/settings-service';

import { createInitializedTestDb, type TestDb } from '../helpers/node-sqlite-db';

const squat = SEED_EXERCISES.find((x) => x.name === 'Back Squat')!; // recommended 2:30

let db: TestDb;
let settings: SettingsService;

beforeEach(async () => {
  db = await createInitializedTestDb();
  settings = createServices(db, { newId: () => 'x', now: () => new Date() }).settings;
});
afterEach(() => db.close());

describe('rest setting per exercise', () => {
  it('starts at the recommendation', async () => {
    expect(await settings.getRestSetting(squat.id)).toEqual({
      ok: true,
      value: { recommendedMs: 150_000, customMs: null, effectiveMs: 150_000 },
    });
  });

  it('saves a custom rest, kept within 0:15–10:00', async () => {
    const saved = await settings.setCustomRest(squat.id, 60_000);
    expect(saved.ok && saved.value).toEqual({ recommendedMs: 150_000, customMs: 60_000, effectiveMs: 60_000 });

    const tooLong = await settings.setCustomRest(squat.id, 60 * 60_000);
    expect(tooLong.ok && tooLong.value.customMs).toBe(600_000);
  });

  it('choosing the recommended value (or null) removes the custom choice', async () => {
    await settings.setCustomRest(squat.id, 60_000);
    const back = await settings.setCustomRest(squat.id, 150_000);
    expect(back.ok && back.value.customMs).toBeNull();
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM exercise_rest_setting').get()).toEqual({ n: 0 });
  });

  it('reports an unknown exercise', async () => {
    expect(await settings.getRestSetting('nope')).toEqual({ ok: false, error: 'Exercise not found.' });
  });
});

describe('flags', () => {
  it('default to asking before cancelling, and remember changes', async () => {
    expect(await settings.getFlags()).toEqual({
      ok: true,
      value: { confirmCancelWorkout: true, confirmCancelRest: true },
    });
    await settings.setFlag('confirmCancelRest', false);
    await settings.setFlag('confirmCancelRest', false); // saving twice is fine (upsert)
    expect(await settings.getFlags()).toEqual({
      ok: true,
      value: { confirmCancelWorkout: true, confirmCancelRest: false },
    });
  });
});
