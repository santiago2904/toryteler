import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Orders and their lines.
 *
 * There is deliberately no unique index on order_items.piece_id: an edition is
 * sold several times. What prevents overselling is the conditional decrement on
 * pieces.stock, not a uniqueness rule here.
 */
export class Orders1755200000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE orders (
        id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              uuid NOT NULL REFERENCES users(id),
        status               text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','paid','failed','expired','refunded')),
        total_cop            integer NOT NULL CHECK (total_cop > 0),
        payment_method       text NOT NULL CHECK (payment_method IN ('CARD','PSE','NEQUI')),
        shipping_address     jsonb,
        reference            text NOT NULL UNIQUE,
        wompi_transaction_id text UNIQUE,
        tracking_carrier     text,
        tracking_number      text,
        shipped_at           timestamptz,
        created_at           timestamptz NOT NULL DEFAULT now(),
        paid_at              timestamptz,
        -- A shipment needs both carrier and number, or neither: half a
        -- tracking reference cannot be turned into a URL.
        CHECK ((tracking_carrier IS NULL) = (tracking_number IS NULL))
      )`);

    await q.query(`
      CREATE TABLE order_items (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id       uuid NOT NULL REFERENCES orders(id),
        piece_id       uuid REFERENCES pieces(id),
        drop_id        uuid,
        unit_price_cop integer NOT NULL CHECK (unit_price_cop > 0),
        -- A line is one thing or the other, never both and never neither.
        CHECK (num_nonnulls(piece_id, drop_id) = 1)
      )`);

    await q.query(`CREATE INDEX idx_order_items_order ON order_items (order_id)`);
    await q.query(`CREATE INDEX idx_order_items_piece ON order_items (piece_id)`);
    // The reconciliation job looks for stale pending orders through this.
    await q.query(`CREATE INDEX idx_orders_status_created ON orders (status, created_at)`);
    await q.query(`CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE order_items`);
    await q.query(`DROP TABLE orders`);
  }
}
