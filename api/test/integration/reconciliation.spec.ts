import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PaymentGateway, PaymentStatus } from '../../src/payments/payment-gateway';
import { PaymentsService } from '../../src/payments/payments.service';
import { ReconciliationService } from '../../src/payments/reconciliation.service';
import { WompiGateway } from '../../src/payments/wompi/wompi.gateway';
import { PiecesService } from '../../src/pieces/pieces.service';
import { DropsService } from '../../src/drops/drops.service';
import { MailService } from '../../src/mail/mail.service';

const EVENTS_SECRET = 'test_events_secret';

const CONFIG = {
  get: (k: string) =>
    ({
      WOMPI_PUBLIC_KEY: 'pub_test',
      WOMPI_PRIVATE_KEY: 'prv_test',
      WOMPI_EVENTS_SECRET: EVENTS_SECRET,
      WOMPI_INTEGRITY_SECRET: 'test_integrity_secret',
      WOMPI_CHECKOUT_URL: 'https://checkout.wompi.co/p/',
      WOMPI_BASE_URL: 'https://sandbox.wompi.co/v1',
    })[k],
} as ConfigService;

class FakeMail {
  async send() {}
}

/** Builds a webhook exactly as Wompi does, uppercase checksum included. */
function wompiEvent(reference: string, txId: string, status: string, cents: number) {
  const timestamp = 1755000000;
  const checksum = createHash('sha256')
    .update(`${txId}${status}${cents}${timestamp}${EVENTS_SECRET}`)
    .digest('hex')
    .toUpperCase();

  return {
    event: 'transaction.updated',
    data: { transaction: { id: txId, reference, status, amount_in_cents: cents } },
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum,
    },
    timestamp,
  };
}

describe('payment reconciliation', () => {
  let ds: DataSource;
  let payments: PaymentsService;
  let gateway: WompiGateway;

  beforeAll(async () => {
    ds = await testDb();
    gateway = new WompiGateway(CONFIG);
    payments = new PaymentsService(
      ds,
      gateway,
      new PiecesService(ds),
      new DropsService(ds),
      new FakeMail() as unknown as MailService,
    );
  });

  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  /** A pending order that already carries its piece's unit, aged into the past. */
  async function pendingOrder(
    opts: { ageMinutes: number; transactionId?: string | null; method?: string } = { ageMinutes: 60 },
  ) {
    const suffix = Math.random().toString(36).slice(2);
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [`u-${suffix}@x.co`]);
    const [p] = await ds.query(
      `INSERT INTO pieces (slug, title, price_cop, stock, status, published_at)
       VALUES ($1, 'P', 500000, 0, 'available', now()) RETURNING id`,
      [`p-${suffix}`],
    );
    const reference = `ord_${suffix}`;
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference, wompi_transaction_id, created_at)
       VALUES ($1, 500000, $2, $3, $4, now() - make_interval(mins => $5)) RETURNING id`,
      [u.id, opts.method ?? 'CARD', reference, opts.transactionId ?? null, opts.ageMinutes],
    );
    await ds.query(
      `INSERT INTO order_items (order_id, piece_id, unit_price_cop) VALUES ($1, $2, 500000)`,
      [o.id, p.id],
    );
    await ds.query(
      `INSERT INTO contracts (order_id, piece_id, pdf_url, document_hash, status, signed_at, evidence)
       VALUES ($1, $2, 'https://f/x.pdf', 'abc', 'signed_pending_payment', now(), '{}'::jsonb)`,
      [o.id, p.id],
    );
    return { orderId: o.id, pieceId: p.id, reference };
  }

  /** A gateway whose remote answer is fixed, so the job is what is under test. */
  function serviceAnswering(status: PaymentStatus) {
    const remote = {
      ...gateway,
      fetchTransaction: jest.fn(async () => ({ status, reference: 'x', amountInCents: 50000000 })),
      // Nothing at the gateway under that reference: an abandoned checkout.
      findByReference: jest.fn(async () => null),
      eventIdFor: gateway.eventIdFor.bind(gateway),
    } as unknown as PaymentGateway;
    return {
      service: new ReconciliationService(ds, remote, payments, new PiecesService(ds)),
      fetchTransaction: remote.fetchTransaction as jest.Mock,
    };
  }

  const orderStatus = async (id: string): Promise<string> =>
    (await ds.query(`SELECT status FROM orders WHERE id = $1`, [id]))[0].status;

  const stock = async (id: string): Promise<number> =>
    (await ds.query(`SELECT stock FROM pieces WHERE id = $1`, [id]))[0].stock;

  it('leaves alone an order still inside its deadline', async () => {
    const o = await pendingOrder({ ageMinutes: 5 });
    const { service, fetchTransaction } = serviceAnswering('APPROVED');

    expect(await service.run()).toEqual({ checked: 0, expired: 0 });
    expect(fetchTransaction).not.toHaveBeenCalled();
    expect(await orderStatus(o.orderId)).toBe('pending');
  });

  it('gives each payment method its own deadline', async () => {
    // 30 minutes is past a card's 15 but well inside PSE's 45.
    const pse = await pendingOrder({ ageMinutes: 30, method: 'PSE' });
    const card = await pendingOrder({ ageMinutes: 30, method: 'CARD' });
    const { service } = serviceAnswering('APPROVED');

    await service.run();
    expect(await orderStatus(pse.orderId)).toBe('pending');
    expect(await orderStatus(card.orderId)).toBe('expired');
  });

  it('expires an abandoned checkout that never reached the gateway', async () => {
    const o = await pendingOrder({ ageMinutes: 60, transactionId: null });
    const { service, fetchTransaction } = serviceAnswering('APPROVED');

    // Checked now: the payment is looked up by reference before giving up on
    // it, because expiring a paid order returns stock that was sold.
    expect(await service.run()).toEqual({ checked: 1, expired: 1 });
    expect(fetchTransaction).not.toHaveBeenCalled();
    expect(await orderStatus(o.orderId)).toBe('expired');
    expect(await stock(o.pieceId)).toBe(1);
  });

  it('keeps the signed contract when it expires, so a late approval still executes it', async () => {
    const o = await pendingOrder({ ageMinutes: 60, transactionId: null });
    await serviceAnswering('APPROVED').service.run();

    const [c] = await ds.query(`SELECT status FROM contracts WHERE order_id = $1`, [o.orderId]);
    expect(c.status).toBe('signed_pending_payment');
  });

  it('settles an approval whose webhook never arrived', async () => {
    const o = await pendingOrder({ ageMinutes: 60, transactionId: 'tx-lost' });
    const { service } = serviceAnswering('APPROVED');

    expect(await service.run()).toEqual({ checked: 1, expired: 0 });
    expect(await orderStatus(o.orderId)).toBe('paid');
    const [c] = await ds.query(`SELECT status FROM contracts WHERE order_id = $1`, [o.orderId]);
    expect(c.status).toBe('executed');
  });

  it('settles a decline and gives the unit back', async () => {
    const o = await pendingOrder({ ageMinutes: 60, transactionId: 'tx-dead' });
    await serviceAnswering('DECLINED').service.run();

    expect(await orderStatus(o.orderId)).toBe('failed');
    expect(await stock(o.pieceId)).toBe(1);
  });

  it('waits while the gateway still reports the payment in progress', async () => {
    const o = await pendingOrder({ ageMinutes: 20, transactionId: 'tx-slow' });
    await serviceAnswering('PENDING').service.run();

    expect(await orderStatus(o.orderId)).toBe('pending');
    expect(await stock(o.pieceId)).toBe(0);
  });

  it('expires a payment left in progress past twice its deadline', async () => {
    const o = await pendingOrder({ ageMinutes: 40, transactionId: 'tx-stuck' });

    expect(await serviceAnswering('PENDING').service.run()).toEqual({ checked: 1, expired: 1 });
    expect(await orderStatus(o.orderId)).toBe('expired');
    expect(await stock(o.pieceId)).toBe(1);
  });

  it('rescues a payment whose id we never learnt', async () => {
    // Paid, tab closed, no webhook: the order carries no transaction id at all.
    // Before, it was expired and the stock went back with the money gone.
    const o = await pendingOrder({ ageMinutes: 60, transactionId: null });
    const found = {
      ...gateway,
      eventIdFor: gateway.eventIdFor.bind(gateway),
      fetchTransaction: jest.fn(),
      findByReference: jest.fn(async () => ({
        transactionId: 'tx-rescatada', status: 'APPROVED' as PaymentStatus, amountInCents: 50000000,
      })),
    } as unknown as PaymentGateway;

    await new ReconciliationService(ds, found, payments, new PiecesService(ds)).run();

    expect(await orderStatus(o.orderId)).toBe('paid');
    expect(await stock(o.pieceId)).toBe(0);
  });

  it('does not settle twice when the missing webhook finally arrives', async () => {
    const o = await pendingOrder({ ageMinutes: 60, transactionId: 'tx-late' });
    await serviceAnswering('APPROVED').service.run();

    // Wompi retries the webhook hours later. Same transaction, same outcome.
    await payments.handleWebhook(wompiEvent(o.reference, 'tx-late', 'APPROVED', 50000000));

    const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM payment_events`);
    expect(count).toBe(1);
  });

  it('does not release the unit twice when a late VOIDED repeats a decline', async () => {
    const o = await pendingOrder({ ageMinutes: 60, transactionId: 'tx-void' });
    await serviceAnswering('DECLINED').service.run();

    // Wompi calls it VOIDED; this system calls it DECLINED. One event, not two.
    await payments.handleWebhook(wompiEvent(o.reference, 'tx-void', 'VOIDED', 50000000));

    expect(await stock(o.pieceId)).toBe(1);
  });

  it('keeps going when the gateway fails on one order', async () => {
    await pendingOrder({ ageMinutes: 60, transactionId: 'tx-a' });
    await pendingOrder({ ageMinutes: 60, transactionId: 'tx-b' });

    let first = true;
    const remote = {
      ...gateway,
      eventIdFor: gateway.eventIdFor.bind(gateway),
      findByReference: jest.fn(async () => null),
      fetchTransaction: jest.fn(async () => {
        if (first) { first = false; throw new Error('WOMPI_QUERY_FAILED_500'); }
        return { status: 'APPROVED' as PaymentStatus, reference: 'x', amountInCents: 50000000 };
      }),
    } as unknown as PaymentGateway;

    // Whichever order the query returns them in, the failure costs only its own.
    const result = await new ReconciliationService(ds, remote, payments, new PiecesService(ds)).run();
    expect(result.checked).toBe(2);
    const [{ paid }] = await ds.query(
      `SELECT count(*)::int AS paid FROM orders WHERE status = 'paid'`,
    );
    expect(paid).toBe(1);
  });
});
