/**
 * Comisión aproximada de una pasarela colombiana con tarjeta: un porcentaje
 * más un fijo por transacción. El fijo es lo que hace inviable un precio muy
 * bajo, y por eso el panel lo muestra en el momento de fijar el precio.
 *
 * Es una estimación para orientar al artista, no una liquidación contable.
 */
const PORCENTAJE = 0.0265;
const FIJO_COP = 900;

/** Por debajo de esto la comisión se lleva más del 10%. */
export const PRECIO_RECOMENDADO_COP = 15000;

export interface Comision {
  comisionCop: number;
  recibeCop: number;
  porcentaje: number;
}

export function calcularComision(precioCop: number): Comision {
  if (precioCop <= 0) return { comisionCop: 0, recibeCop: 0, porcentaje: 0 };
  const comisionCop = Math.round(precioCop * PORCENTAJE) + FIJO_COP;
  // Un precio menor que el fijo dejaría un neto negativo: se reporta cero.
  const recibeCop = Math.max(0, precioCop - comisionCop);
  return {
    comisionCop,
    recibeCop,
    porcentaje: Math.round((comisionCop / precioCop) * 100),
  };
}
