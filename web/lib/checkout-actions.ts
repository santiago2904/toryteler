'use server';

import { apiSend } from './api';
import { clearSession, hasSession, rememberDestination, setSession } from './session';

/**
 * Every write the buyer performs, in one place.
 *
 * They run on the server for two reasons: the session cookie is httpOnly and
 * unreadable from the page, and the API's address stays out of the browser.
 *
 * All of them return a result instead of throwing, because these are forms:
 * an expired code or a piece someone else just bought are ordinary answers,
 * not crashes, and each one has a sentence the buyer needs to read.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Turns an API error into something worth reading. */
const MESSAGES: Record<string, string> = {
  EMPTY_ORDER: 'No hay nada en el carrito.',
  EMAIL_REQUIRED: 'Escribe tu correo para continuar.',
  PIECE_UNAVAILABLE: 'Alguien se adelantó: una de las piezas ya no está.',
  DROP_SOLD_OUT: 'Se agotaron los cupos de uno de los videos.',
  ALREADY_OWNED: 'Ya tienes uno de estos videos.',
  SHIPPING_REQUIRED: 'Necesitamos una dirección para enviarte la pieza.',
  ORDER_NOT_PAYABLE: 'Este pedido ya no se puede pagar. Empieza de nuevo.',
  INVALID_CODE: 'El código no coincide.',
  CODE_EXPIRED: 'El código venció. Pide uno nuevo.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Pide un código nuevo.',
  MUST_READ_DOCUMENT: 'Tienes que leer el contrato hasta el final antes de firmarlo.',
  CONTRACT_ALREADY_SIGNED: 'Este contrato ya estaba firmado.',
  INVALID_OR_USED: 'Ese enlace ya se usó o venció. Pide otro.',
  REQUEST_IN_PROGRESS: 'Ya estamos procesando esto. Espera un momento.',
};

function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = Object.keys(MESSAGES).find((key) => raw.includes(key));
  if (code) return MESSAGES[code];
  if (raw.includes('API_401')) return 'Tu sesión venció. Entra otra vez.';
  // The demo deployment runs on mock data with no API behind it.
  if (raw.includes('API_NOT_CONFIGURED')) {
    return 'La tienda todavía no está conectada: esto es una maqueta.';
  }
  return 'No pudimos completar la operación. Inténtalo de nuevo.';
}

async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

/**
 * `next` travels in a short-lived cookie rather than in the emailed link: the
 * link is built by the API, and a destination that survives a round trip
 * through an inbox is a destination an attacker could have chosen.
 */
export async function requestMagicLink(email: string, next?: string): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend<{ ok: boolean }>('/auth/magic-link', 'POST', { email });
    if (next) await rememberDestination(next);
    return null;
  });
}

export async function signOut(): Promise<void> {
  await clearSession();
}

export async function isSignedIn(): Promise<boolean> {
  return hasSession();
}

/** Only used by the route the emailed link points at. */
export async function redeemLink(token: string): Promise<Result<null>> {
  return attempt(async () => {
    const { sessionToken } = await apiSend<{ userId: string; sessionToken: string }>(
      '/auth/redeem',
      'POST',
      { token },
    );
    await setSession(sessionToken);
    return null;
  });
}

export interface CreateOrderInput {
  pieceSlugs: string[];
  dropSlugs: string[];
  paymentMethod: 'CARD' | 'PSE' | 'NEQUI';
  shippingAddress?: { line1: string; city: string; phone: string };
  /** Which pieces go signed by the artist. A subset of `pieceSlugs`. */
  signedPieceSlugs?: string[];
  /**
   * Only sent when there is no session yet. Buying does not require a magic
   * link first — the order is placed under this email, and proving it is
   * real happens later where it actually matters (the contract's OTP, for a
   * piece).
   */
  email?: string;
  /**
   * Minted by the browser and reused on every retry of the same attempt. It is
   * what stops a lost response from taking the units twice.
   */
  idempotencyKey: string;
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<Result<{ id: string; reference: string; totalCop: number }>> {
  const { idempotencyKey, ...body } = input;
  return attempt(async () => {
    const order = await apiSend<
      { id: string; reference: string; totalCop: number; sessionToken?: string }
    >('/orders', 'POST', body, { idempotencyKey });

    // Present only for a guest: the API just found or created their account
    // and scoped this token to this one order, so the rest of checkout
    // (contract, pay) can go on without asking them to sign in.
    if (order.sessionToken) await setSession(order.sessionToken);

    return order;
  });
}

export interface PreparedContract {
  contractId: string;
  pdfUrl: string;
  documentHash: string;
  otpChallengeId: string;
}

export async function prepareContract(
  orderId: string,
  signer: { fullName: string; documentId: string; phone: string },
): Promise<Result<PreparedContract>> {
  return attempt(() =>
    apiSend<PreparedContract>(`/orders/${orderId}/contract`, 'POST', signer),
  );
}

export async function signContract(
  contractId: string,
  input: { otpChallengeId: string; code: string; scrolledToEnd: boolean },
): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend<{ ok: boolean }>(`/contracts/${contractId}/sign`, 'POST', input);
    return null;
  });
}

/**
 * Asks the gateway what happened, using the transaction id it put in the URL
 * on the way back. Turns "confirmando tu pago" into an answer straight away
 * instead of waiting for a webhook the buyer cannot see.
 */
export async function confirmPayment(
  orderId: string,
  transactionId: string,
): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/orders/${orderId}/confirm`, 'POST', { transactionId });
    return null;
  });
}

export async function startPayment(orderId: string): Promise<Result<{ checkoutUrl: string }>> {
  return attempt(() =>
    apiSend<{ checkoutUrl: string }>(`/orders/${orderId}/pay`, 'POST', {}),
  );
}
