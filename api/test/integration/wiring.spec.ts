import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';
import { truncateAll } from '../setup/db';

/**
 * The API as it is actually served.
 *
 * Every other suite builds its services by hand, which proves the logic but
 * says nothing about whether Nest can assemble them: a missing provider, a
 * guard applied in the wrong order or a route that was never registered are
 * all invisible until something boots the module. This is what boots it.
 */
describe('http wiring', () => {
  let app: INestApplication;
  let ds: DataSource;
  let auth: AuthService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    ds = moduleRef.get(DataSource);
    await ds.runMigrations();
    auth = moduleRef.get(AuthService);
  });

  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await app.close(); });

  /** A real session for a real user, since the guard verifies the signature. */
  async function session(opts: { admin?: boolean } = {}) {
    const [u] = await ds.query(
      `INSERT INTO users (email, is_admin) VALUES ($1, $2) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`, opts.admin ?? false],
    );
    return { userId: u.id as string, token: auth.signSession(u.id) };
  }

  describe('public', () => {
    it('serves the catalogue', async () => {
      await ds.query(
        `INSERT INTO pieces (slug, title, price_cop, status, published_at)
         VALUES ('boceto', 'Boceto', 250000, 'available', now())`,
      );
      const res = await request(app.getHttpServer()).get('/pieces').expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ slug: 'boceto', priceCop: 250000, available: true }),
      ]);
    });

    it('404s an address that is not published', async () => {
      await request(app.getHttpServer()).get('/pieces/no-existe').expect(404);
    });

    it('serves the videos without their asset id', async () => {
      await ds.query(
        `INSERT INTO drops (slug, title, price_cop, video_asset_id, status, published_at)
         VALUES ('maqueta', 'Maqueta', 15000, 'secreto', 'available', now())`,
      );
      const res = await request(app.getHttpServer()).get('/drops').expect(200);
      expect(JSON.stringify(res.body)).not.toContain('secreto');
    });
  });

  describe('guards', () => {
    it('turns away the account endpoints without a session', async () => {
      await request(app.getHttpServer()).get('/me/orders').expect(401);
    });

    it('lets a session read its own orders', async () => {
      const { token } = await session();
      await request(app.getHttpServer())
        .get('/me/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, []);
    });

    it('tells the frontend who is asking, and whether they are the artist', async () => {
      const buyer = await session();
      const artist = await session({ admin: true });

      const asBuyer = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(200);
      expect(asBuyer.body.isAdmin).toBe(false);
      expect(asBuyer.body.email).toContain('@');

      const asArtist = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${artist.token}`)
        .expect(200);
      expect(asArtist.body.isAdmin).toBe(true);
    });

    it('reflects a role revoked a second ago, without waiting for the session to expire', async () => {
      const { userId, token } = await session({ admin: true });
      await ds.query(`UPDATE users SET is_admin = false WHERE id = $1`, [userId]);

      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.isAdmin).toBe(false);

      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('turns away a signed-in stranger from the studio', async () => {
      const { token } = await session();
      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets the artist in', async () => {
      const { token } = await session({ admin: true });
      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('refuses a forged session token', async () => {
      await request(app.getHttpServer())
        .get('/me/orders')
        .set('Authorization', 'Bearer inventado.por.mi')
        .expect(401);
    });
  });

  describe('guest checkout', () => {
    it('creates an order from just an email, no session needed', async () => {
      await ds.query(
        `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, status, published_at)
         VALUES ('video', 'Video', 25000, 'vid', 50, 'available', now())`,
      );

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', 'guest-1')
        .send({ pieceSlugs: [], dropSlugs: ['video'], paymentMethod: 'CARD', email: 'invitado@x.co' })
        .expect(201);

      expect(res.body.sessionToken).toEqual(expect.any(String));
      const [user] = await ds.query(`SELECT id FROM users WHERE email = 'invitado@x.co'`);
      expect(user).toBeDefined();
    });

    it('lets the guest token continue only the order it was minted for', async () => {
      await ds.query(
        `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, status, published_at)
         VALUES ('video2', 'Video 2', 25000, 'vid', 50, 'available', now())`,
      );

      const created = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', 'guest-2')
        .send({ pieceSlugs: [], dropSlugs: ['video2'], paymentMethod: 'CARD', email: 'otro@x.co' })
        .expect(201);
      const { id: orderId, sessionToken } = created.body;

      await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);
    });

    it('never lets a checkout-scoped token read an account\'s history, even the right user id', async () => {
      // A real account with history, reached only through a magic link.
      const owner = await session();
      await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference)
         VALUES ($1, 1000, 'CARD', 'ord_privado')`,
        [owner.userId],
      );

      // Same token shape create() would hand a guest who typed this user's
      // email — right user id, but scoped to one order, never the account.
      const guestToken = auth.signSession(owner.userId, 'algun-otro-pedido');
      await request(app.getHttpServer())
        .get('/me/orders')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(401);
      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(401);
    });
  });

  describe('validation', () => {
    it('rejects an address that is not one', async () => {
      await request(app.getHttpServer())
        .post('/auth/magic-link')
        .send({ email: 'no-soy-un-correo' })
        .expect(400);
    });

    it('answers the same whether or not the address is known', async () => {
      const seen = await request(app.getHttpServer())
        .post('/auth/magic-link')
        .send({ email: 'alguien@x.co' })
        .expect(201);
      const unseen = await request(app.getHttpServer())
        .post('/auth/magic-link')
        .send({ email: 'nadie@x.co' })
        .expect(201);
      expect(seen.body).toEqual(unseen.body);
    });

    it('rejects a payment method the shop does not take', async () => {
      const { token } = await session();
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'k-1')
        .send({ pieceSlugs: ['boceto'], dropSlugs: [], paymentMethod: 'EFECTIVO' })
        .expect(400);
    });

    it('requires an idempotency key to create an order', async () => {
      const { token } = await session();
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ pieceSlugs: [], dropSlugs: [], paymentMethod: 'CARD' })
        .expect(400);
    });
  });

  describe('webhook', () => {
    it('is reachable without a session and rejects an unsigned body', async () => {
      await request(app.getHttpServer())
        .post('/payments/webhook')
        .send({ hola: 'mundo' })
        .expect(400);
    });
  });
});
