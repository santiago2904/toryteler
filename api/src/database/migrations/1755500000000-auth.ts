import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two single-use tokens with very different jobs.
 *
 * A magic link identifies someone. An OTP proves that the person signing a
 * contract is the one who received the code — that is what turns a checkbox
 * into evidence, so its attempts are counted and its lifetime is short.
 */
export class Auth1755500000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE magic_links (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id),
        token      text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at    timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE otp_challenges (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users(id),
        purpose     text NOT NULL CHECK (purpose IN ('CONTRACT_SIGNATURE')),
        -- Only the hash: a leaked table must not hand out valid codes.
        code_hash   text NOT NULL,
        attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        expires_at  timestamptz NOT NULL,
        verified_at timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`CREATE INDEX idx_magic_links_user ON magic_links (user_id, created_at DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE otp_challenges`);
    await q.query(`DROP TABLE magic_links`);
  }
}
