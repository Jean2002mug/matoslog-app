/**
 * Catalog types: equipment and the exercises done with it.
 * Pure TypeScript — no React, no SQL.
 */

/**
 * How the user enters weight for a piece of equipment.
 * - per_dumbbell: the weight of ONE dumbbell.
 * - barbell_total: total weight on the bar, including the bar itself.
 */
export type WeightConvention = 'per_dumbbell' | 'barbell_total';

export const WEIGHT_CONVENTIONS: readonly WeightConvention[] = ['per_dumbbell', 'barbell_total'];

export function isWeightConvention(value: unknown): value is WeightConvention {
  return WEIGHT_CONVENTIONS.includes(value as WeightConvention);
}

export interface Equipment {
  id: string;
  name: string;
  weightConvention: WeightConvention;
  /** Bar weight in centi-kg (2000 = 20 kg). Only set for barbell_total equipment. */
  barWeightCg: number | null;
  sortOrder: number;
}

export interface Exercise {
  id: string;
  equipmentId: string;
  name: string;
  sortOrder: number;
}

export interface EquipmentWithExercises {
  equipment: Equipment;
  exercises: Exercise[];
}

export interface ExerciseWithEquipment {
  exercise: Exercise;
  equipment: Equipment;
}

/** Converts centi-kg to a kg string without trailing zeros: 2000 -> "20", 1025 -> "10.25". */
export function formatKg(centiKg: number): string {
  return String(centiKg / 100);
}

/**
 * A short, human-readable description of how weight is entered.
 * Driven entirely by the equipment's data, so new equipment rows that reuse
 * an existing convention need no screen changes (AT-11).
 */
export function describeWeightConvention(equipment: Equipment): string {
  switch (equipment.weightConvention) {
    case 'per_dumbbell':
      return 'Weight per dumbbell';
    case 'barbell_total':
      return equipment.barWeightCg === null
        ? 'Total weight on the bar'
        : `Total weight, including ${formatKg(equipment.barWeightCg)} kg bar`;
  }
}
