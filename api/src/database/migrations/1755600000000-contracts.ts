import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Signed sale contracts.
 *
 * The CHECK at the bottom is the important line: a signed contract without its
 * evidence record cannot exist. Legal traceability stops depending on whether
 * the programmer remembered to fill it in.
 */
export class Contracts1755600000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE contracts (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      uuid NOT NULL REFERENCES orders(id),
        piece_id      uuid NOT NULL REFERENCES pieces(id),
        pdf_url       text NOT NULL,
        -- SHA-256 of the exact document the signer saw. This is what proves it
        -- was not altered afterwards.
        document_hash text NOT NULL,
        status        text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'signed_pending_payment', 'executed', 'void')),
        signed_at     timestamptz,
        evidence      jsonb,
        created_at    timestamptz NOT NULL DEFAULT now(),
        -- One contract per piece per order: Wompi retries a webhook and the
        -- buyer must not receive three copies.
        UNIQUE (order_id, piece_id),
        CHECK (status = 'draft' OR (signed_at IS NOT NULL AND evidence IS NOT NULL))
      )`);

    await q.query(`CREATE INDEX idx_contracts_order ON contracts (order_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE contracts`);
  }
}
