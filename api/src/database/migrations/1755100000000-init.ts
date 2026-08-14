import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Users and pieces.
 *
 * Every rule that matters lives here as a constraint, not in application code:
 * the API runs on several instances and anything checked in TypeScript can be
 * bypassed by a concurrent request.
 */
export class Init1755100000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    // citext so Ana@B.co and ana@b.co are the same person.
    await q.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await q.query(`
      CREATE TABLE users (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email       citext NOT NULL UNIQUE,
        full_name   text,
        document_id text,
        phone       text,
        is_admin    boolean NOT NULL DEFAULT false,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE pieces (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug          text NOT NULL UNIQUE,
        title         text NOT NULL,
        description   text,
        story         text,
        personal_note text,
        price_cop     integer NOT NULL CHECK (price_cop > 0),
        images        jsonb NOT NULL DEFAULT '[]',
        -- 1 is an irreplaceable piece; more than 1, an edition. Never below
        -- zero: this check is what makes overselling impossible.
        stock         integer NOT NULL DEFAULT 1 CHECK (stock >= 0),
        -- No 'reserved' or 'sold': the checkout deadline lives in the order's
        -- age, and stock = 0 already says it ran out.
        status        text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'available', 'archived')),
        published_at  timestamptz,
        sold_at       timestamptz
      )`);

    // The catalogue always filters by these two together.
    await q.query(`
      CREATE INDEX idx_pieces_published ON pieces (status, published_at DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE pieces`);
    await q.query(`DROP TABLE users`);
  }
}
