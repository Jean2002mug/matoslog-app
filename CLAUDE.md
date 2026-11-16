# MatosLog

Equipment-first, offline workout logger. Solo interview prototype; v1 only.
Full spec lives in `docs/` (ML-01 overview, ML-02 plan, ML-03 requirements, ML-04 design).
Read the relevant doc section before implementing a slice; do not restate it here.
NOTE: the ML-01 to ML-04 files are not in `docs/` yet. Add them before relying on requirement IDs.

## Stack
- Expo (latest stable SDK) + React Native + TypeScript (strict)
- Expo Router for navigation, expo-sqlite for persistence
- Jest for tests
- Install native packages with `npx expo install <pkg>`, never plain `npm install`

## Commands
- `npx expo start` — run the app
- `npm run typecheck` — tsc --noEmit
- `npm run lint`
- `npm test`

Run typecheck, lint and tests after every change. A task is not done until all three pass.

## Architecture (do not break)
Screen -> Service -> Repository interface -> SQLite adapter.
- `src/app/` routes and layouts only. Each native tab is a folder with its own Stack (Expo's
  documented pattern): `(equipment)/` (a group, URL `/`), `history/` and `settings/`
- Every screen's first child must be `ScreenScrollView` (`src/components/ui/`), not a wrapped
  list or FlatList; otherwise iOS hides content under the header and scroll-to-top breaks
- `src/domain/` types, validation, weight and timer rules (pure TS, no React, no SQL).
  Timer changes are pure functions (`src/domain/timer.ts`) on timestamps, never tick counting
- `src/services/` CatalogService, WorkoutService, SettingsService; return typed results.
  All share ONE `OperationQueue` (built in `create-services.ts`) so writes never interleave
- `src/data/` repository interfaces, expo-sqlite adapters, migrations, seeds
- `src/features/{catalog,workout,history,settings}/` UI per feature
- `tests/` — data-layer tests run the real SQL in Jest via `tests/helpers/node-sqlite-db.ts`
  (Node's built-in `node:sqlite`); the data layer depends on the small `Db` type in `src/data/db.ts`.
  Screen tests render through `tests/helpers/render-app.tsx`
- Services are created once in `src/features/services-provider.tsx`; screens get them with `useServices()`
- The active workout (sets + timers) is held once for the whole app in
  `src/features/workout/active-workout-provider.tsx`; screens use `useActiveWorkout()` and change it
  with `run(() => service.method())`
- Service methods are arrow-function properties so they keep `this` when passed around
- No raw SQL outside `src/data/`. Parameterized queries only.

## Data rules
- UUID text primary keys; stable hard-coded IDs for seed rows
- Weight stored as integer centi-kg (10.25 kg = 1025); kg is the only unit
- Timestamps stored as UTC ISO-8601, displayed in device-local time
- `PRAGMA foreign_keys = ON` on every connection
- Schema version in `PRAGMA user_version`; migrations run in a transaction; never destructive
- Seeds are insert-if-absent and repeatable
- One active workout at most, enforced by a partial unique index
- Start, every mutation, finish and discard run in an explicit transaction and
  re-check active status inside it; roll back on any failure
- Completed workouts are immutable
- Timer state (pause, rest) is stored as columns on the active workout row: it survives a
  restart, is cleared on finish, and is deleted with the workout on cancel
- Paused time counts in a workout's duration; History also shows how much was paused
- UI must be catalog-driven: a new equipment row with an existing weight
  convention must work with zero screen changes (AT-11)

## Scope guard
Out of v1: auth, Supabase, sync, charts, lb units, sensors, custom exercises.
If a task seems to need one of these, stop and ask.
In v1 by owner decision (2026-11-14): workout clock and rest timer (foreground only;
no background notifications).
Owner decisions (2026-11-16): cancelling the workout timer discards the workout; cancelling the
rest timer only stops the rest; both ask first, with a "Don't ask again" option (re-enabled in
Settings). Rest length per exercise: recommended first, customizable.

## Workflow
- `main` stays stable. Branches: `feat/catalog`, `feat/workout`, `feat/history`, `feat/timers`,
  `feat/timer-controls`
- Small commits, one slice per PR
- Write or update tests in the same change as the code
- Reference requirement IDs (FR-xx, BR-xx, AT-xx) in commit messages and test names
- Never commit credentials
- Briefly explain non-obvious decisions in the PR description; I must be able to
  explain every one of them in an interview
