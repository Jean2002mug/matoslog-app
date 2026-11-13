/**
 * Weight and rep rules. Pure TypeScript — no React, no SQL.
 * All weights are integer centi-kg (10.25 kg = 1025); kg is the only unit.
 */
import { formatKg, type Equipment } from './catalog';

export const MAX_WEIGHT_CG = 50_000; // 500 kg
export const MIN_REPS = 1;
export const MAX_REPS = 100;

/**
 * Parses typed kg text into centi-kg, or returns null if it isn't a valid weight.
 * Accepts "22", "22.5", "10.25" and a comma decimal ("22,5"). At most 2 decimals.
 *
 * It works on the digits as TEXT on purpose: converting with `Number(text) * 100`
 * can hit floating-point errors (e.g. 0.1 + 0.2 = 0.30000000000000004).
 */
export function parseKg(text: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const wholeKg = Number(match[1]);
  const hundredths = Number((match[2] ?? '').padEnd(2, '0'));
  return wholeKg * 100 + hundredths;
}

/** Parses typed rep text into a whole number, or returns null if it isn't one. */
export function parseReps(text: string): number | null {
  const match = /^\d{1,3}$/.exec(text.trim());
  return match ? Number(match[0]) : null;
}

/**
 * Checks a set against the equipment's weight convention.
 * Returns a message to show the user, or null if the set is valid.
 * Driven by the equipment's data, so new equipment with an existing convention
 * needs no code changes (AT-11).
 */
export function validateSet(equipment: Equipment, weightCg: number, reps: number): string | null {
  if (!Number.isInteger(reps) || reps < MIN_REPS || reps > MAX_REPS) {
    return `Reps must be a whole number from ${MIN_REPS} to ${MAX_REPS}.`;
  }
  if (!Number.isInteger(weightCg) || weightCg < 0) {
    return 'Enter a weight in kg, like 22.5.';
  }
  if (weightCg > MAX_WEIGHT_CG) {
    return `Weight must be ${formatKg(MAX_WEIGHT_CG)} kg or less.`;
  }

  switch (equipment.weightConvention) {
    case 'per_dumbbell':
      return weightCg > 0 ? null : 'Enter the weight of one dumbbell (more than 0 kg).';
    case 'barbell_total':
      if (equipment.barWeightCg !== null && weightCg < equipment.barWeightCg) {
        return `Total weight must be at least the ${formatKg(equipment.barWeightCg)} kg bar.`;
      }
      return weightCg > 0 ? null : 'Enter the total weight on the bar (more than 0 kg).';
  }
}
