import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { AdminService } from '../../src/admin/admin.service';
import { AuthService } from '../../src/auth/auth.service';
import { DropsService } from '../../src/drops/drops.service';
import { PiecesService } from '../../src/pieces/pieces.service';

const CONFIG = {
  get: (k: string) =>
    ({ SESSION_SECRET: 'a'.repeat(40), PUBLIC_WEB_URL: 'http://web.test' } as Record<string, string>)[k],
} as ConfigService;

/** Never actually sends: only `addToTeam`'s own error handling cares that this exists. */
const NULL_MAIL = { send: async () => {} } as never;

describe('artist administration', () => {
  let ds: DataSource;
  let admin: AdminService;
  let pieces: PiecesService;
  let drops: DropsService;

  beforeAll(async () => {
    ds = await testDb();
    admin = new AdminService(ds, new AuthService(ds, NULL_MAIL, CONFIG));
    pieces = new PiecesService(ds);
    drops = new DropsService(ds);
  });

  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function buyer() {
    const suffix = Math.random().toString(36).slice(2);
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [`u-${suffix}@x.co`]);
    return u.id as string;
  }

  async function sellSeat(dropId: string) {
    const userId = await buyer();
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference)
       VALUES ($1, 15000, 'CARD', $2) RETURNING id`,
      [userId, `ord_${Math.random().toString(36).slice(2)}`],
    );
    await ds.query(
      `INSERT INTO entitlements (user_id, drop_id, order_id) VALUES ($1, $2, $3)`,
      [userId, dropId, o.id],
    );
  }

  describe('publishing a piece', () => {
    it('builds the address from the title', async () => {
      const { id } = await admin.createPiece({
        title: 'Prueba de color — Casa 42',
        priceCop: 250000,
        stock: 1,
        images: ['a.jpg'],
      });
      const [p] = await ds.query(`SELECT slug, status FROM pieces WHERE id = $1`, [id]);
      expect(p.slug).toBe('prueba-de-color-casa-42');
      expect(p.status).toBe('draft');
    });

    it('never collides two addresses', async () => {
      await admin.createPiece({ title: 'Boceto', priceCop: 1000, stock: 1, images: [] });
      const second = await admin.createPiece({ title: 'Boceto', priceCop: 1000, stock: 1, images: [] });
      const [p] = await ds.query(`SELECT slug FROM pieces WHERE id = $1`, [second.id]);
      expect(p.slug).not.toBe('boceto');
      expect(p.slug).toMatch(/^boceto-/);
    });

    it('stays out of the shop until it is published', async () => {
      const { id } = await admin.createPiece({ title: 'Oculta', priceCop: 1000, stock: 1, images: [] });
      expect(await pieces.listPublished()).toEqual([]);

      await admin.setPieceListed(id, true);
      expect((await pieces.listPublished()).map((p) => p.title)).toEqual(['Oculta']);
    });

    it('keeps the original publication date when it comes back', async () => {
      const { id } = await admin.createPiece({ title: 'Vuelve', priceCop: 1000, stock: 1, images: [] });
      await admin.setPieceListed(id, true);
      const [first] = await ds.query(`SELECT published_at FROM pieces WHERE id = $1`, [id]);

      await admin.setPieceListed(id, false);
      await admin.setPieceListed(id, true);

      const [again] = await ds.query(`SELECT published_at FROM pieces WHERE id = $1`, [id]);
      expect(again.published_at.getTime()).toBe(first.published_at.getTime());
    });

    it('edits only what it was given', async () => {
      const { id } = await admin.createPiece({
        title: 'Antes', description: 'Descripción', priceCop: 1000, stock: 2, images: ['a.jpg'],
      });
      await admin.updatePiece(id, { title: 'Después', stock: 5 });

      const [p] = await ds.query(`SELECT title, description, stock, price_cop FROM pieces WHERE id = $1`, [id]);
      expect(p).toMatchObject({ title: 'Después', description: 'Descripción', stock: 5, price_cop: 1000 });
    });
  });

  describe('capacity', () => {
    async function dropWith(capacity: number | null, sold: number) {
      const { id } = await admin.createDrop({
        title: `Video ${Math.random().toString(36).slice(2)}`,
        priceCop: 15000,
        videoAssetId: 'vid',
        capacity,
        viewWindowHours: 24,
      });
      for (let i = 0; i < sold; i++) await sellSeat(id);
      return id;
    }

    it('goes up freely', async () => {
      const id = await dropWith(10, 5);
      await admin.updateDrop(id, { capacity: 20 });
      const [d] = await ds.query(`SELECT capacity FROM drops WHERE id = $1`, [id]);
      expect(d.capacity).toBe(20);
    });

    it('refuses to go below what has already been sold', async () => {
      const id = await dropWith(10, 5);
      await expect(admin.updateDrop(id, { capacity: 3 })).rejects.toThrow(/CAPACITY_BELOW_GRANTED/);
      const [d] = await ds.query(`SELECT capacity FROM drops WHERE id = $1`, [id]);
      expect(d.capacity).toBe(10);
    });

    it('allows exactly what has been sold, which closes it', async () => {
      const id = await dropWith(10, 5);
      await admin.updateDrop(id, { capacity: 5 });
      await admin.setDropListed(id, true);
      const detail = await drops.findBySlug(await slugOf(id));
      expect(detail!.soldOut).toBe(true);
      expect(detail!.remaining).toBe(0);
    });

    it('lets the limit be removed altogether', async () => {
      const id = await dropWith(10, 5);
      await admin.updateDrop(id, { capacity: null });
      const [d] = await ds.query(`SELECT capacity FROM drops WHERE id = $1`, [id]);
      expect(d.capacity).toBeNull();
    });

    const slugOf = async (id: string): Promise<string> =>
      (await ds.query(`SELECT slug FROM drops WHERE id = $1`, [id]))[0].slug;
  });

  describe('unlisting', () => {
    it('takes the video out of the shop without taking it from whoever bought it', async () => {
      const { id } = await admin.createDrop({
        title: 'Retirado', priceCop: 15000, videoAssetId: 'vid', capacity: 10, viewWindowHours: 24,
      });
      await admin.setDropListed(id, true);
      await sellSeat(id);

      await admin.setDropListed(id, false);

      expect(await drops.listPublished()).toEqual([]);
      const [{ count }] = await ds.query(
        `SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`, [id],
      );
      expect(count).toBe(1);
    });
  });

  describe('shipping', () => {
    async function order(status: string) {
      const userId = await buyer();
      const [o] = await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference, status)
         VALUES ($1, 500000, 'CARD', $2, $3) RETURNING id`,
        [userId, `ord_${Math.random().toString(36).slice(2)}`, status],
      );
      return o.id as string;
    }

    it('records the tracking reference of a paid order', async () => {
      const id = await order('paid');
      await admin.markShipped(id, { carrier: 'servientrega', number: 'GUIA-123' });

      const [o] = await ds.query(
        `SELECT tracking_carrier, tracking_number, shipped_at FROM orders WHERE id = $1`, [id],
      );
      expect(o).toMatchObject({ tracking_carrier: 'servientrega', tracking_number: 'GUIA-123' });
      expect(o.shipped_at).not.toBeNull();
    });

    it('refuses to ship what was never paid for', async () => {
      const id = await order('pending');
      await expect(
        admin.markShipped(id, { carrier: 'servientrega', number: 'G' }),
      ).rejects.toThrow(/ORDER_NOT_PAID/);
    });

    it('refuses to ship a refunded order', async () => {
      const id = await order('refunded');
      await expect(
        admin.markShipped(id, { carrier: 'servientrega', number: 'G' }),
      ).rejects.toThrow(/ORDER_NOT_PAID/);
    });

    it('corrects a tracking reference that was typed wrong', async () => {
      const id = await order('paid');
      await admin.markShipped(id, { carrier: 'servientrega', number: 'MALA' });
      await admin.markShipped(id, { carrier: 'coordinadora', number: 'BUENA' });

      const [o] = await ds.query(`SELECT tracking_number FROM orders WHERE id = $1`, [id]);
      expect(o.tracking_number).toBe('BUENA');
    });
  });
});
