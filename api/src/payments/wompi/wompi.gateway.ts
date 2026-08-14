import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  CheckoutRequest,
  PaymentEvent,
  PaymentGateway,
  PaymentStatus,
} from '../payment-gateway';

/** Wompi's own vocabulary. It does not leave this file. */
interface WompiEventBody {
  event: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
      amount_in_cents: number;
    };
  };
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

const STATUS: Record<string, PaymentStatus> = {
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  VOIDED: 'DECLINED',
  ERROR: 'DECLINED',
  PENDING: 'PENDING',
};

@Injectable()
export class WompiGateway extends PaymentGateway {
  constructor(private readonly config: ConfigService) {
    super();
  }

  buildCheckoutUrl(request: CheckoutRequest): string {
    const cents = request.amountCop * 100;
    const params = new URLSearchParams({
      'public-key': this.get('WOMPI_PUBLIC_KEY'),
      currency: 'COP',
      'amount-in-cents': String(cents),
      reference: request.reference,
      // Signed with cents, the same figure sent as amount-in-cents. Signing the
      // pesos figure produces a checkout Wompi rejects without explaining why.
      'signature:integrity': this.integrity(request.reference, cents),
      'redirect-url': request.redirectUrl,
      'customer-data:email': request.customerEmail,
    });
    return `${this.get('WOMPI_CHECKOUT_URL')}?${params.toString()}`;
  }

  verifyWebhook(body: unknown): boolean {
    if (!this.looksLikeEvent(body)) return false;

    const concatenated = body.signature.properties
      .map((path) => this.readPath(body.data, path))
      .join('');
    const expected = createHash('sha256')
      .update(`${concatenated}${body.timestamp}${this.get('WOMPI_EVENTS_SECRET')}`)
      .digest('hex');

    // Wompi sends the checksum uppercase. Comparing case-sensitively against a
    // lowercase digest rejects every legitimate event.
    return expected.toUpperCase() === body.signature.checksum.toUpperCase();
  }

  parseWebhook(body: unknown): PaymentEvent {
    if (!this.looksLikeEvent(body)) throw new BadRequestException('MALFORMED_EVENT');
    const tx = body.data.transaction;

    return {
      // A transaction goes PENDING then APPROVED: keyed by id alone, the second
      // event would be discarded as a duplicate and the order never settle.
      providerEventId: `${tx.id}:${tx.status}`,
      reference: tx.reference,
      transactionId: tx.id,
      status: STATUS[tx.status] ?? 'PENDING',
      amountInCents: tx.amount_in_cents,
    };
  }

  async fetchTransaction(transactionId: string) {
    const res = await fetch(`${this.get('WOMPI_BASE_URL')}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${this.get('WOMPI_PRIVATE_KEY')}` },
    });
    if (!res.ok) throw new Error(`WOMPI_QUERY_FAILED_${res.status}`);

    const json = (await res.json()) as {
      data: { status: string; reference: string; amount_in_cents: number };
    };
    return {
      status: STATUS[json.data.status] ?? 'PENDING',
      reference: json.data.reference,
      amountInCents: json.data.amount_in_cents,
    };
  }

  /** Integrity signature: reference + cents + currency + secret. */
  private integrity(reference: string, cents: number): string {
    return createHash('sha256')
      .update(`${reference}${cents}COP${this.get('WOMPI_INTEGRITY_SECRET')}`)
      .digest('hex');
  }

  private looksLikeEvent(body: unknown): body is WompiEventBody {
    const b = body as WompiEventBody | null;
    return Boolean(
      b?.data?.transaction?.id &&
        b.data.transaction.reference &&
        b.signature?.checksum &&
        Array.isArray(b.signature.properties) &&
        typeof b.timestamp !== 'undefined',
    );
  }

  /** Reads "transaction.amount_in_cents" out of the event's data object. */
  private readPath(data: unknown, path: string): string {
    const value = path
      .split('.')
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | null)?.[key], data);
    return value === undefined || value === null ? '' : String(value);
  }

  private get(key: string): string {
    return this.config.get<string>(key) ?? '';
  }
}
