import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A video went one entitlement per person, forever — `UNIQUE (user_id,
 * drop_id)` enforced that at the database, and `grantEntitlement`'s
 * `ON CONFLICT` relied on it both to stay idempotent under a retried
 * settlement and to refuse a genuine second sale.
 *
 * Now a closed viewing window can be bought again: uniqueness moves to
 * `(order_id, drop_id)`, which still makes a retried settlement of the same
 * order a no-op (an order never contains the same drop twice), but no longer
 * blocks a second order for the same drop. The business rule this used to
 * carry — no second purchase while the buyer can still watch what they
 * already have — moves to `OrdersService.create()`, checked against
 * `first_played_at`/`expires_at` on the same rows this constraint used to
 * guard blindly.
 */
export class RepeatPurchase1756000000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE entitlements DROP CONSTRAINT entitlements_user_id_drop_id_key`);
    await q.query(
      `ALTER TABLE entitlements ADD CONSTRAINT entitlements_order_id_drop_id_key UNIQUE (order_id, drop_id)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE entitlements DROP CONSTRAINT entitlements_order_id_drop_id_key`);
    await q.query(
      `ALTER TABLE entitlements ADD CONSTRAINT entitlements_user_id_drop_id_key UNIQUE (user_id, drop_id)`,
    );
  }
}
