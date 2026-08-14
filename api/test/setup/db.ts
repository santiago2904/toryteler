import { DataSource } from 'typeorm';
import { AppDataSource } from '../../src/database/data-source';

let ds: DataSource | null = null;

/** One connection for the whole suite, migrated once. */
export async function testDb(): Promise<DataSource> {
  if (!ds) {
    ds = await AppDataSource.initialize();
    await ds.runMigrations();
  }
  return ds;
}

export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
