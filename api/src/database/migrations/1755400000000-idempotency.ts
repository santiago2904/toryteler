import { MigrationInterface, QueryRunner } from 'typeorm';

export class Idempotency1755400000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE idempotency_keys (
        key           text PRIMARY KEY,
        user_id       uuid REFERENCES users(id),
        endpoint      text NOT NULL,
        -- Hash of the request body: the same key with a different body is a
        -- client bug, not a retry, and must not return the first answer.
        request_hash  text NOT NULL,
        response_body jsonb,
        status_code   integer,
        created_at    timestamptz NOT NULL DEFAULT now()
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE idempotency_keys`);
  }
}
