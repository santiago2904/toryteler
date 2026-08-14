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
      await this.mail.send({
        to: notify.email,
        ...notify.message,
        dedupeKey: event.providerEventId,
      });
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
    const bought = returnedRows<{ title: string }>(
      await m.query(
        `SELECT COALESCE(p.title, d.title) AS title
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
        items: bought.map((row) => row.title),
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
