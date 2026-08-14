import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { OrdersService } from '../../src/orders/orders.service';
import { PiecesService } from '../../src/pieces/pieces.service';

describe('create order', () => {
  let ds: DataSource;
  let orders: OrdersService;

  beforeAll(async () => {
    ds = await testDb();
    orders = new OrdersService(ds, new PiecesService(ds));
  });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  const address = { line1: 'Calle 1', city: 'Medellín', phone: '3001234567' };

  const newUser = async (): Promise<string> => {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    return u.id;
  };

  const newPiece = async (priceCop = 500000, stock = 1, status = 'available'): Promise<string> => {
    const slug = `p-${Math.random().toString(36).slice(2)}`;
    await ds.query(
      `INSERT INTO pieces (slug, title, price_cop, stock, status, published_at)
       VALUES ($1, 'P', $2, $3, $4, now())`, [slug, priceCop, stock, status]);
    return slug;
  };

  const newDrop = async (priceCop = 25000): Promise<string> => {
    const slug = `d-${Math.random().toString(36).slice(2)}`;
    await ds.query(
      `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, status, published_at)
       VALUES ($1, 'D', $2, 'vid', 50, 'available', now())`, [slug, priceCop]);
    return slug;
  };

  it('adds up the total from database prices, not the request', async () => {
    const order = await orders.create(await newUser(), {
      pieceSlugs: [await newPiece(500000)],
      dropSlugs: [await newDrop(25000)],
      paymentMethod: 'CARD',
      shippingAddress: address,
    });
    expect(order.totalCop).toBe(525000);
    expect(order.reference).toMatch(/^ord_/);
  });

  it('takes the unit when the order is created', async () => {
    const slug = await newPiece(500000, 1);
    await orders.create(await newUser(), {
      pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    });
    const [piece] = await ds.query(`SELECT stock FROM pieces WHERE slug = $1`, [slug]);
    expect(piece.stock).toBe(0);
  });

  it('an edition survives several orders', async () => {
    const slug = await newPiece(100000, 3);
    for (let i = 0; i < 3; i++) {
      await orders.create(await newUser(), {
        pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
      });
    }
    await expect(orders.create(await newUser(), {
      pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    })).rejects.toThrow(/PIECE_UNAVAILABLE/);
  });

  it('gives the unit back if a later piece in the same order fails', async () => {
    const ok = await newPiece(100000, 1);
    const gone = await newPiece(100000, 1);
    await orders.create(await newUser(), {
      pieceSlugs: [gone], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    });

    await expect(orders.create(await newUser(), {
      pieceSlugs: [ok, gone], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    })).rejects.toThrow(/PIECE_UNAVAILABLE/);

    const [piece] = await ds.query(`SELECT stock FROM pieces WHERE slug = $1`, [ok]);
    expect(piece.stock).toBe(1);
  });

  it('requires an address when something physical is bought', async () => {
    await expect(orders.create(await newUser(), {
      pieceSlugs: [await newPiece()], dropSlugs: [], paymentMethod: 'CARD',
    })).rejects.toThrow(/SHIPPING_REQUIRED/);
  });

  it('needs no address for a video-only order', async () => {
    const order = await orders.create(await newUser(), {
      pieceSlugs: [], dropSlugs: [await newDrop(25000)], paymentMethod: 'PSE',
    });
    expect(order.totalCop).toBe(25000);
  });

  it('does not issue the video seat yet: that happens when the payment settles', async () => {
    await orders.create(await newUser(), {
      pieceSlugs: [], dropSlugs: [await newDrop()], paymentMethod: 'CARD',
    });
    const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM entitlements`);
    expect(count).toBe(0);
  });

  it('rejects an empty order', async () => {
    await expect(orders.create(await newUser(), {
      pieceSlugs: [], dropSlugs: [], paymentMethod: 'CARD',
    })).rejects.toThrow(/EMPTY_ORDER/);
  });

  it('rejects an unpublished piece', async () => {
    await expect(orders.create(await newUser(), {
      pieceSlugs: [await newPiece(100000, 1, 'draft')], dropSlugs: [],
      paymentMethod: 'CARD', shippingAddress: address,
    })).rejects.toThrow(/PIECE_UNAVAILABLE/);
  });

  it('rejects a slug that does not exist', async () => {
    await expect(orders.create(await newUser(), {
      pieceSlugs: ['no-existe'], dropSlugs: [],
      paymentMethod: 'CARD', shippingAddress: address,
    })).rejects.toThrow(/PIECE_UNAVAILABLE/);
  });

  it('records the price of the moment on each line', async () => {
    const slug = await newPiece(400000, 1);
    const order = await orders.create(await newUser(), {
      pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    });
    await ds.query(`UPDATE pieces SET price_cop = 999999 WHERE slug = $1`, [slug]);
    const [item] = await ds.query(
      `SELECT unit_price_cop FROM order_items WHERE order_id = $1`, [order.id]);
    expect(item.unit_price_cop).toBe(400000);
  });

  it('one unit goes to a single order under simultaneous checkouts', async () => {
    const slug = await newPiece(100000, 1);
    const buyers = await Promise.all(Array.from({ length: 8 }, () => newUser()));
    const results = await Promise.allSettled(buyers.map((userId) =>
      orders.create(userId, {
        pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
      })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
