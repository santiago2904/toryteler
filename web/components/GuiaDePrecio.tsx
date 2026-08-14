'use client';

import { calcularComision, PRECIO_RECOMENDADO_COP } from '@/lib/comision';
import { formatearPrecio } from '@/lib/formato';
import estilos from './GuiaDePrecio.module.scss';

/**
 * Muestra qué queda después de la comisión en el momento de escribir el precio.
 * Es información en el punto de decisión, nunca una restricción: el artista
 * puede poner el precio que quiera, incluido el simbólico.
 */
export function GuiaDePrecio({ precio }: { precio: number }) {
  const { recibeCop, porcentaje } = calcularComision(precio);

  return (
    <p className={`${estilos.guia} tenue`} role="status">
      {precio > 0 && (
        <>
          Recibes {formatearPrecio(recibeCop)} · {porcentaje}% se va en comisión.
          {precio < PRECIO_RECOMENDADO_COP &&
            ` Desde ${formatearPrecio(PRECIO_RECOMENDADO_COP)} la comisión baja a cerca del 8%.`}
        </>
      )}
    </p>
  );
}
