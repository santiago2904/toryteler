import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DropsService } from '../drops/drops.service';
import { PiecesService } from '../pieces/pieces.service';
import { MailService, Attachment } from '../mail/mail.service';
import { Message, PurchasedItem, purchaseConfirmed, refunded } from '../mail/templates';
import { DocumentStore } from '../storage/document-store';
import { affectedRows, firstRow, returnedRows } from '../database/rows';
import { PaymentEvent, PaymentGateway } from './payment-gateway';

/**
 * What has to be told to the buyer once the transaction commits.
 *
 * A receipt is not a finished message yet: it says the contract is attached,
 * and whether it really is depends on reading a file that can fail. So it
 * travels as its parts and is written once the outcome is known. A refund has
 * nothing pending and travels written.
 */
type Notification =
  | {
      kind: 'receipt';
      email: string;
      items: PurchasedItem[];
      /**
       * Where the signed contract lives, when the order has one. It is read
       * after the transaction commits, never inside it: fetching a file over
       * the network while holding a lock on the order is how a settlement ends
       * up waiting on somebody else's outage.
       */
      contract: string | null;
    }
  | { kind: 'message'; email: string; message: Message };

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly gateway: PaymentGateway,
    private readonly pieces: PiecesService,
    private readonly drops: DropsService,
    private readonly mail: MailService,
    private readonly documents: DocumentStore,
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
        const attachments =
          notify.kind === 'receipt' && notify.contract
            ? await this.attachContract(notify.contract, event.reference)
            : [];

        const message =
          notify.kind === 'receipt'
            ? purchaseConfirmed({
                items: notify.items,
                accountUrl: `${process.env.PUBLIC_WEB_URL}/cuenta`,
                contractAttached: attachments.length > 0,
              })
            : notify.message;

        await this.mail.send({
          to: notify.email,
          ...message,
          attachments,
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

  /**
   * The signed contract, ready to travel with the receipt.
   *
   * Returns nothing rather than throwing when the document cannot be read: the
   * buyer's receipt matters more than the attachment, the contract is in their
   * account either way, and the message adapts to say so. What must not happen
   * is silence — a receipt that quietly stops carrying the contract would go
   * unnoticed for as long as nobody complains.
   */
  private async attachContract(reference: string, orderReference: string): Promise<Attachment[]> {
    try {
      return [
        {
          filename: `contrato-${orderReference}.pdf`,
          content: await this.documents.readPdf(reference),
        },
      ];
    } catch (err) {
      this.log.warn(`Contrato no adjuntado en ${orderReference}: ${String(err)}`);
      return [];
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

    // Only an executed contract travels: one still awaiting payment, or void,
    // describes a sale that did not happen.
    const contract = firstRow<{ pdf_url: string }>(
      await m.query(
        `SELECT pdf_url FROM contracts WHERE order_id = $1 AND status = 'executed'`,
        [orderId],
      ),
    );

    return {
      kind: 'receipt',
      email: user!.email,
      items: bought.map(({ kind, title, signed }) => ({ kind, title, signed })),
      contract: contract?.pdf_url ?? null,
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
      kind: 'message',
      email: user!.email,
      message: refunded(reason, `${process.env.PUBLIC_WEB_URL}/cuenta`),
    };
  }
}
