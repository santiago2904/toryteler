import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether the buyer asked for the artist's signature on the piece.
 *
 * It lives on the item and not on the order because it is a property of the
 * object, not of the sale: an order can carry two pieces and only one of them
 * be asked for signed.
 *
 * It stays out of the contract on purpose. The autograph is a delivery detail,
 * and the contract's bytes have to reproduce exactly for its hash to verify.
 */
export class SignatureRequest1755900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE order_items ADD COLUMN wants_signature boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE order_items DROP COLUMN wants_signature`);
  }
}
