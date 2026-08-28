import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PiecesService } from '../../src/pieces/pieces.service';

/**
 * The one rule that cannot bend: never sell more units than exist. Every test
 * here runs real concurrent requests against a real database, because that is
 * the only way this breaks in production.
 */
describe('piece stock', () => {
  let ds: DataSource;
  let svc: PiecesService;

  beforeAll(async () => { ds = await testDb(); svc = new PiecesService(ds); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function newPiece(stock: number, status = 'available'): Promise<string> {
    const [row] = await ds.query(
      `INSERT INTO pieces (slug, title, price_usd_cents, stock, status, published_at)
       VALUES ($1, 'P', 500000, $2, $3, now()) RETURNING id`,
      [`p-${Math.random().toString(36).slice(2)}`, stock, status],
    );
    return row.id;
  }

  it('an edition of 5 yields exactly 5 with 20 simultaneous buyers', async () => {
    const id = await newPiece(5);
    const results = await Promise.all(Array.from({ length: 20 }, () => svc.take(id)));
    expect(results.filter(Boolean)).toHaveLength(5);
    const [piece] = await ds.query(`SELECT stock FROM pieces WHERE id = $1`, [id]);
    expect(piece.stock).toBe(0);
  });

  it('an irreplaceable piece goes to a single buyer', async () => {
    const id = await newPiece(1);
    const results = await Promise.all(Array.from({ length: 10 }, () => svc.take(id)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('with no units nobody takes it', async () => {
    await expect(svc.take(await newPiece(0))).resolves.toBe(false);
  });

  it('stock never goes negative under pressure', async () => {
    const id = await newPiece(2);
    await Promise.all(Array.from({ length: 50 }, () => svc.take(id)));
    const [piece] = await ds.query(`SELECT stock FROM pieces WHERE id = $1`, [id]);
    expect(piece.stock).toBe(0);
  });

  it('releasing a unit makes it buyable again', async () => {
    const id = await newPiece(1);
    await svc.take(id);
    await expect(svc.take(id)).resolves.toBe(false);
    await svc.release(id);
    await expect(svc.take(id)).resolves.toBe(true);
  });

  it('a draft piece cannot be taken', async () => {
    await expect(svc.take(await newPiece(5, 'draft'))).resolves.toBe(false);
  });

  it('an archived piece cannot be taken', async () => {
    await expect(svc.take(await newPiece(5, 'archived'))).resolves.toBe(false);
  });

  it('marks the moment it ran out', async () => {
    const id = await newPiece(1);
    await svc.take(id);
    const [piece] = await ds.query(`SELECT sold_at FROM pieces WHERE id = $1`, [id]);
    expect(piece.sold_at).not.toBeNull();
  });

  it('taking an unknown piece is false, not a crash', async () => {
    await expect(svc.take('00000000-0000-0000-0000-000000000000')).resolves.toBe(false);
  });
});
