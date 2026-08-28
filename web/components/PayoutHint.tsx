'use client';

import { calculateFees, SUGGESTED_PRICE_USD_CENTS } from '@/lib/fees';
import { formatPrice } from '@/lib/format';
import styles from './PayoutHint.module.scss';

/**
 * Shows what is left after fees while the price is being typed. It is
 * information at the point of decision, never a restriction: the artist can set
 * any price, including a token one.
 */
export function PayoutHint({ price }: { price: number }) {
  const { payoutUsdCents, percentage } = calculateFees(price);

  return (
    <p className={`${styles.hint} muted`} role="status">
      {price > 0 && (
        <>
          Recibes {formatPrice(payoutUsdCents)} · {percentage}% se va en comisión.
          {price < SUGGESTED_PRICE_USD_CENTS &&
            ` Desde ${formatPrice(SUGGESTED_PRICE_USD_CENTS)} la comisión baja a cerca del 8%.`}
        </>
      )}
    </p>
  );
}
