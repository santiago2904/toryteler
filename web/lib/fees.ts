/**
 * Comisión real de Wompi: porcentaje sobre lo que de verdad se cobra en
 * pesos, más un monto fijo por transacción. El porcentaje no cambia al
 * pasar a dólares — es una proporción, no una cifra en una moneda — pero
 * el monto fijo (900 COP) sí necesita una referencia para expresarse en
 * dólares; se usa una tasa de referencia fija para esta estimación nada
 * más, no la TRM en vivo (ver docs/superpowers/specs/2026-08-27-precios-usd-cobro-trm-design.md
 * §6 — esto es una guía para el artista, no una liquidación).
 */
const RATE = 0.0265;
const FLAT_USD_CENTS = 30; // ~900 COP a una tasa de referencia de ~3.000 COP/USD

/** Por debajo de esto, la comisión se come más del 10%. */
export const SUGGESTED_PRICE_USD_CENTS = 500;

export interface Fees {
  feeUsdCents: number;
  payoutUsdCents: number;
  percentage: number;
}

export function calculateFees(priceUsdCents: number): Fees {
  if (priceUsdCents <= 0) return { feeUsdCents: 0, payoutUsdCents: 0, percentage: 0 };
  const feeUsdCents = Math.round(priceUsdCents * RATE) + FLAT_USD_CENTS;
  const payoutUsdCents = Math.max(0, priceUsdCents - feeUsdCents);
  return {
    feeUsdCents,
    payoutUsdCents,
    percentage: Math.round((feeUsdCents / priceUsdCents) * 100),
  };
}
