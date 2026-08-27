import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { DropsService } from '../../src/drops/drops.service';

/**
 * The second invariant: never let more people in than the artist allowed.
 * Someone who paid and did not get a seat is a refund and a broken promise.
 */
describe('drop capacity', () => {
  let ds: DataSource;
  let svc: DropsService;

  beforeAll(async () => { ds = await testDb(); svc = new DropsService(ds); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function newDrop(capacity: number | null, status = 'available'): Promise<string> {
    const [d] = await ds.query(
      `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, status, published_at)
       VALUES ($1, 'D', 25000, 'vid', $2, $3, now()) RETURNING id`,
      [`d-${Math.random().toString(36).slice(2)}`, capacity, status],
    );
    return d.id;
  }

  async function newBuyer(): Promise<{ userId: string; orderId: string }> {
    const [u] = await ds.query(
      `INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`],
    );
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference)
       VALUES ($1, 25000, 'CARD', $2) RETURNING id`,
      [u.id, `ord_${Math.random().toString(36).slice(2)}`],
    );
    return { userId: u.id, orderId: o.id };
  }

  const grant = (dropId: string, b: { userId: string; orderId: string }) =>
    ds.transaction((m) => svc.grantEntitlement(m, dropId, b.userId, b.orderId));

  it('issues exactly `capacity` seats with capacity + 1 simultaneous buyers', async () => {
    const dropId = await newDrop(50);
    const buyers = await Promise.all(Array.from({ length: 51 }, () => newBuyer()));
    const results = await Promise.allSettled(buyers.map((b) => grant(dropId, b)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(50);
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`, [dropId]);
    expect(count).toBe(50);
  });

  it('with no capacity there is no limit', async () => {
    const dropId = await newDrop(null);
    const buyers = await Promise.all(Array.from({ length: 20 }, () => newBuyer()));
    const results = await Promise.allSettled(buyers.map((b) => grant(dropId, b)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(20);
    expect(await svc.seatsLeft(dropId)).toBeNull();
  });

  it('retrying the same order\'s settlement grants nothing extra', async () => {
    const dropId = await newDrop(50);
    const b = await newBuyer();
    const first = await grant(dropId, b);
    const second = await grant(dropId, b); // same order, as a webhook retry would be
    expect(second).toBe(first);
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`, [dropId]);
    expect(count).toBe(1);
  });

  it('rejects once full', async () => {
    const dropId = await newDrop(1);
    await grant(dropId, await newBuyer());
    await expect(grant(dropId, await newBuyer())).rejects.toThrow(/SOLD_OUT/);
  });

  it('a draft video issues nothing', async () => {
    const dropId = await newDrop(10, 'draft');
    await expect(grant(dropId, await newBuyer())).rejects.toThrow(/DROP_NOT_AVAILABLE/);
  });

  it('an unknown video is not found', async () => {
    await expect(
      grant('00000000-0000-0000-0000-000000000000', await newBuyer()),
    ).rejects.toThrow(/DROP_NOT_FOUND/);
  });

  it('reports seats left as they are taken', async () => {
    const dropId = await newDrop(3);
    expect(await svc.seatsLeft(dropId)).toBe(3);
    await grant(dropId, await newBuyer());
    expect(await svc.seatsLeft(dropId)).toBe(2);
  });

  it('the database refuses a half-open viewing window', async () => {
    const dropId = await newDrop(5);
    const b = await newBuyer();
    const id = await grant(dropId, b);
    await expect(
      ds.query(`UPDATE entitlements SET first_played_at = now() WHERE id = $1`, [id]),
    ).rejects.toThrow();
  });
});
