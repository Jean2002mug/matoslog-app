import { describe, expect, it } from '@jest/globals';

import { SEED_EQUIPMENT } from '@/data/seed-data';
import type { Equipment } from '@/domain/catalog';
import { parseKg, parseReps, validateSet } from '@/domain/weight';

const [dumbbells, barbell] = SEED_EQUIPMENT;

describe('parseKg', () => {
  it.each([
    ['20', 2000],
    ['22.5', 2250],
    ['10.25', 1025],
    ['22,5', 2250], // comma decimal
    ['  8 ', 800],
    ['0', 0],
    ['10.1', 1010], // Number('10.1') * 100 would give 1009.9999999999999
    ['500', 50000],
  ])('parses "%s" as %i centi-kg', (text, expected) => {
    expect(parseKg(text)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '10.123', '1e3', '.5', '5.', '1000', '10 kg'])(
    'rejects "%s"',
    (text) => {
      expect(parseKg(text)).toBeNull();
    },
  );
});

describe('parseReps', () => {
  it('parses whole numbers', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps(' 12 ')).toBe(12);
  });

  it.each(['', '8.5', '-3', 'ten', '1000'])('rejects "%s"', (text) => {
    expect(parseReps(text)).toBeNull();
  });
});

describe('validateSet', () => {
  it('accepts sensible sets for each equipment', () => {
    expect(validateSet(dumbbells, 2250, 10)).toBeNull();
    expect(validateSet(barbell, 10000, 5)).toBeNull();
    expect(validateSet(barbell, 2000, 5)).toBeNull(); // empty bar is fine
  });

  it('checks reps are 1 to 100', () => {
    const message = 'Reps must be a whole number from 1 to 100.';
    expect(validateSet(dumbbells, 1000, 0)).toBe(message);
    expect(validateSet(dumbbells, 1000, 101)).toBe(message);
    expect(validateSet(dumbbells, 1000, 2.5)).toBe(message);
  });

  it('caps weight at 500 kg', () => {
    expect(validateSet(barbell, 50001, 1)).toBe('Weight must be 500 kg or less.');
  });

  it('per_dumbbell: one dumbbell must weigh more than 0 kg', () => {
    expect(validateSet(dumbbells, 0, 10)).toBe('Enter the weight of one dumbbell (more than 0 kg).');
  });

  it('barbell_total: total must include the bar', () => {
    expect(validateSet(barbell, 1500, 5)).toBe('Total weight must be at least the 20 kg bar.');
  });

  it('AT-11: uses the bar weight from the data, not a hard-coded 20 kg', () => {
    const ezBar: Equipment = { ...barbell, id: 'ez', name: 'EZ Bar', barWeightCg: 1025 };
    expect(validateSet(ezBar, 1500, 5)).toBeNull();
    expect(validateSet(ezBar, 1000, 5)).toBe('Total weight must be at least the 10.25 kg bar.');
  });
});
