import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Videos and the right to watch them.
 *
 * An entitlement is unique per (user, drop): a video goes one per person, so
 * the database refuses a second one instead of trusting the code to check.
 */
export class Drops1755300000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE drops (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug                text NOT NULL UNIQUE,
        title               text NOT NULL,
        description         text,
        price_cop           integer NOT NULL CHECK (price_cop > 0),
        video_asset_id      text NOT NULL,
        poster_image        text,
        -- NULL means no limit. Zero would mean "publish something nobody can
        -- buy", which is what an unpublished draft is for.
        capacity            integer CHECK (capacity IS NULL OR capacity > 0),
        view_window_hours   integer NOT NULL DEFAULT 24 CHECK (view_window_hours > 0),
        max_views_per_buyer integer NOT NULL DEFAULT 1 CHECK (max_views_per_buyer > 0),
        status              text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'available', 'closed', 'archived')),
        published_at        timestamptz
      )`);

    await q.query(`
      CREATE TABLE entitlements (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES users(id),
        drop_id         uuid NOT NULL REFERENCES drops(id),
        order_id        uuid NOT NULL REFERENCES orders(id),
        granted_at      timestamptz NOT NULL DEFAULT now(),
        first_played_at timestamptz,
        expires_at      timestamptz,
        views_used      integer NOT NULL DEFAULT 0,
        -- One per person, enforced here and not in application code.
        UNIQUE (user_id, drop_id),
        -- The window either has both ends or neither.
        CHECK ((first_played_at IS NULL) = (expires_at IS NULL))
      )`);

    await q.query(`ALTER TABLE order_items
      ADD CONSTRAINT fk_order_items_drop FOREIGN KEY (drop_id) REFERENCES drops(id)`);

    // Counting seats sold is the hot path of the capacity check.
    await q.query(`CREATE INDEX idx_entitlements_drop ON entitlements (drop_id)`);
    await q.query(`CREATE INDEX idx_entitlements_user ON entitlements (user_id, granted_at DESC)`);
    await q.query(`CREATE INDEX idx_drops_published ON drops (status, published_at DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE order_items DROP CONSTRAINT fk_order_items_drop`);
    await q.query(`DROP TABLE entitlements`);
    await q.query(`DROP TABLE drops`);
  }
}
