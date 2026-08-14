'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { clearCart } from '@/lib/cart';

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
export function OrderWatcher({ status }: { status: string }) {
  const router = useRouter();

  useEffect(() => {
    // The order exists, so whatever was in the cart is now its problem.
    if (status !== 'failed' && status !== 'expired') clearCart();
  }, [status]);

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
