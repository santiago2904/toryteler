import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * `synchronize` stays false forever. The invariants of this system live in
 * hand-written SQL — checks, partial indexes, conditional updates — and letting
 * TypeORM reshape the schema from the entities would quietly drop them.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});
