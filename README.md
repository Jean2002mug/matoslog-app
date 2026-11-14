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
- **Workout logging:** logging the first set starts a workout. Delete a wrong set, then finish
  or discard the workout, with confirmation.
- **History:** finished workouts, newest first, with exercises, sets and duration. Each workout
  shows its sets grouped by exercise. Finished workouts are read-only.

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
  domain/       Pure TypeScript: types, weight rules, history helpers (no React, no SQL)
  services/     CatalogService, WorkoutService: validate input, return typed Results
  data/         Repository interfaces, SQLite adapters, migrations, seed data
  features/     Screen components per feature (catalog, workout, history)
  components/   Shared UI (buttons, list rows, the screen scroll view)
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
- **Every write is one transaction** and re-checks the active workout inside it.
  `WorkoutService` also queues operations so two writes can never interleave.
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
  tap "Add set", and check that the set appears.
- **Domain tests** cover weight parsing, the rules for each piece of equipment, and history
  formatting.

## Scope

**In v1:** the catalog, workout logging and history described above. kg only.

**Out of v1:** accounts, cloud sync, charts, rest timer, lb units, custom exercises.

### Known limitations

- **Web isn't supported yet.** expo-sqlite needs extra Metro configuration (WASM) and
  cross-origin headers to run in a browser.
- **Tab icons** are placeholders from the Expo starter.

## License

See [LICENSE](LICENSE).
