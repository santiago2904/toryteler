import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Raw provider events, kept as the idempotency ledger of every payment.
 *
 * The unique id is what turns a retried webhook into a no-op. Keeping the whole
 * payload matters too: when a settlement is disputed months later, the only
 * honest answer is what the provider actually sent.
 */
export class PaymentEvents1755700000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE payment_events (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_event_id text NOT NULL UNIQUE,
        payload           jsonb NOT NULL,
        received_at       timestamptz NOT NULL DEFAULT now(),
        processed_at      timestamptz
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE payment_events`);
  }
}
