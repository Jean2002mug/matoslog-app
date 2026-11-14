import {
  isWeightConvention,
  type Equipment,
  type Exercise,
  type ExerciseWithEquipment,
} from '@/domain/catalog';

import type { CatalogRepository } from './catalog-repository';
import type { Db } from './db';

/** Rows exactly as SQLite returns them (snake_case column names). */
export interface EquipmentRow {
  id: string;
  name: string;
  weight_convention: string;
  bar_weight_cg: number | null;
  sort_order: number;
}

export interface ExerciseRow {
  id: string;
  equipment_id: string;
  name: string;
  sort_order: number;
}

const EQUIPMENT_COLUMNS = 'id, name, weight_convention, bar_weight_cg, sort_order';
const EXERCISE_COLUMNS = 'id, equipment_id, name, sort_order';

/** Shared with the workout repository, which joins equipment into history queries. */
export function toEquipment(row: EquipmentRow): Equipment {
  if (!isWeightConvention(row.weight_convention)) {
    throw new Error(`Unknown weight convention "${row.weight_convention}" on equipment ${row.id}`);
  }
  return {
    id: row.id,
    name: row.name,
    weightConvention: row.weight_convention,
    barWeightCg: row.bar_weight_cg,
    sortOrder: row.sort_order,
  };
}

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

export class SqliteCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Db) {}

  async listEquipment(): Promise<Equipment[]> {
    const rows = await this.db.getAllAsync<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM equipment ORDER BY sort_order, name`,
    );
    return rows.map(toEquipment);
  }

  async getEquipment(equipmentId: string): Promise<Equipment | null> {
    const row = await this.db.getFirstAsync<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM equipment WHERE id = ?`,
      [equipmentId],
    );
    return row ? toEquipment(row) : null;
  }

  async listExercises(equipmentId: string): Promise<Exercise[]> {
    const rows = await this.db.getAllAsync<ExerciseRow>(
      `SELECT ${EXERCISE_COLUMNS} FROM exercise WHERE equipment_id = ? ORDER BY sort_order, name`,
      [equipmentId],
    );
    return rows.map(toExercise);
  }

  async getExerciseWithEquipment(exerciseId: string): Promise<ExerciseWithEquipment | null> {
    const exerciseRow = await this.db.getFirstAsync<ExerciseRow>(
      `SELECT ${EXERCISE_COLUMNS} FROM exercise WHERE id = ?`,
      [exerciseId],
    );
    if (!exerciseRow) return null;

    const equipment = await this.getEquipment(exerciseRow.equipment_id);
    if (!equipment) return null; // can't happen while foreign keys are on
    return { exercise: toExercise(exerciseRow), equipment };
  }
}
