/**
 * Rough fee of a Colombian payment gateway on card: a percentage plus a flat
 * amount per transaction. The flat part is what makes a very low price
 * unworkable, which is why the studio shows this while setting the price.
 *
 * It is an estimate to guide the artist, not an accounting settlement.
 */
const RATE = 0.0265;
const FLAT_COP = 900;

/** Below this, fees eat more than 10%. */
export const SUGGESTED_PRICE_COP = 15000;

export interface Fees {
  feeCop: number;
  payoutCop: number;
  percentage: number;
}

export function calculateFees(priceCop: number): Fees {
  if (priceCop <= 0) return { feeCop: 0, payoutCop: 0, percentage: 0 };
  const feeCop = Math.round(priceCop * RATE) + FLAT_COP;
  // A price below the flat fee would leave a negative payout: report zero.
  const payoutCop = Math.max(0, priceCop - feeCop);
  return {
    feeCop,
    payoutCop,
    percentage: Math.round((feeCop / priceCop) * 100),
  };
}
