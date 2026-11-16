# MatosLog

An **equipment-first, offline workout logger** for iOS and Android, built with Expo and React Native.

You start from the equipment in front of you (dumbbells, a barbell), pick an exercise, and log
weight and reps. Everything is stored on the device in SQLite: no account, no network.

> Solo prototype (v1). Scope is intentionally small: see [Scope](#scope).

## Features

- **Equipment catalog:** Dumbbells (Dumbbell Bench Press, Dumbbell Row) and Barbell
  (Back Squat, Deadlift), seeded on first launch.
- **Equipment-aware weights:** dumbbell weight is entered *per dumbbell*. Barbell weight is the
  *total*, including the 20 kg bar, and can't be lower than the bar.
- **Workout logging:** logging the first set starts a workout. The form is pre-filled with the
  weight and reps from last time. Delete a wrong set, then finish the workout.
- **Workout timer:** a live clock with **Pause/Resume**, **Finish** and **Cancel**. Cancel
  discards the whole workout, after asking.
- **Rest timer:** starts after each set, with **Pause/Resume**, **Reset**, **±15 s** and
  **Cancel**. Cancel stops only the rest, after asking. It vibrates once when the rest is over.
- **Recommended rest times:** each exercise has a recommendation (2:30 for squats, 3:00 for
  deadlifts, 1:30 for dumbbell lifts) that you can change per exercise or reset.
- **"Don't ask again":** each cancel question can be skipped from then on, and switched back on
  in **Settings**.
- **History:** finished workouts, newest first, with exercises, sets, duration and time paused.
  Each workout shows its sets grouped by exercise. Finished workouts are read-only.
- **Fully offline:** workouts, timers (even a paused rest) and settings are saved on the phone
  and survive closing the app.

## Getting started

Requirements: [Node.js](https://nodejs.org/) 22.13 or newer (the tests use its built-in
`node:sqlite`; tested on Node 24), and the
[Expo Go](https://expo.dev/go) app on your phone (or an iOS simulator / Android emulator).

```bash
git clone https://github.com/Jean2002mug/matoslog-app.git
cd matoslog-app
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

| Command | What it does |
|---|---|
| `npx expo start` | Start the dev server |
| `npm test` | Run the Jest test suite |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run lint` | Lint with ESLint (`expo lint`) |

## Tech stack

- [Expo](https://expo.dev) SDK 58, React Native 0.88, React 19, TypeScript (strict)
- [Expo Router](https://docs.expo.dev/router/introduction/): file-based routing with native tabs
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for storage,
  [expo-crypto](https://docs.expo.dev/versions/latest/sdk/crypto/) for UUIDs
- Jest + [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)

## Architecture

Each layer only talks to the one below it:

```
Screen  ->  Service  ->  Repository interface  ->  SQLite adapter
(React)     (rules,      (what data exists)        (the only place
            typed                                   with SQL)
            results)
```

```
src/
  app/          Routes only (Expo Router). One folder + Stack per tab:
                (equipment)/ -> Equipment, Exercises, Log sets
                history/     -> History, Workout detail
                settings/    -> Settings
  domain/       Pure TypeScript: types, weight and timer rules, history helpers (no React, no SQL)
  services/     CatalogService, WorkoutService, SettingsService: validate input, return typed
                Results; all share one OperationQueue
  data/         Repository interfaces, SQLite adapters, migrations, seed data
  features/     Screen components per feature (catalog, workout, history, settings)
  components/   Shared UI (buttons, list rows, confirm dialog, the screen scroll view)
tests/          Jest tests, mirroring the features
```

### Data rules

- **Weights are integers in centi-kg** (22.5 kg is stored as `2250`). Typed weights are parsed
  as text, never with floating-point math, because `0.1 + 0.2 !== 0.3`.
- **UTC ISO-8601 timestamps** in storage, shown in the device's local time.
- **Versioned migrations** using `PRAGMA user_version`. Each step runs in a transaction and
  never drops data.
- **Repeatable seed:** fixed IDs plus `INSERT OR IGNORE`, so every launch is safe.
- **At most one active workout:** enforced by a partial unique index in the database itself.
- **Finished workouts are immutable:** the service checks this, and database triggers block
  changes even from raw SQL.
- **Every write is one transaction** and re-checks the active workout inside it. All services
  share one queue, so two writes can never interleave. This matters because expo-sqlite's
  transactions aren't exclusive.
- **Timers count from timestamps, not ticks.** Phones pause JavaScript timers in the background,
  so the clock and rest are computed from saved times ("started at", "paused at", "ends at").
  They're still correct when you come back, and every change is a small pure function.
- **Timers belong to the workout:** they're stored on the workout's row. Finishing clears them,
  and cancelling the workout deletes them along with it.
- **Catalog-driven UI:** weight rules come from the equipment's data. A new equipment row that
  uses an existing rule (say, an EZ bar with a 10.25 kg bar) works with no code changes.

## Testing

```bash
npm test
```

- **Data-layer tests run the real SQL.** `tests/helpers/node-sqlite-db.ts` wraps Node's built-in
  `node:sqlite` so it looks like expo-sqlite. The app's actual migrations, constraints, indexes
  and triggers run in Jest, with no device needed.
- **Screen tests** use React Native Testing Library. For example, they type a weight and reps,
  tap "Add set", and check that the set appears. Timer tests fast-forward a fake clock to check
  pauses, resets, cancels and the single vibration, including after "closing the app".
- **Domain tests** cover weight parsing, the rules for each piece of equipment, the timer
  functions, and history formatting.

## Scope

**In v1:** the catalog, workout logging, timers and history described above. kg only.

**Out of v1:** accounts, cloud sync, charts, lb units, custom exercises.

### Known limitations

- **Web isn't supported yet.** expo-sqlite needs extra Metro configuration (WASM) and
  cross-origin headers to run in a browser.
- **The rest timer only alerts while the app is open.** If the app is in the background when rest
  ends, there's no notification; the timer shows the right time when you come back.
- **The app icon and splash screen** are still Expo's default artwork. They need a designed icon.

## License

[MIT](LICENSE) © 2026 Jean Mugabe. Parts of the project come from the Expo starter template,
also MIT-licensed.
