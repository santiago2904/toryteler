import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every time a buyer opens their video.
 *
 * The entitlement already counts views; this table says when, from where and
 * with what. It is what answers "I never got to watch it" months later, and the
 * only trace of a video that by design leaves none.
 */
export class ViewSessions1755800000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE view_sessions (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entitlement_id uuid NOT NULL REFERENCES entitlements(id),
        started_at     timestamptz NOT NULL DEFAULT now(),
        ip             inet,
        user_agent     text
      )`);

    await q.query(`CREATE INDEX idx_view_sessions_ent ON view_sessions (entitlement_id, started_at)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE view_sessions`);
  }
}
