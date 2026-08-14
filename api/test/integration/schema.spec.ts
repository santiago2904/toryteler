import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';

/**
 * These are not tests of the entities: they check that the constraints exist in
 * the database. Every rule verified here is one that application code cannot
 * accidentally bypass.
 */
describe('base schema', () => {
  let ds: DataSource;

  beforeAll(async () => { ds = await testDb(); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  it('rejects two users with the same email', async () => {
    await ds.query(`INSERT INTO users (email) VALUES ('a@b.co')`);
    await expect(ds.query(`INSERT INTO users (email) VALUES ('a@b.co')`)).rejects.toThrow();
  });

  it('treats email as case-insensitive', async () => {
    await ds.query(`INSERT INTO users (email) VALUES ('Ana@B.co')`);
    await expect(ds.query(`INSERT INTO users (email) VALUES ('ana@b.co')`)).rejects.toThrow();
  });

  it('rejects a piece priced at zero or below', async () => {
    await expect(
      ds.query(`INSERT INTO pieces (slug, title, price_cop) VALUES ('x', 'X', 0)`),
    ).rejects.toThrow();
  });

  it('rejects negative stock', async () => {
    await expect(
      ds.query(`INSERT INTO pieces (slug, title, price_cop, stock) VALUES ('y', 'Y', 100, -1)`),
    ).rejects.toThrow();
  });

  it('defaults a piece to one unit and draft status', async () => {
    await ds.query(`INSERT INTO pieces (slug, title, price_cop) VALUES ('z', 'Z', 100)`);
    const [piece] = await ds.query(`SELECT stock, status FROM pieces WHERE slug = 'z'`);
    expect(piece.stock).toBe(1);
    expect(piece.status).toBe('draft');
  });

  it('rejects an unknown piece status', async () => {
    await expect(
      ds.query(`INSERT INTO pieces (slug, title, price_cop, status)
                VALUES ('w', 'W', 100, 'reserved')`),
    ).rejects.toThrow();
  });

  it('rejects two pieces with the same slug', async () => {
    await ds.query(`INSERT INTO pieces (slug, title, price_cop) VALUES ('dup', 'A', 100)`);
    await expect(
      ds.query(`INSERT INTO pieces (slug, title, price_cop) VALUES ('dup', 'B', 200)`),
    ).rejects.toThrow();
  });
});
