import { describe, expect, it } from '@jest/globals';

import {
  adjustRest,
  effectiveRestMs,
  finishTimers,
  formatClock,
  MAX_REST_MS,
  MIN_REST_MS,
  NO_TIMERS,
  pauseRest,
  pauseWorkout,
  pausedSoFar,
  resetRest,
  restRemaining,
  resumeRest,
  resumeWorkout,
  startRest,
  workoutActiveMs,
  type WorkoutTimers,
} from '@/domain/timer';

const T0 = Date.parse('2026-11-16T10:00:00.000Z');
const START = new Date(T0).toISOString();
const at = (seconds: number) => T0 + seconds * 1000;

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5_000, '0:05'],
    [90_000, '1:30'],
    [754_000, '12:34'],
    [3_723_000, '1:02:03'],
    [999, '0:00'],
    [-5_000, '0:00'],
  ])('%i ms is "%s"', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });
});

describe('workout clock with pauses', () => {
  it('runs from the start time', () => {
    expect(workoutActiveMs(START, NO_TIMERS, at(754))).toBe(754_000);
  });

  it('freezes while paused, and leaves the paused time out once resumed', () => {
    const paused = pauseWorkout(NO_TIMERS, at(60)); // pause at 1:00
    expect(workoutActiveMs(START, paused, at(60))).toBe(60_000);
    expect(workoutActiveMs(START, paused, at(300))).toBe(60_000); // still 1:00 four minutes later

    const resumed = resumeWorkout(paused, at(300)); // resume at 5:00 → 4 min paused
    expect(resumed.pausedMs).toBe(240_000);
    expect(workoutActiveMs(START, resumed, at(330))).toBe(90_000); // 1:00 + 0:30
  });

  it('adds up several pauses', () => {
    let t: WorkoutTimers = NO_TIMERS;
    t = resumeWorkout(pauseWorkout(t, at(10)), at(20)); // 10 s
    t = resumeWorkout(pauseWorkout(t, at(30)), at(60)); // 30 s
    expect(t.pausedMs).toBe(40_000);
  });

  it('pausing or resuming twice changes nothing', () => {
    const paused = pauseWorkout(NO_TIMERS, at(10));
    expect(pauseWorkout(paused, at(50))).toBe(paused);
    expect(resumeWorkout(NO_TIMERS, at(50))).toBe(NO_TIMERS);
  });

  it('pausing the workout pauses its rest; resuming resumes it', () => {
    const withRest: WorkoutTimers = { ...NO_TIMERS, rest: startRest(90_000, at(0)) };
    const paused = pauseWorkout(withRest, at(30));
    expect(paused.rest).toEqual({ durationMs: 90_000, endsAt: null, remainingMs: 60_000 });

    const resumed = resumeWorkout(paused, at(500));
    expect(restRemaining(resumed.rest!, at(500))).toBe(60_000); // the rest didn't run while paused
  });

  it('finishing closes an open pause (so it counts in History) and clears the rest', () => {
    const t: WorkoutTimers = { ...pauseWorkout(NO_TIMERS, at(60)), rest: startRest(90_000, at(0)) };
    expect(pausedSoFar(t, at(90))).toBe(30_000);
    expect(finishTimers(t, at(90))).toEqual({ pausedAt: null, pausedMs: 30_000, rest: null });
  });
});

describe('rest timer', () => {
  it('counts down, rounded UP so "0:00" means the rest is really over', () => {
    const rest = startRest(15_000, at(0)); // the shortest rest allowed
    expect(restRemaining(rest, at(0) + 999)).toBe(15_000);
    expect(restRemaining(rest, at(14) + 1)).toBe(1_000);
    expect(restRemaining(rest, at(15))).toBe(0);
    expect(restRemaining(rest, at(500))).toBe(0); // after a long time in the background
  });

  it('keeps a new rest within 0:15 and 10:00', () => {
    expect(startRest(1_000, at(0)).durationMs).toBe(MIN_REST_MS);
    expect(startRest(60 * 60_000, at(0)).durationMs).toBe(MAX_REST_MS);
  });

  it('pauses and resumes without losing or gaining time', () => {
    const paused = pauseRest(startRest(90_000, at(0)), at(30))!;
    expect(restRemaining(paused, at(999))).toBe(60_000);
    const resumed = resumeRest(paused, at(1000))!;
    expect(restRemaining(resumed, at(1010))).toBe(50_000);
  });

  it('Reset starts again from the full length, staying paused if it was paused', () => {
    const running = startRest(90_000, at(0));
    expect(restRemaining(resetRest(running, at(60)), at(60))).toBe(90_000);

    const paused = pauseRest(running, at(60))!;
    expect(resetRest(paused, at(70))).toEqual({ durationMs: 90_000, endsAt: null, remainingMs: 90_000 });
  });

  it('±15 s changes what is left, within the limits, running or paused', () => {
    const running = startRest(60_000, at(0));
    expect(restRemaining(adjustRest(running, 15_000, at(0)), at(0))).toBe(75_000);
    expect(restRemaining(adjustRest(running, -15_000, at(50)), at(50))).toBe(MIN_REST_MS);

    const paused = pauseRest(running, at(0))!;
    expect(adjustRest(paused, -15_000, at(0)).remainingMs).toBe(45_000);
  });

  it('+15 s on a rest that already ran out starts a fresh short rest', () => {
    const over = startRest(15_000, at(0));
    expect(restRemaining(adjustRest(over, 15_000, at(100)), at(100))).toBe(15_000);
  });
});

describe('effectiveRestMs', () => {
  it('uses the recommendation unless the user chose their own', () => {
    expect(effectiveRestMs(150_000, null)).toBe(150_000);
    expect(effectiveRestMs(150_000, 60_000)).toBe(60_000);
  });
});
