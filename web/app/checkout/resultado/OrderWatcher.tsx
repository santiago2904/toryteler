'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { clearCart } from '@/lib/cart';
import { confirmPayment } from '@/lib/checkout-actions';

const POLL_MS = 4000;
const GIVE_UP_MS = 90_000;

/**
 * Keeps the result screen honest while the payment confirms.
 *
 * The order turns paid when the gateway's webhook reaches the API, which is
 * usually seconds after the buyer is redirected back but is not guaranteed to
 * be. Rather than claim an outcome the API has not confirmed, this asks again
 * a few times and then stops: the account page tells the same story later, and
 * an email arrives either way.
 */
export function OrderWatcher({
  status,
  orderId,
  transactionId,
}: {
  status: string;
  orderId: string;
  /** Put there by the gateway when it sent the buyer back. */
  transactionId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    // The order exists, so whatever was in the cart is now its problem.
    if (status !== 'failed' && status !== 'expired') clearCart();
  }, [status]);

  // Ask the gateway directly before falling back to waiting. The webhook is
  // the mechanism; this is what keeps the buyer from staring at "confirmando"
  // while it travels.
  useEffect(() => {
    if (status !== 'pending' || !transactionId) return;
    void confirmPayment(orderId, transactionId).then(() => router.refresh());
  }, [status, orderId, transactionId, router]);

  useEffect(() => {
    if (status !== 'pending') return;

    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [status, router]);

  return null;
}
