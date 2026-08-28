import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PiecesService } from '../../src/pieces/pieces.service';
import { DropsService } from '../../src/drops/drops.service';
import { AccountService } from '../../src/orders/account.service';

describe('public and account reads', () => {
  let ds: DataSource;
  let pieces: PiecesService;
  let drops: DropsService;
  let account: AccountService;

  beforeAll(async () => {
    ds = await testDb();
    pieces = new PiecesService(ds);
    drops = new DropsService(ds);
    account = new AccountService(ds);
  });

  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  describe('catalogue', () => {
    it('shows what is published and hides drafts and archives', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, stock, status, published_at) VALUES
           ('a', 'A', 1000, 1, 'available', now()),
           ('b', 'B', 1000, 1, 'draft', NULL),
           ('c', 'C', 1000, 0, 'available', now()),
           ('d', 'D', 1000, 1, 'archived', now())`,
      );
      const list = await pieces.listPublished();
      expect(list.map((p) => p.slug).sort()).toEqual(['a', 'c']);
    });

    it('keeps a sold-out piece listed but not available', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, stock, status, published_at)
         VALUES ('gone', 'Gone', 1000, 0, 'available', now())`,
      );
      const [piece] = await pieces.listPublished();
      expect(piece.stock).toBe(0);
      expect(piece.available).toBe(false);
    });

    it('reports the remaining units of an edition', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, stock, status, published_at)
         VALUES ('ed', 'Edition', 1000, 12, 'available', now())`,
      );
      const [piece] = await pieces.listPublished();
      expect(piece.stock).toBe(12);
      expect(piece.available).toBe(true);
    });

    it('lists the newest first', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, status, published_at) VALUES
           ('old', 'Old', 1000, 'available', now() - interval '2 days'),
           ('new', 'New', 1000, 'available', now())`,
      );
      expect((await pieces.listPublished()).map((p) => p.slug)).toEqual(['new', 'old']);
    });
  });

  describe('piece detail', () => {
    it('carries the story and the images', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, description, story, price_usd_cents, images, stock, status, published_at)
         VALUES ('x', 'X', 'Boceto', 'La usé en la gira', 250000, '["a.jpg","b.jpg"]', 1, 'available', now())`,
      );
      const detail = await pieces.findBySlug('x');
      expect(detail!.story).toBe('La usé en la gira');
      expect(detail!.priceUsdCents).toBe(250000);
      expect(detail!.images).toEqual(['a.jpg', 'b.jpg']);
      expect(detail!.available).toBe(true);
    });

    it('never leaks the personal note, which belongs to whoever buys it', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, personal_note, status, published_at)
         VALUES ('n', 'N', 1000, 'Gracias por cuidarla', 'available', now())`,
      );
      expect(await pieces.findBySlug('n')).not.toHaveProperty('personalNote');
    });

    it('hides a draft from anyone who guesses its address', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, status) VALUES ('y', 'Y', 1000, 'draft')`,
      );
      await expect(pieces.findBySlug('y')).resolves.toBeNull();
    });
  });

  describe('drops', () => {
    async function drop(slug: string, capacity: number | null, status = 'available') {
      const [d] = await ds.query(
        `INSERT INTO drops (slug, title, price_usd_cents, video_asset_id, capacity, status, published_at)
         VALUES ($1, $2, 15000, 'vid', $3, $4, now()) RETURNING id`,
        [slug, slug.toUpperCase(), capacity, status],
      );
      return d.id as string;
    }

    async function sellSeat(dropId: string) {
      const suffix = Math.random().toString(36).slice(2);
      const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [`u-${suffix}@x.co`]);
      const [o] = await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference)
         VALUES ($1, 15000, 'CARD', $2) RETURNING id`,
        [u.id, `ord_${suffix}`],
      );
      await ds.query(
        `INSERT INTO entitlements (user_id, drop_id, order_id) VALUES ($1, $2, $3)`,
        [u.id, dropId, o.id],
      );
    }

    it('counts the seats left', async () => {
      const id = await drop('dr', 3);
      await sellSeat(id);
      const detail = await drops.findBySlug('dr');
      expect(detail!.remaining).toBe(2);
      expect(detail!.soldOut).toBe(false);
    });

    it('says sold out when the last seat goes', async () => {
      const id = await drop('last', 1);
      await sellSeat(id);
      const detail = await drops.findBySlug('last');
      expect(detail!.remaining).toBe(0);
      expect(detail!.soldOut).toBe(true);
    });

    it('reports no limit as unlimited rather than as zero', async () => {
      await drop('inf', null);
      const detail = await drops.findBySlug('inf');
      expect(detail!.remaining).toBeNull();
      expect(detail!.soldOut).toBe(false);
    });

    it('never ships the asset id, which is the video itself', async () => {
      await drop('secret', 10);
      expect(await drops.findBySlug('secret')).not.toHaveProperty('videoAssetId');
    });

    it('lists only published drops', async () => {
      await drop('shown', 10);
      await drop('hidden', 10, 'draft');
      expect((await drops.listPublished()).map((d) => d.slug)).toEqual(['shown']);
    });
  });

  describe('account', () => {
    async function buyer() {
      const suffix = Math.random().toString(36).slice(2);
      const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [`u-${suffix}@x.co`]);
      return u.id as string;
    }

    it('shows what was bought, with an image per line', async () => {
      const userId = await buyer();
      const [p] = await ds.query(
        `INSERT INTO pieces (slug, title, price_usd_cents, images, status, published_at)
         VALUES ('boceto', 'Boceto', 250000, '["cover.jpg"]', 'available', now()) RETURNING id`,
      );
      const [d] = await ds.query(
        `INSERT INTO drops (slug, title, price_usd_cents, video_asset_id, poster_image, status, published_at)
         VALUES ('maqueta', 'Maqueta', 15000, 'vid', 'poster.jpg', 'available', now()) RETURNING id`,
      );
      const [o] = await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference, status)
         VALUES ($1, 265000, 'CARD', 'ord_1', 'paid') RETURNING id`,
        [userId],
      );
      await ds.query(
        `INSERT INTO order_items (order_id, piece_id, unit_price_cop) VALUES ($1, $2, 250000)`,
        [o.id, p.id],
      );
      await ds.query(
        `INSERT INTO order_items (order_id, drop_id, unit_price_cop) VALUES ($1, $2, 15000)`,
        [o.id, d.id],
      );

      const [order] = await account.orders(userId);
      expect(order.totalCop).toBe(265000);
      expect(order.items).toEqual(
        expect.arrayContaining([
          { kind: 'piece', slug: 'boceto', title: 'Boceto', image: 'cover.jpg', signed: false },
          { kind: 'drop', slug: 'maqueta', title: 'Maqueta', image: 'poster.jpg', signed: false },
        ]),
      );
    });

    /**
     * The receipt tells the buyer the contract is in their account. Without
     * this the account has nowhere to link to and that sentence is a lie.
     */
    describe('the contract of an order', () => {
      const orderWithContract = async (contractStatus: string): Promise<string> => {
        const userId = await buyer();
        const [p] = await ds.query(
          `INSERT INTO pieces (slug, title, price_usd_cents, status, published_at)
           VALUES ($1, 'P', 250000, 'available', now()) RETURNING id`,
          [`p-${Math.random().toString(36).slice(2)}`],
        );
        const [o] = await ds.query(
          `INSERT INTO orders (user_id, total_cop, payment_method, reference, status)
           VALUES ($1, 250000, 'CARD', $2, 'paid') RETURNING id`,
          [userId, `ord_${Math.random().toString(36).slice(2)}`],
        );
        await ds.query(
          // signed_at is not optional here: the table refuses a contract past
          // 'draft' without it, which is the point of that constraint.
          `INSERT INTO contracts (order_id, piece_id, pdf_url, document_hash, status, signed_at, evidence)
           VALUES ($1, $2, 'contracts/x.pdf', 'abc', $3, now(), '{}'::jsonb)`,
          [o.id, p.id, contractStatus],
        );
        return userId;
      };

      it('is offered once it is signed', async () => {
        const [order] = await account.orders(await orderWithContract('executed'));
        expect(order.contractId).not.toBeNull();
      });

      it('is not offered when it was voided', async () => {
        // A void contract describes a sale that did not happen.
        const [order] = await account.orders(await orderWithContract('void'));
        expect(order.contractId).toBeNull();
      });

      it('is null on an order that never had one', async () => {
        const userId = await buyer();
        await ds.query(
          `INSERT INTO orders (user_id, total_cop, payment_method, reference, status)
           VALUES ($1, 15000, 'CARD', 'ord_solo_video', 'paid')`,
          [userId],
        );
        const [order] = await account.orders(userId);
        expect(order.contractId).toBeNull();
      });
    });

    it('turns a known carrier into a link and an unknown one into plain text', async () => {
      const userId = await buyer();
      await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference, status,
                             tracking_carrier, tracking_number, created_at)
         VALUES ($1, 1000, 'CARD', 'ord_known', 'paid', 'servientrega', '123', now()),
                ($1, 1000, 'CARD', 'ord_odd', 'paid', 'la mula de mi tío', '456', now() - interval '1 hour')`,
        [userId],
      );

      const [known, odd] = await account.orders(userId);
      expect(known.tracking).toEqual({
        number: '123',
        carrier: 'servientrega',
        url: expect.stringContaining('123'),
      });
      expect(odd.tracking!.url).toBeNull();
    });

    it('has no tracking before it ships', async () => {
      const userId = await buyer();
      await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference)
         VALUES ($1, 1000, 'CARD', 'ord_new')`,
        [userId],
      );
      expect((await account.orders(userId))[0].tracking).toBeNull();
    });

    it('shows nobody else\'s orders', async () => {
      const mine = await buyer();
      const other = await buyer();
      await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference)
         VALUES ($1, 1000, 'CARD', 'ord_other')`,
        [other],
      );
      expect(await account.orders(mine)).toEqual([]);
    });

    describe('entitlements', () => {
      async function entitlement(userId: string, opts: { played?: boolean; expired?: boolean } = {}) {
        const suffix = Math.random().toString(36).slice(2);
        const [d] = await ds.query(
          `INSERT INTO drops (slug, title, price_usd_cents, video_asset_id, status, published_at)
           VALUES ($1, 'D', 15000, 'vid', 'available', now()) RETURNING id`,
          [`d-${suffix}`],
        );
        const [o] = await ds.query(
          `INSERT INTO orders (user_id, total_cop, payment_method, reference, status)
           VALUES ($1, 15000, 'CARD', $2, 'paid') RETURNING id`,
          [userId, `ord_${suffix}`],
        );
        const [e] = await ds.query(
          `INSERT INTO entitlements (user_id, drop_id, order_id, first_played_at, expires_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            userId,
            d.id,
            o.id,
            opts.played ? new Date() : null,
            opts.played ? new Date(Date.now() + (opts.expired ? -3600_000 : 36000_000)) : null,
          ],
        );
        return e.id as string;
      }

      it('calls an untouched access unopened', async () => {
        const userId = await buyer();
        await entitlement(userId);
        expect((await account.entitlements(userId))[0].state).toBe('unopened');
      });

      it('calls a running window open', async () => {
        const userId = await buyer();
        await entitlement(userId, { played: true });
        expect((await account.entitlements(userId))[0].state).toBe('open');
      });

      it('calls a finished window consumed', async () => {
        const userId = await buyer();
        await entitlement(userId, { played: true, expired: true });
        expect((await account.entitlements(userId))[0].state).toBe('consumed');
      });

      it('finds one access by id, and only its owner\'s', async () => {
        const userId = await buyer();
        const other = await buyer();
        const id = await entitlement(userId);

        expect((await account.findEntitlement(id, userId))!.id).toBe(id);
        expect(await account.findEntitlement(id, other)).toBeNull();
      });

      it('carries the watermark address on the single access, not on the list', async () => {
        const userId = await buyer();
        const id = await entitlement(userId);

        expect((await account.findEntitlement(id, userId))!.viewerEmail).toContain('@');
        expect((await account.entitlements(userId))[0].viewerEmail).toBeUndefined();
      });
    });
  });
});
