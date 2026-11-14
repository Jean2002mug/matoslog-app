import { describe, expect, it } from '@jest/globals';

import {
  adjustRestEnd,
  elapsedSince,
  formatClock,
  MAX_REST_MS,
  MIN_REST_MS,
  restRemaining,
} from '@/domain/timer';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5_000, '0:05'],
    [90_000, '1:30'],
    [754_000, '12:34'],
    [3_723_000, '1:02:03'],
    [999, '0:00'], // partial seconds round down
    [-5_000, '0:00'], // never negative
  ])('%i ms is "%s"', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });
});

describe('elapsedSince', () => {
  it('measures from the stored start time', () => {
    const start = '2026-11-14T10:00:00.000Z';
    expect(elapsedSince(start, Date.parse('2026-11-14T10:12:34.000Z'))).toBe(754_000);
  });

  it('is never negative (e.g. device clock moved backwards)', () => {
    expect(elapsedSince('2026-11-14T10:00:00.000Z', Date.parse('2026-11-14T09:59:00.000Z'))).toBe(0);
  });
});

describe('restRemaining', () => {
  it('rounds UP to whole seconds so "0:00" means the rest is really over', () => {
    expect(restRemaining(10_000, 9_001)).toBe(1_000);
    expect(restRemaining(10_000, 9_999)).toBe(1_000);
    expect(restRemaining(10_000, 10_000)).toBe(0);
  });

  it('is correct after a long pause (e.g. app was in the background)', () => {
    expect(restRemaining(90_000, 500_000)).toBe(0);
  });
});

describe('adjustRestEnd', () => {
  const now = 1_000_000;

  it('adds or removes time from what is left', () => {
    expect(adjustRestEnd(now + 60_000, 15_000, now)).toBe(now + 75_000);
    expect(adjustRestEnd(now + 60_000, -15_000, now)).toBe(now + 45_000);
  });

  it('keeps the rest between the minimum and maximum', () => {
    expect(adjustRestEnd(now + 20_000, -15_000, now)).toBe(now + MIN_REST_MS);
    expect(adjustRestEnd(now + MAX_REST_MS, 15_000, now)).toBe(now + MAX_REST_MS);
  });

  it('+15 s on a rest that already ran out starts a fresh short rest', () => {
    expect(adjustRestEnd(now - 5_000, 15_000, now)).toBe(now + 15_000);
  });
});
