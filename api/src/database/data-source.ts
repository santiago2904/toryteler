import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * `synchronize` stays false forever. The invariants of this system live in
 * hand-written SQL — checks, partial indexes, conditional updates — and letting
 * TypeORM reshape the schema from the entities would quietly drop them.
 */
const url = process.env.DATABASE_URL ?? '';

/**
 * Managed Postgres — Railway, Render, Neon — terminates TLS with a certificate
 * this container has no authority for. Refusing it means never connecting; the
 * connection is still encrypted, it is only the chain that goes unverified.
 *
 * Off by default so a local database is not asked for TLS it does not speak.
 */
const ssl =
  process.env.DATABASE_SSL === 'true' || url.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  ssl,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});
