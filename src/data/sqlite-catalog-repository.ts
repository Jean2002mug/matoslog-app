import type { SQLiteDatabase } from 'expo-sqlite';

import { isWeightConvention, type Equipment } from '@/domain/catalog';

import type { CatalogRepository } from './catalog-repository';

/** A row exactly as SQLite returns it (snake_case column names). */
interface EquipmentRow {
  id: string;
  name: string;
  weight_convention: string;
  bar_weight_cg: number | null;
  sort_order: number;
}

function toEquipment(row: EquipmentRow): Equipment {
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

export class SqliteCatalogRepository implements CatalogRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listEquipment(): Promise<Equipment[]> {
    const rows = await this.db.getAllAsync<EquipmentRow>(
      `SELECT id, name, weight_convention, bar_weight_cg, sort_order
       FROM equipment
       ORDER BY sort_order, name`,
    );
    return rows.map(toEquipment);
  }
}
