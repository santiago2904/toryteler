import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DropsService } from '../drops/drops.service';
import { PiecesService } from '../pieces/pieces.service';
import { MailService } from '../mail/mail.service';
import { Message, purchaseConfirmed, refunded } from '../mail/templates';
import { affectedRows, firstRow, returnedRows } from '../database/rows';
import { PaymentEvent, PaymentGateway } from './payment-gateway';

interface Notification {
  email: string;
  message: Message;
}

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly gateway: PaymentGateway,
    private readonly pieces: PiecesService,
    private readonly drops: DropsService,
    private readonly mail: MailService,
  ) {}

  /** Where the buyer is sent to pay. */
  async startPayment(orderId: string): Promise<{ checkoutUrl: string }> {
    const order = firstRow<{ reference: string; total_cop: number; email: string; status: string }>(
      await this.ds.query(
        `SELECT o.reference, o.total_cop, o.status, u.email
           FROM orders o JOIN users u ON u.id = o.user_id
          WHERE o.id = $1`,
        [orderId],
      ),
    );
    if (!order) throw new BadRequestException('ORDER_NOT_FOUND');
    if (order.status !== 'pending') throw new BadRequestException('ORDER_NOT_PAYABLE');

    return {
      checkoutUrl: this.gateway.buildCheckoutUrl({
        reference: order.reference,
        amountCop: order.total_cop,
        customerEmail: order.email,
        // Separate from PUBLIC_WEB_URL because the two answer different
        // questions: that one is where the site lives — magic links, CORS —
        // and this is where a payment provider is allowed to send someone
        // back. In development they differ: the site is on localhost, which
        // Wompi refuses, and the return can point at a tunnel.
        redirectUrl: `${process.env.PAYMENT_RETURN_URL ?? process.env.PUBLIC_WEB_URL}/checkout/resultado?order=${orderId}`,
      }),
    };
  }

  /**
   * Settles a payment by asking the provider, instead of waiting to be told.
   *
   * The gateway sends the buyer back with the transaction id in the URL. That
   * id arrives from a browser and is worth nothing on its own, so it is used
   * only to look the payment up: what makes this safe is that the provider's
   * answer has to name this very order, and the settlement is the same
   * idempotent path a webhook takes. Whichever arrives second does nothing.
   *
   * Without it, someone who has just paid comes back to a page that says it
   * knows nothing — true, but useless — until a webhook lands.
   */
  async confirm(orderId: string, userId: string, transactionId: string): Promise<void> {
    const order = firstRow<{ reference: string }>(
      await this.ds.query(
        `SELECT reference FROM orders WHERE id = $1 AND user_id = $2`,
        [orderId, userId],
      ),
    );
    if (!order) throw new BadRequestException('ORDER_NOT_FOUND');

    const remote = await this.gateway.fetchTransaction(transactionId);

    // The id came from a URL: it could name somebody else's payment. Settling
    // only when the provider says it belongs to this order is what closes that.
    if (remote.reference !== order.reference) {
      this.log.warn(`Transacción ${transactionId} no corresponde a ${order.reference}`);
      throw new BadRequestException('TRANSACTION_MISMATCH');
    }
    if (remote.status === 'PENDING') return;

    await this.settle({
      providerEventId: this.gateway.eventIdFor(transactionId, remote.status),
      reference: order.reference,
      transactionId,
      status: remote.status,
      amountInCents: remote.amountInCents,
      trusted: true,
    });
  }

  /** Verifies a raw webhook body and settles it. */
  async handleWebhook(body: unknown): Promise<void> {
    if (!this.gateway.verifyWebhook(body)) throw new BadRequestException('INVALID_SIGNATURE');
    await this.settle(this.gateway.parseWebhook(body));
  }

  /**
   * The single settlement point, provider-agnostic.
   *
   * The event and every one of its effects are applied in one transaction: if
   * the process dies halfway there is never a payment recorded without the
   * access it paid for.
   */
  async settle(event: PaymentEvent): Promise<void> {
    const notify = await this.ds.transaction(async (m) => {
      // Claiming the event is what makes this idempotent. A provider retries
      // webhooks; without this the buyer gets three contracts.
      const inserted = await m.query(
        `INSERT INTO payment_events (provider_event_id, payload)
         VALUES ($1, $2) ON CONFLICT (provider_event_id) DO NOTHING
         RETURNING id`,
        [event.providerEventId, JSON.stringify(event)],
      );
      if (affectedRows(inserted) === 0) return null; // already settled

      const order = firstRow<{ id: string; user_id: string; status: string }>(
        await m.query(
          `SELECT id, user_id, status FROM orders WHERE reference = $1 FOR UPDATE`,
          [event.reference],
        ),
      );
      if (!order) {
        this.log.warn(`Pago sin pedido: ${event.reference}`);
        return null;
      }

      const result =
        event.status === 'APPROVED'
          ? await this.approve(m, order.id, order.user_id, order.status, event.transactionId)
          : event.status === 'DECLINED'
            ? await this.decline(m, order.id, event.transactionId)
            : null;

      await m.query(
        `UPDATE payment_events SET processed_at = now() WHERE provider_event_id = $1`,
        [event.providerEventId],
      );
      return result;
    });

    // Mail goes out after the transaction commits, with a dedupe key: sending
    // inside would deliver a contract for a transaction that then rolled back.
    if (notify) {
      try {
        await this.mail.send({
          to: notify.email,
          ...notify.message,
          dedupeKey: event.providerEventId,
        });
      } catch (err) {
        // The payment is already settled and committed. Letting a mail failure
        // out from here would answer the buyer's return from the gateway with
        // an error over a purchase that went through — and the receipt can be
        // resent, while a confirmation screen that says nothing worked cannot
        // be taken back. It has to be loud, though: nobody would find out
        // otherwise, which is exactly how a receipt goes missing for weeks.
        this.log.error(`No se pudo enviar el correo de ${event.reference}: ${String(err)}`);
      }
    }
  }

  private async approve(
    m: EntityManager,
    orderId: string,
    userId: string,
    currentStatus: string,
    transactionId: string,
  ): Promise<Notification | null> {
    const items = returnedRows<{ piece_id: string | null; drop_id: string | null }>(
      await m.query(`SELECT piece_id, drop_id FROM order_items WHERE order_id = $1`, [orderId]),
    );

    // An expired order gave its units back. The payment is real, so take them
    // again — and if they ran out meanwhile, refund rather than keep the money.
    if (currentStatus === 'expired') {
      for (const item of items.filter((i) => i.piece_id)) {
        if (!(await this.pieces.take(item.piece_id!, m))) {
          return this.refund(m, orderId, userId, transactionId, 'La pieza se agotó antes de que se confirmara tu pago.');
        }
      }
    }

    for (const item of items.filter((i) => i.drop_id)) {
      try {
        await this.drops.grantEntitlement(m, item.drop_id!, userId, orderId);
      } catch {
        return this.refund(m, orderId, userId, transactionId, 'El cupo se agotó antes de que se confirmara tu pago.');
      }
    }

    await m.query(
      `UPDATE orders SET status = 'paid', paid_at = now(), wompi_transaction_id = $2
        WHERE id = $1 AND status IN ('pending', 'expired')`,
      [orderId, transactionId],
    );
    await m.query(
      `UPDATE contracts SET status = 'executed'
        WHERE order_id = $1 AND status = 'signed_pending_payment'`,
      [orderId],
    );

    const user = firstRow<{ email: string }>(
      await m.query(`SELECT email FROM users WHERE id = $1`, [userId]),
    );
    // The kind travels with the title because the receipt reads differently for
    // a piece than for a video, and only the order knows which it was.
    const bought = returnedRows<{ kind: 'piece' | 'drop'; title: string; signed: boolean }>(
      await m.query(
        `SELECT CASE WHEN i.piece_id IS NOT NULL THEN 'piece' ELSE 'drop' END AS kind,
                COALESCE(p.title, d.title) AS title,
                i.wants_signature AS signed
           FROM order_items i
           LEFT JOIN pieces p ON p.id = i.piece_id
           LEFT JOIN drops d ON d.id = i.drop_id
          WHERE i.order_id = $1`,
        [orderId],
      ),
    );

    return {
      email: user!.email,
      message: purchaseConfirmed({
        items: bought.map(({ kind, title, signed }) => ({ kind, title, signed })),
        accountUrl: `${process.env.PUBLIC_WEB_URL}/cuenta`,
      }),
    };
  }

  private async decline(
    m: EntityManager,
    orderId: string,
    transactionId: string,
  ): Promise<Notification | null> {
    await m.query(
      `UPDATE orders SET status = 'failed', wompi_transaction_id = $2
        WHERE id = $1 AND status = 'pending'`,
      [orderId, transactionId],
    );

    // The units go back: a declined payment must not park what nobody bought.
    const items = returnedRows<{ piece_id: string | null }>(
      await m.query(
        `SELECT piece_id FROM order_items WHERE order_id = $1 AND piece_id IS NOT NULL`,
        [orderId],
      ),
    );
    for (const item of items) await this.pieces.release(item.piece_id!, m);

    // A contract with no price paid is not a sale.
    await m.query(
      `UPDATE contracts SET status = 'void' WHERE order_id = $1 AND status <> 'executed'`,
      [orderId],
    );
    return null;
  }

  private async refund(
    m: EntityManager,
    orderId: string,
    userId: string,
    transactionId: string,
    reason: string,
  ): Promise<Notification> {
    await m.query(
      `UPDATE orders SET status = 'refunded', wompi_transaction_id = $2 WHERE id = $1`,
      [orderId, transactionId],
    );
    await m.query(`UPDATE contracts SET status = 'void' WHERE order_id = $1`, [orderId]);

    const user = firstRow<{ email: string }>(
      await m.query(`SELECT email FROM users WHERE id = $1`, [userId]),
    );
    return {
      email: user!.email,
      message: refunded(reason, `${process.env.PUBLIC_WEB_URL}/cuenta`),
    };
  }
}
