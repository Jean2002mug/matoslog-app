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
- `src/app/` routes and layouts only
- `src/domain/` types, validation, weight rules (pure TS, no React, no SQL)
- `src/services/` CatalogService, WorkoutService; return typed results
- `src/data/` repository interfaces, expo-sqlite adapters, migrations, seeds
- `src/features/{catalog,workout,history}/` UI per feature
- `tests/`
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
- UI must be catalog-driven: a new equipment row with an existing weight
  convention must work with zero screen changes (AT-11)

## Scope guard
Out of v1: auth, Supabase, sync, charts, rest timer, lb units, sensors, custom exercises.
If a task seems to need one of these, stop and ask.

## Workflow
- `main` stays stable. Branches: `feat/catalog`, `feat/workout`, `feat/history`
- Small commits, one slice per PR
- Write or update tests in the same change as the code
- Reference requirement IDs (FR-xx, BR-xx, AT-xx) in commit messages and test names
- Never commit credentials
- Briefly explain non-obvious decisions in the PR description; I must be able to
  explain every one of them in an interview
