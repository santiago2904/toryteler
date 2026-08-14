import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { affectedRows, returnedRows } from '../database/rows';
import { PiecesService } from '../pieces/pieces.service';
import { PaymentGateway } from './payment-gateway';
import { PaymentsService } from './payments.service';

/**
 * How long a payment method is given before its order is considered dead.
 * A card either works or fails in seconds; PSE walks the buyer through their
 * bank's own site, which is why it gets three times the room.
 */
const DEADLINE_MINUTES: Record<string, number> = { CARD: 15, NEQUI: 20, PSE: 45 };

interface StaleOrder {
  id: string;
  reference: string;
  payment_method: string;
  transaction_id: string | null;
  minutes_old: number;
}

@Injectable()
export class ReconciliationService {
  private readonly log = new Logger(ReconciliationService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly gateway: PaymentGateway,
    private readonly payments: PaymentsService,
    private readonly pieces: PiecesService,
  ) {}

  /**
   * The only periodic process in the system, and a safety net rather than a
   * mechanism: everything settles through webhooks. This exists because the one
   * failure a webhook-only design cannot survive is the webhook that never
   * arrives — the buyer's money is gone and the piece stays parked forever.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<{ checked: number; expired: number }> {
    const stale = returnedRows<StaleOrder>(
      await this.ds.query(
        `SELECT o.id,
                o.reference,
                o.payment_method,
                o.wompi_transaction_id AS transaction_id,
                extract(epoch FROM now() - o.created_at) / 60 AS minutes_old
           FROM orders o
          WHERE o.status = 'pending'
            AND o.created_at < now() - make_interval(mins => $1)`,
        [Math.min(...Object.values(DEADLINE_MINUTES))],
      ),
    );

    let checked = 0;
    let expired = 0;

    for (const order of stale) {
      const deadline = DEADLINE_MINUTES[order.payment_method] ?? 15;
      if (order.minutes_old < deadline) continue;

      // No transaction id means the buyer closed the tab before paying.
      if (!order.transaction_id) {
        await this.expire(order.id);
        expired += 1;
        continue;
      }

      checked += 1;
      try {
        const remote = await this.gateway.fetchTransaction(order.transaction_id);

        if (remote.status === 'PENDING') {
          // Still in progress. Past twice its deadline it is not coming back,
          // and the unit matters more than the wait: expiring returns it. If
          // the payment does land later, settlement takes the unit again — and
          // refunds if someone else bought it meanwhile.
          if (order.minutes_old >= deadline * 2) {
            await this.expire(order.id);
            expired += 1;
          }
          continue;
        }

        await this.payments.settle({
          // The same key the webhook would carry, so whichever arrives second
          // is a no-op instead of a second settlement.
          providerEventId: this.gateway.eventIdFor(order.transaction_id, remote.status),
          reference: order.reference,
          transactionId: order.transaction_id,
          status: remote.status,
          amountInCents: remote.amountInCents,
          // Built from the provider's own API answer, authenticated with the
          // private key. There is no signature to verify on it.
          trusted: true,
        });
      } catch (err) {
        // One unreachable transaction must not stop the rest of the sweep. The
        // next run picks it up again.
        this.log.error(`Reconciliación falló para ${order.reference}: ${String(err)}`);
      }
    }

    return { checked, expired };
  }

  /**
   * Closes an order and returns what it was holding.
   *
   * The signed contract is left as it is on purpose. Voiding it would leave a
   * later approval with a paid order and a dead contract, and the contract is
   * an honest record either way: it was signed, and payment never followed.
   */
  private async expire(orderId: string): Promise<void> {
    await this.ds.transaction(async (m) => {
      const closed = await m.query(
        `UPDATE orders SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
        [orderId],
      );
      // A webhook may have settled it between the query and this update.
      if (affectedRows(closed) === 0) return;

      const items = returnedRows<{ piece_id: string }>(
        await m.query(
          `SELECT piece_id FROM order_items WHERE order_id = $1 AND piece_id IS NOT NULL`,
          [orderId],
        ),
      );
      for (const item of items) await this.pieces.release(item.piece_id, m);
    });
  }
}
