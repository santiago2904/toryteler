import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PaymentsService } from '../../src/payments/payments.service';
import { WompiGateway } from '../../src/payments/wompi/wompi.gateway';
import { PiecesService } from '../../src/pieces/pieces.service';
import { DropsService } from '../../src/drops/drops.service';
import { MailService } from '../../src/mail/mail.service';
import { DocumentStore } from '../../src/storage/document-store';

const EVENTS_SECRET = 'test_events_secret';
const INTEGRITY_SECRET = 'test_integrity_secret';

const CONFIG = {
  get: (k: string) =>
    ({
      WOMPI_PUBLIC_KEY: 'pub_test',
      WOMPI_PRIVATE_KEY: 'prv_test',
      WOMPI_EVENTS_SECRET: EVENTS_SECRET,
      WOMPI_INTEGRITY_SECRET: INTEGRITY_SECRET,
      WOMPI_CHECKOUT_URL: 'https://checkout.wompi.co/p/',
      WOMPI_BASE_URL: 'https://sandbox.wompi.co/v1',
    } as Record<string, string>)[k],
} as ConfigService;

/** Stands in for Cloudinary: the bytes of a contract that was really stored. */
class FakeDocs {
  readable = true;
  async readPdf(): Promise<Buffer> {
    if (!this.readable) throw new Error('DOCUMENT_FETCH_FAILED_404');
    return Buffer.from('%PDF-1.7 contrato firmado');
  }
}

class FakeMail {
  sent: string[] = [];
  last: { html?: string; attachments?: { filename: string }[] } | null = null;
  async send(message: { dedupeKey?: string; html?: string; attachments?: { filename: string }[] }) {
    this.sent.push(message.dedupeKey ?? 'sin-clave');
    this.last = message;
  }
}

/** Builds a webhook exactly as Wompi does, uppercase checksum included. */
function wompiEvent(reference: string, txId: string, status: string, cents: number) {
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const timestamp = 1755000000;
  const concatenated = `${txId}${status}${cents}`;
  const checksum = createHash('sha256')
    .update(`${concatenated}${timestamp}${EVENTS_SECRET}`)
    .digest('hex')
    .toUpperCase();

  return {
    event: 'transaction.updated',
    data: { transaction: { id: txId, reference, status, amount_in_cents: cents } },
    signature: { properties, checksum },
    timestamp,
  };
}

describe('payment settlement', () => {
  let ds: DataSource;
  let payments: PaymentsService;
  let gateway: WompiGateway;
  let mail: FakeMail;
  let docs: FakeDocs;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    docs = new FakeDocs();
    gateway = new WompiGateway(CONFIG);
    payments = new PaymentsService(
      ds, gateway, new PiecesService(ds), new DropsService(ds), mail as unknown as MailService,
      docs as unknown as DocumentStore,
    );
  });

  beforeEach(async () => {
    await truncateAll(ds);
    mail.sent = [];
    mail.last = null;
    docs.readable = true;
  });
  afterAll(async () => { await ds.destroy(); });

  async function pendingOrder(opts: { piece?: boolean; drop?: boolean; dropCapacity?: number } = {}) {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    const reference = `ord_${Math.random().toString(36).slice(2)}`;
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference)
       VALUES ($1, 500000, 'CARD', $2) RETURNING id`, [u.id, reference]);

    let pieceId: string | null = null;
    let dropId: string | null = null;

    if (opts.piece) {
      const [p] = await ds.query(
        `INSERT INTO pieces (slug, title, price_cop, stock, status, published_at)
         VALUES ($1, 'P', 500000, 0, 'available', now()) RETURNING id`,
        [`p-${Math.random().toString(36).slice(2)}`]);
      pieceId = p.id;
      await ds.query(
        `INSERT INTO order_items (order_id, piece_id, unit_price_cop) VALUES ($1, $2, 500000)`,
        [o.id, p.id]);
      await ds.query(
        `INSERT INTO contracts (order_id, piece_id, pdf_url, document_hash, status, signed_at, evidence)
         VALUES ($1, $2, 'https://f/x.pdf', 'abc', 'signed_pending_payment', now(), '{}'::jsonb)`,
        [o.id, p.id]);
    }

    if (opts.drop) {
      const [d] = await ds.query(
        `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, status, published_at)
         VALUES ($1, 'D', 25000, 'vid', $2, 'available', now()) RETURNING id`,
        [`d-${Math.random().toString(36).slice(2)}`, opts.dropCapacity ?? 50]);
      dropId = d.id;
      await ds.query(
        `INSERT INTO order_items (order_id, drop_id, unit_price_cop) VALUES ($1, $2, 25000)`,
        [o.id, d.id]);
    }

    return { orderId: o.id, reference, userId: u.id, pieceId, dropId };
  }

  const status = async (orderId: string): Promise<string> => {
    const [o] = await ds.query(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    return o.status;
  };

  describe('webhook authenticity', () => {
    it('rejects a forged checksum', async () => {
      const ev = wompiEvent('ord_x', 'tx1', 'APPROVED', 50000000);
      ev.signature.checksum = 'falsa';
      await expect(payments.handleWebhook(ev)).rejects.toThrow(/INVALID_SIGNATURE/);
    });

    it('accepts the checksum Wompi actually sends, uppercase', () => {
      expect(gateway.verifyWebhook(wompiEvent('ord_y', 'tx2', 'APPROVED', 1000))).toBe(true);
    });

    it('rejects a body that is not an event', async () => {
      await expect(payments.handleWebhook({ hola: 'mundo' })).rejects.toThrow(/INVALID_SIGNATURE/);
    });

    it('keys the event by transaction and status, so PENDING then APPROVED both settle', () => {
      const pending = gateway.parseWebhook(wompiEvent('r', 'tx3', 'PENDING', 1000));
      const approved = gateway.parseWebhook(wompiEvent('r', 'tx3', 'APPROVED', 1000));
      expect(pending.providerEventId).not.toBe(approved.providerEventId);
    });
  });

  describe('approved', () => {
    it('marks paid and executes the contract', async () => {
      const o = await pendingOrder({ piece: true });
      await payments.handleWebhook(wompiEvent(o.reference, 'tx10', 'APPROVED', 50000000));

      expect(await status(o.orderId)).toBe('paid');
      const [c] = await ds.query(`SELECT status FROM contracts WHERE order_id = $1`, [o.orderId]);
      expect(c.status).toBe('executed');
      expect(mail.sent).toHaveLength(1);
    });

    it('issues the video seat', async () => {
      const o = await pendingOrder({ drop: true });
      await payments.handleWebhook(wompiEvent(o.reference, 'tx11', 'APPROVED', 2500000));
      const [{ count }] = await ds.query(
        `SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1 AND user_id = $2`,
        [o.dropId, o.userId]);
      expect(count).toBe(1);
    });

    it('three deliveries of the same event have one effect', async () => {
      const o = await pendingOrder({ piece: true, drop: true });
      const ev = wompiEvent(o.reference, 'tx12', 'APPROVED', 52500000);
      await payments.handleWebhook(ev);
      await payments.handleWebhook(ev);
      await payments.handleWebhook(ev);

      const [{ ent }] = await ds.query(
        `SELECT count(*)::int AS ent FROM entitlements WHERE drop_id = $1`, [o.dropId]);
      const [{ evs }] = await ds.query(`SELECT count(*)::int AS evs FROM payment_events`);
      expect(ent).toBe(1);
      expect(evs).toBe(1);
      expect(mail.sent).toHaveLength(1);
    });

    describe('the signed contract travels with the receipt', () => {
      it('goes attached, named after the order', async () => {
        const o = await pendingOrder({ piece: true });
        await payments.handleWebhook(wompiEvent(o.reference, 'tx40', 'APPROVED', 50000000));

        expect(mail.last?.attachments).toHaveLength(1);
        expect(mail.last?.attachments?.[0].filename).toBe(`contrato-${o.reference}.pdf`);
        expect(mail.last?.html).toMatch(/va adjunto a este correo/i);
      });

      it('still sends the receipt when the document cannot be read', async () => {
        // Losing the attachment must not cost the buyer the confirmation, and
        // the message has to stop claiming an attachment that is not there.
        docs.readable = false;
        const o = await pendingOrder({ piece: true });
        await payments.handleWebhook(wompiEvent(o.reference, 'tx41', 'APPROVED', 50000000));

        expect(await status(o.orderId)).toBe('paid');
        expect(mail.sent).toHaveLength(1);
        expect(mail.last?.attachments).toHaveLength(0);
        expect(mail.last?.html).not.toMatch(/adjunto/i);
        expect(mail.last?.html).toMatch(/queda guardado en tu cuenta/i);
      });

      it('attaches nothing when the order is only a video', async () => {
        const o = await pendingOrder({ drop: true });
        await payments.handleWebhook(wompiEvent(o.reference, 'tx42', 'APPROVED', 2500000));
        expect(mail.last?.attachments).toHaveLength(0);
      });
    });

    it('stays paid when the mail provider refuses the receipt', async () => {
      // The transaction has already committed by the time the receipt goes
      // out. Letting that failure through would answer a buyer coming back
      // from the gateway with an error over a purchase that went through.
      const broken = { async send() { throw new Error('RESEND_FAILED_403'); } };
      const service = new PaymentsService(
        ds, gateway, new PiecesService(ds), new DropsService(ds),
        broken as unknown as MailService, docs as unknown as DocumentStore,
      );
      const o = await pendingOrder({ piece: true });

      await expect(
        service.handleWebhook(wompiEvent(o.reference, 'tx16', 'APPROVED', 50000000)),
      ).resolves.toBeUndefined();
      expect(await status(o.orderId)).toBe('paid');
    });

    it('tells the buyer which pieces go signed', async () => {
      const o = await pendingOrder({ piece: true });
      await ds.query(`UPDATE order_items SET wants_signature = true WHERE order_id = $1`, [o.orderId]);

      const receipts: { html?: string }[] = [];
      const capturing = { async send(m: { html?: string }) { receipts.push(m); } };
      const service = new PaymentsService(
        ds, gateway, new PiecesService(ds), new DropsService(ds),
        capturing as unknown as MailService, docs as unknown as DocumentStore,
      );

      await service.handleWebhook(wompiEvent(o.reference, 'tx17', 'APPROVED', 50000000));
      expect(receipts[0].html).toMatch(/firmada por el artista/i);
    });

    it('refunds when the seat ran out before the payment confirmed', async () => {
      const o = await pendingOrder({ drop: true, dropCapacity: 1 });
      // Someone else took the only seat in the meantime.
      const [other] = await ds.query(`INSERT INTO users (email) VALUES ('otro@x.co') RETURNING id`);
      await ds.query(
        `INSERT INTO entitlements (user_id, drop_id, order_id) VALUES ($1, $2, $3)`,
        [other.id, o.dropId, o.orderId]);

      await payments.handleWebhook(wompiEvent(o.reference, 'tx13', 'APPROVED', 2500000));
      expect(await status(o.orderId)).toBe('refunded');
    });

    it('takes the unit again when the order had expired and stock remains', async () => {
      const o = await pendingOrder({ piece: true });
      // Expiry gave the unit back.
      await ds.query(`UPDATE orders SET status = 'expired' WHERE id = $1`, [o.orderId]);
      await ds.query(`UPDATE pieces SET stock = 1 WHERE id = $1`, [o.pieceId]);

      await payments.handleWebhook(wompiEvent(o.reference, 'tx14', 'APPROVED', 50000000));
      expect(await status(o.orderId)).toBe('paid');
      const [p] = await ds.query(`SELECT stock FROM pieces WHERE id = $1`, [o.pieceId]);
      expect(p.stock).toBe(0);
    });

    it('refunds when it expired and the piece is gone', async () => {
      const o = await pendingOrder({ piece: true });
      await ds.query(`UPDATE orders SET status = 'expired' WHERE id = $1`, [o.orderId]);
      // stock stays at 0: someone else bought it.

      await payments.handleWebhook(wompiEvent(o.reference, 'tx15', 'APPROVED', 50000000));
      expect(await status(o.orderId)).toBe('refunded');
      const [c] = await ds.query(`SELECT status FROM contracts WHERE order_id = $1`, [o.orderId]);
      expect(c.status).toBe('void');
    });
  });

  describe('confirming from the return URL', () => {
    /** The gateway, answering about a transaction we did not ask it about. */
    function answering(reference: string, status: 'APPROVED' | 'PENDING') {
      const remote = {
        ...gateway,
        eventIdFor: gateway.eventIdFor.bind(gateway),
        fetchTransaction: async () => ({ status, reference, amountInCents: 50000000 }),
      } as unknown as WompiGateway;
      return new PaymentsService(
        ds, remote, new PiecesService(ds), new DropsService(ds), mail as unknown as MailService,
        docs as unknown as DocumentStore,
      );
    }

    it('settles the order the gateway says the payment belongs to', async () => {
      const o = await pendingOrder({ piece: true });
      const userId = await ownerOf(o.orderId);

      await answering(o.reference, 'APPROVED').confirm(o.orderId, userId, 'tx30');
      expect(await status(o.orderId)).toBe('paid');
    });

    it('refuses a transaction that belongs to another order', async () => {
      // The id arrives from a URL, so it could name somebody else's payment.
      // What closes that is the provider's own answer, not the id.
      const mine = await pendingOrder({ piece: true });
      const other = await pendingOrder({ piece: true });
      const userId = await ownerOf(mine.orderId);

      await expect(
        answering(other.reference, 'APPROVED').confirm(mine.orderId, userId, 'tx31'),
      ).rejects.toThrow(/TRANSACTION_MISMATCH/);
      expect(await status(mine.orderId)).toBe('pending');
    });

    it('refuses to confirm an order that is not the buyer\'s', async () => {
      const o = await pendingOrder({ piece: true });
      const [stranger] = await ds.query(`INSERT INTO users (email) VALUES ('ajeno@x.co') RETURNING id`);

      await expect(
        answering(o.reference, 'APPROVED').confirm(o.orderId, stranger.id, 'tx32'),
      ).rejects.toThrow(/ORDER_NOT_FOUND/);
    });

    it('leaves a payment still in progress alone', async () => {
      const o = await pendingOrder({ piece: true });
      const userId = await ownerOf(o.orderId);

      await answering(o.reference, 'PENDING').confirm(o.orderId, userId, 'tx33');
      expect(await status(o.orderId)).toBe('pending');
    });

    const ownerOf = async (orderId: string): Promise<string> =>
      (await ds.query(`SELECT user_id FROM orders WHERE id = $1`, [orderId]))[0].user_id;
  });

  describe('declined', () => {
    it('gives the unit back and voids the contract', async () => {
      const o = await pendingOrder({ piece: true });
      await payments.handleWebhook(wompiEvent(o.reference, 'tx20', 'DECLINED', 50000000));

      expect(await status(o.orderId)).toBe('failed');
      const [p] = await ds.query(`SELECT stock FROM pieces WHERE id = $1`, [o.pieceId]);
      expect(p.stock).toBe(1);
      const [c] = await ds.query(`SELECT status FROM contracts WHERE order_id = $1`, [o.orderId]);
      expect(c.status).toBe('void');
      expect(mail.sent).toHaveLength(0);
    });
  });

  describe('checkout url', () => {
    it('signs the integrity with the amount in cents', () => {
      const url = gateway.buildCheckoutUrl({
        reference: 'ord_abc', amountCop: 25000,
        customerEmail: 'a@b.co', redirectUrl: 'https://toryteler.co/ok',
      });
      const expected = createHash('sha256')
        .update(`ord_abc2500000COP${INTEGRITY_SECRET}`).digest('hex');
      expect(url).toContain(`signature%3Aintegrity=${expected}`);
      expect(url).toContain('amount-in-cents=2500000');
      // A public address travels; see the next test for why that matters.
      expect(url).toContain('redirect-url=');
    });

    it('leaves out a redirect back to localhost, which the checkout refuses', () => {
      // Wompi answers 403 through CloudFront when redirect-url points at
      // localhost, and that error looks like a blocked account rather than
      // like an address it will not take. Without it the checkout loads, and
      // the payment still settles over the webhook.
      const url = gateway.buildCheckoutUrl({
        reference: 'ord_local', amountCop: 25000,
        customerEmail: 'a@b.co', redirectUrl: 'http://localhost:3001/checkout/resultado',
      });
      expect(url).not.toContain('redirect-url');
    });
  });
});
