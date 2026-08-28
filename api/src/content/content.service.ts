import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { returnedRows } from '../database/rows';
import { CONTENT_KEY_SET, CONTENT_KEYS } from './content-keys';

export interface AdminContentItem {
  key: string;
  section: string;
  defaultValue: string;
  currentValue: string;
  hasOverride: boolean;
}

@Injectable()
export class ContentService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** El mapa completo de lo que el artista ha cambiado. Nunca las 43 claves. */
  async getOverrides(): Promise<Record<string, string>> {
    const rows = returnedRows<{ key: string; value: string }>(
      await this.ds.query(`SELECT key, value FROM content_overrides`),
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Las 43 claves conocidas, cada una con su override si lo tiene. */
  async listForAdmin(): Promise<AdminContentItem[]> {
    const overrides = await this.getOverrides();
    return CONTENT_KEYS.map((def) => ({
      key: def.key,
      section: def.section,
      defaultValue: def.defaultValue,
      currentValue: overrides[def.key] ?? def.defaultValue,
      hasOverride: def.key in overrides,
    }));
  }

  async setOverride(key: string, value: string, updatedBy: string): Promise<void> {
    if (!CONTENT_KEY_SET.has(key)) throw new BadRequestException('UNKNOWN_KEY');
    await this.ds.query(
      `INSERT INTO content_overrides (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()`,
      [key, value, updatedBy],
    );
  }

  async resetOverride(key: string): Promise<void> {
    if (!CONTENT_KEY_SET.has(key)) throw new BadRequestException('UNKNOWN_KEY');
    await this.ds.query(`DELETE FROM content_overrides WHERE key = $1`, [key]);
  }
}
