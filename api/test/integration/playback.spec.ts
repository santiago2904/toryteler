import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PlaybackService } from '../../src/playback/playback.service';

describe('ephemeral playback', () => {
  let ds: DataSource;
  let playback: PlaybackService;
  let signed: string[];
  const ctx = { ip: '190.0.0.1', userAgent: 'jest' };

  beforeAll(async () => {
    ds = await testDb();
    signed = [];
    playback = new PlaybackService(ds, async (assetId) => {
      signed.push(assetId);
      return `https://stream/${assetId}?token=signed`;
    });
  });

  beforeEach(async () => { await truncateAll(ds); signed = []; });
  afterAll(async () => { await ds.destroy(); });

  async function entitlement(windowHours = 24) {
    const suffix = Math.random().toString(36).slice(2);
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [`u-${suffix}@x.co`]);
    const [d] = await ds.query(
      `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, view_window_hours, status, published_at)
       VALUES ($1, 'D', 15000, $2, 50, $3, 'available', now()) RETURNING id`,
      [`d-${suffix}`, `asset-${suffix}`, windowHours],
    );
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference, status)
       VALUES ($1, 15000, 'CARD', $2, 'paid') RETURNING id`,
      [u.id, `ord_${suffix}`],
    );
    const [e] = await ds.query(
      `INSERT INTO entitlements (user_id, drop_id, order_id) VALUES ($1, $2, $3) RETURNING id`,
      [u.id, d.id, o.id],
    );
    return { entitlementId: e.id, userId: u.id, assetId: `asset-${suffix}` };
  }

  const readEntitlement = async (id: string) =>
    (
      await ds.query(
        `SELECT first_played_at, views_used,
                extract(epoch FROM (expires_at - now())) / 3600 AS hours_left
           FROM entitlements WHERE id = $1`,
        [id],
      )
    )[0];

  it('opens the window on the first play and signs the asset', async () => {
    const e = await entitlement(24);
    const result = await playback.play(e.entitlementId, e.userId, ctx);

    expect(result.videoUrl).toContain('token=signed');
    expect(signed).toEqual([e.assetId]);

    const row = await readEntitlement(e.entitlementId);
    expect(row.first_played_at).not.toBeNull();
    expect(Number(row.hours_left)).toBeGreaterThan(23);
  });

  it('uses the window length the drop was published with', async () => {
    const e = await entitlement(48);
    await playback.play(e.entitlementId, e.userId, ctx);

    const row = await readEntitlement(e.entitlementId);
    expect(Number(row.hours_left)).toBeGreaterThan(47);
    expect(Number(row.hours_left)).toBeLessThan(48.1);
  });

  it('lets the buyer come back inside the window without moving its end', async () => {
    const e = await entitlement();
    const first = await playback.play(e.entitlementId, e.userId, ctx);
    const second = await playback.play(e.entitlementId, e.userId, ctx);

    expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime());
    expect((await readEntitlement(e.entitlementId)).views_used).toBe(2);
  });

  it('opens one window for two simultaneous plays', async () => {
    const e = await entitlement();
    const [a, b] = await Promise.all([
      playback.play(e.entitlementId, e.userId, ctx),
      playback.play(e.entitlementId, e.userId, ctx),
    ]);

    expect(a.expiresAt.getTime()).toBe(b.expiresAt.getTime());
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM view_sessions WHERE entitlement_id = $1`,
      [e.entitlementId],
    );
    expect(count).toBe(2);
  });

  it('records where each session came from', async () => {
    const e = await entitlement();
    await playback.play(e.entitlementId, e.userId, ctx);

    const [s] = await ds.query(
      `SELECT host(ip) AS ip, user_agent FROM view_sessions WHERE entitlement_id = $1`,
      [e.entitlementId],
    );
    expect(s.ip).toBe('190.0.0.1');
    expect(s.user_agent).toBe('jest');
  });

  it('refuses once the window has closed, and signs nothing', async () => {
    const e = await entitlement();
    await playback.play(e.entitlementId, e.userId, ctx);
    await ds.query(
      `UPDATE entitlements SET expires_at = now() - interval '1 minute' WHERE id = $1`,
      [e.entitlementId],
    );
    signed = [];

    await expect(playback.play(e.entitlementId, e.userId, ctx)).rejects.toThrow(/WINDOW_CLOSED/);
    expect(signed).toEqual([]);
  });

  it('does not reopen a closed window by counting a view', async () => {
    const e = await entitlement();
    await playback.play(e.entitlementId, e.userId, ctx);
    await ds.query(
      `UPDATE entitlements SET expires_at = now() - interval '1 minute' WHERE id = $1`,
      [e.entitlementId],
    );

    await expect(playback.play(e.entitlementId, e.userId, ctx)).rejects.toThrow();
    expect((await readEntitlement(e.entitlementId)).views_used).toBe(1);
  });

  it('reports someone else\'s access as missing rather than forbidden', async () => {
    const mine = await entitlement();
    const other = await entitlement();

    await expect(playback.play(mine.entitlementId, other.userId, ctx)).rejects.toThrow(/NOT_FOUND/);
    expect((await readEntitlement(mine.entitlementId)).views_used).toBe(0);
  });
});
