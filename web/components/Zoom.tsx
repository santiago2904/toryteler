'use client';

import { useEffect, useState } from 'react';

/**
 * Alterna la densidad de la rejilla entre lejos (muchas piezas por fila) y
 * cerca (tres por fila, para mirar de verdad).
 *
 * El estado vive como atributo en <html>, no en React: así el botón puede
 * estar en la cabecera y la rejilla en otra página sin pasar props ni montar
 * un contexto por una sola preferencia.
 */
export function Zoom() {
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    setCerca(document.documentElement.dataset.zoom === 'cerca');
  }, []);

  function alternar() {
    const siguiente = !cerca;
    setCerca(siguiente);
    document.documentElement.dataset.zoom = siguiente ? 'cerca' : 'lejos';
    try {
      localStorage.setItem('zoom', siguiente ? 'cerca' : 'lejos');
    } catch {
      // Almacenamiento bloqueado: la preferencia dura la sesión.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="enlace"
      aria-pressed={cerca}
      aria-label={cerca ? 'Ver más piezas por fila' : 'Ver menos piezas por fila, más grandes'}
    >
      {cerca ? '−' : '+'}
    </button>
  );
}
