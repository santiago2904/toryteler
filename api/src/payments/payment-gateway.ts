/**
 * The payment provider seen from the inside of this system.
 *
 * Everything above this line speaks in these terms: a normalised status, a
 * reference and an event id. Nothing else in the codebase imports Wompi, so
 * changing provider — or adding a second one for another country — means
 * writing one class, not chasing conditionals through the settlement logic.
 */

/** What a payment can be, once the provider's vocabulary is dropped. */
export type PaymentStatus = 'APPROVED' | 'DECLINED' | 'PENDING';

export interface PaymentEvent {
  /**
   * Unique per state change, not per transaction: a provider emits several
   * events for the same payment and each must settle exactly once.
   */
  providerEventId: string;
  /** Our order reference, which is what ties the event back to the order. */
  reference: string;
  transactionId: string;
  status: PaymentStatus;
  amountInCents: number;
  /**
   * True only for events this system built itself after asking the provider
   * directly — reconciliation. A signature cannot be verified on those, so the
   * settlement needs to know not to try.
   */
  trusted?: boolean;
}

export interface CheckoutRequest {
  reference: string;
  amountCop: number;
  customerEmail: string;
  redirectUrl: string;
}

export abstract class PaymentGateway {
  /** Where to send the buyer to pay. Card data never touches our servers. */
  abstract buildCheckoutUrl(request: CheckoutRequest): string;

  /**
   * Whether a raw webhook body really comes from the provider. Rejecting is the
   * default: an unverified body is an attacker claiming a payment happened.
   */
  abstract verifyWebhook(body: unknown): boolean;

  /** Turns a verified webhook body into a PaymentEvent. */
  abstract parseWebhook(body: unknown): PaymentEvent;

  /**
   * The idempotency key for one state change of one transaction.
   *
   * Both roads into settlement — the webhook and reconciliation asking the
   * provider directly — must produce the same key for the same outcome, or a
   * late webhook settles a second time and hands back a unit nobody returned.
   */
  abstract eventIdFor(transactionId: string, status: PaymentStatus): string;

  /**
   * Asks the provider what actually happened. Used when a webhook never
   * arrives, which is the one failure a webhook-only design cannot survive.
   */
  abstract fetchTransaction(transactionId: string): Promise<{
    status: PaymentStatus;
    reference: string;
    amountInCents: number;
  }>;
}
